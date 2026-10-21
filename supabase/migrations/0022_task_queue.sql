-- 0022 · Ejecutor de la cola (tasks.md §3): ajustes para /api/cron/tick
--
-- La cola existe desde 0008/0010. Faltaba:
--   1. Recuperar tareas que se quedaron en 'running' porque el proceso murió a la mitad
--      (Vercel corta la función al llegar a maxDuration): se vuelven a tomar a los 10 minutos.
--   2. Tomar una tarea concreta (p_only) para correrla en cuanto se encola, sin esperar al cron.
--   3. Fallar sin reintentar (p_retry = false) cuando reintentar no sirve (falta el CV, la vacante
--      no tiene pesos). Al fallar del todo se avisa a los admins (notification_kind 'task_failed').
--   4. Reintentar o cancelar desde Configuración (solo admin).
--   5. Avisos de permanencia: cuando vence un corte de 30, 90 o 180 días, se avisa una vez al
--      reclutador del candidato y a los admins (placement_followups.notified_at).

alter type public.notification_kind add value if not exists 'followup_due';

alter table public.placement_followups
  add column notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1 y 2. Tomar tareas
-- ---------------------------------------------------------------------------
drop function if exists public.claim_scheduled_tasks(int, text);
drop function if exists public.claim_scheduled_tasks(int, text, uuid);

create or replace function public.claim_scheduled_tasks(
  p_limit  int default 10,
  p_worker text default null,
  p_only   uuid default null
)
returns setof public.scheduled_tasks
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id
    from public.scheduled_tasks
    where (p_only is null or id = p_only)
      and (
        (status = 'pending' and run_at <= now())
        or (status = 'running' and locked_at < now() - interval '10 minutes')
      )
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

-- ---------------------------------------------------------------------------
-- 3. Cerrar una tarea: backoff de 2^intentos minutos, o falla definitiva
-- ---------------------------------------------------------------------------
drop function if exists public.finish_scheduled_task(uuid, boolean, text);
drop function if exists public.finish_scheduled_task(uuid, boolean, text, boolean);

create or replace function public.finish_scheduled_task(
  p_task_id uuid,
  p_ok      boolean,
  p_error   text default null,
  p_retry   boolean default true
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
  elsif not p_retry or v_task.attempts >= v_task.max_attempts then
    update public.scheduled_tasks
    set status = 'failed', finished_at = now(), locked_at = null, locked_by = null, last_error = p_error
    where id = p_task_id
    returning * into v_task;

    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, href)
    select u.id, 'task_failed', 'Falló una tarea automática',
           v_task.type || ': ' || coalesce(left(p_error, 300), 'sin detalle'),
           'scheduled_task', v_task.id, '/configuracion#tareas'
    from public.users u
    where u.is_active and u.role = 'admin';
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

revoke execute on function public.claim_scheduled_tasks(int, text, uuid) from public, anon, authenticated;
revoke execute on function public.finish_scheduled_task(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_scheduled_tasks(int, text, uuid) to service_role;
grant execute on function public.finish_scheduled_task(uuid, boolean, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Reintentar o cancelar (solo admin)
-- ---------------------------------------------------------------------------
create or replace function public.retry_scheduled_task(p_task_id uuid)
returns public.scheduled_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.scheduled_tasks;
begin
  if not app.is_admin() then
    raise exception 'Solo un admin reintenta tareas' using errcode = '42501';
  end if;
  update public.scheduled_tasks
  set status = 'pending', run_at = now(), attempts = 0, last_error = null, finished_at = null, locked_at = null, locked_by = null
  where id = p_task_id and status in ('failed', 'cancelled')
  returning * into v_task;
  if v_task.id is null then
    raise exception 'La tarea no existe o no está fallida ni cancelada' using errcode = 'P0002';
  end if;
  return v_task;
end;
$$;

create or replace function public.cancel_scheduled_task(p_task_id uuid)
returns public.scheduled_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.scheduled_tasks;
begin
  if not app.is_admin() then
    raise exception 'Solo un admin cancela tareas' using errcode = '42501';
  end if;
  update public.scheduled_tasks
  set status = 'cancelled', finished_at = now()
  where id = p_task_id and status = 'pending'
  returning * into v_task;
  if v_task.id is null then
    raise exception 'Solo se cancela una tarea pendiente' using errcode = 'P0002';
  end if;
  return v_task;
end;
$$;

revoke execute on function public.retry_scheduled_task(uuid) from public, anon;
revoke execute on function public.cancel_scheduled_task(uuid) from public, anon;
grant execute on function public.retry_scheduled_task(uuid) to authenticated;
grant execute on function public.cancel_scheduled_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Avisos de permanencia (tarea followups_due, una vez al día)
-- ---------------------------------------------------------------------------
create or replace function public.notify_followups_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in
    select f.id, f.application_id, f.checkpoint_days, c.full_name, p.title, cl.name as client_name
    from public.placement_followups f
    join public.applications a on a.id = f.application_id
    join public.candidates c on c.id = a.candidate_id
    join public.job_profiles p on p.id = a.profile_id
    join public.clients cl on cl.id = p.client_id
    where f.outcome = 'pending'
      and f.notified_at is null
      and f.due_at <= current_date
      and a.stage = 'hired'
    order by f.due_at
    for update of f skip locked
  loop
    perform app.notify_application(
      v_row.application_id,
      'followup_due',
      'Seguimiento de ' || v_row.checkpoint_days || ' días: ¿sigue ' || v_row.full_name || '?',
      v_row.title || ' · ' || v_row.client_name,
      '/candidatos/' || v_row.application_id
    );
    update public.placement_followups set notified_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.notify_followups_due() from public, anon, authenticated;
grant execute on function public.notify_followups_due() to service_role;
