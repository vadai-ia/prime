-- 0010 · Funciones RPC

-- ---------------------------------------------------------------------------
-- Decisión del cliente (Vo.Bo. / no continuar). SECURITY DEFINER: valida rol,
-- client_id y etapa. El cliente nunca hace UPDATE directo sobre applications.
-- ---------------------------------------------------------------------------
create or replace function public.client_decide_application(
  p_application_id uuid,
  p_decision       public.client_decision,
  p_comment        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid := app.client_id();
  v_app    public.applications;
begin
  if not app.is_client() then
    raise exception 'Solo el contacto del cliente puede decidir' using errcode = '42501';
  end if;

  select a.* into v_app
  from public.applications a
  join public.job_profiles p on p.id = a.profile_id
  where a.id = p_application_id
    and p.client_id = v_client
  for update of a;

  if not found then
    raise exception 'Postulación no encontrada' using errcode = '42501';
  end if;

  if v_app.stage <> 'client_interview' then
    raise exception 'La postulación no está en entrevista con cliente (etapa actual: %)', v_app.stage
      using errcode = '22023';
  end if;

  perform set_config('app.actor_type', 'client', true);
  perform set_config(
    'app.stage_reason',
    coalesce(p_comment, case p_decision when 'approve' then 'Vo.Bo. del cliente' else 'No continuar (cliente)' end),
    true
  );

  update public.applications
  set stage                   = case p_decision when 'approve' then 'hired'::public.application_stage else 'discarded'::public.application_stage end,
      discard_reason_key      = case p_decision when 'reject' then 'client_rejected'::public.discard_reason_key else discard_reason_key end,
      client_decision         = p_decision,
      client_decision_at      = now(),
      client_decision_by      = auth.uid(),
      client_decision_comment = p_comment
  where id = p_application_id
  returning * into v_app;

  perform set_config('app.actor_type', '', true);
  perform set_config('app.stage_reason', '', true);

  return jsonb_build_object('id', v_app.id, 'stage', v_app.stage, 'decided_at', v_app.client_decision_at);
end;
$$;

revoke execute on function public.client_decide_application from public, anon;
grant execute on function public.client_decide_application to authenticated;

-- ---------------------------------------------------------------------------
-- Cola: tomar tareas con FOR UPDATE SKIP LOCKED. Solo service role (cron).
-- ---------------------------------------------------------------------------
create or replace function public.claim_scheduled_tasks(
  p_limit  int default 10,
  p_worker text default null
)
returns setof public.scheduled_tasks
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id
    from public.scheduled_tasks
    where status = 'pending'
      and run_at <= now()
    order by run_at
    limit p_limit
    for update skip locked
  )
  update public.scheduled_tasks t
  set status    = 'running',
      locked_at = now(),
      locked_by = p_worker,
      attempts  = attempts + 1
  from picked
  where t.id = picked.id
  returning t.*;
$$;

-- Cierre de tarea con backoff exponencial: run_at = now() + 2^attempts minutos.
create or replace function public.finish_scheduled_task(
  p_task_id uuid,
  p_ok      boolean,
  p_error   text default null
)
returns public.scheduled_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.scheduled_tasks;
begin
  select * into v_task from public.scheduled_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Tarea % no encontrada', p_task_id;
  end if;

  if p_ok then
    update public.scheduled_tasks
    set status = 'done', finished_at = now(), locked_at = null, locked_by = null, last_error = null
    where id = p_task_id
    returning * into v_task;
  elsif v_task.attempts >= v_task.max_attempts then
    update public.scheduled_tasks
    set status = 'failed', finished_at = now(), locked_at = null, locked_by = null, last_error = p_error
    where id = p_task_id
    returning * into v_task;
  else
    update public.scheduled_tasks
    set status = 'pending', locked_at = null, locked_by = null, last_error = p_error,
        run_at = now() + (power(2, v_task.attempts) * interval '1 minute')
    where id = p_task_id
    returning * into v_task;
  end if;

  return v_task;
end;
$$;

-- Encolar con dedupe: si ya hay una tarea pendiente/corriendo con la misma clave, no duplica.
create or replace function public.enqueue_task(
  p_type       text,
  p_payload    jsonb default '{}'::jsonb,
  p_run_at     timestamptz default now(),
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.scheduled_tasks (type, payload, run_at, dedupe_key)
  values (p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_run_at, now()), p_dedupe_key)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pending', 'running') do nothing
  returning id into v_id;

  if v_id is null and p_dedupe_key is not null then
    select id into v_id from public.scheduled_tasks
    where dedupe_key = p_dedupe_key and status in ('pending', 'running')
    limit 1;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.claim_scheduled_tasks  from public, anon, authenticated;
revoke execute on function public.finish_scheduled_task  from public, anon, authenticated;
revoke execute on function public.enqueue_task           from public, anon;
grant  execute on function public.claim_scheduled_tasks  to service_role;
grant  execute on function public.finish_scheduled_task  to service_role;
-- El staff puede encolar desde Server Actions (p. ej. reenviar template); el cliente no.
grant  execute on function public.enqueue_task           to service_role, authenticated;

create or replace function app.enqueue_task_guard()
returns trigger
language plpgsql
as $$
begin
  if not (app.is_staff() or app.is_service()) then
    raise exception 'Sin permiso para encolar tareas' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger scheduled_tasks_insert_guard
  before insert on public.scheduled_tasks
  for each row execute function app.enqueue_task_guard();

-- ---------------------------------------------------------------------------
-- Registro de auditoría desde la app (lecturas de documentos). Lo llama el
-- servidor con la sesión del usuario; se guarda quién y desde qué IP.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action      public.audit_action,
  p_entity_type text,
  p_entity_id   uuid,
  p_ip          text default null,
  p_metadata    jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (user_id, action, entity_type, entity_id, ip, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, nullif(p_ip, '')::inet, p_metadata);
$$;

revoke execute on function public.log_audit from public, anon;
grant execute on function public.log_audit to authenticated, service_role;
