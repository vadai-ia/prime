-- 0015 · Candidatos por reclutador: round robin y "solo lo asignado a mí"
--
-- Continúa 0014 con las tablas de candidatos, que ya existen. Decisiones de la junta (11 sep 2026):
--   · Cada candidato que entra a una vacante se asigna por turno (round robin) a uno de
--     los reclutadores de esa vacante. Si lo captura un reclutador a mano, es suyo.
--   · El reclutador solo ve las postulaciones asignadas a él, en vacantes que sigue
--     trabajando. Dos reclutadores de la misma vacante no ven los candidatos del otro.
--   · Solo un admin reasigna. Al quitar a un reclutador de una vacante (o desactivarlo),
--     sus candidatos en proceso se reparten entre los que quedan; si no queda nadie,
--     quedan sin asignar y solo los ve el admin.

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
-- Turno del round robin: recibe quien tiene el turno más viejo (null = nunca ha recibido).
-- Es una secuencia y no una fecha para que un lote en una sola sentencia no empate.
create sequence app.recruiter_turn_seq;

alter table public.job_profile_assignments
  add column turn_seq          bigint,
  add column last_candidate_at timestamptz;   -- informativo: cuándo recibió su último candidato

alter table public.applications
  add column assigned_recruiter_id uuid references public.users (id) on delete set null,
  add column assigned_at           timestamptz;

create index applications_assigned_recruiter_idx on public.applications (assigned_recruiter_id, stage);

-- ---------------------------------------------------------------------------
-- 2. La regla para todo lo que cuelga de una postulación o de un candidato
-- ---------------------------------------------------------------------------
create or replace function app.can_access_application(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.is_admin() or (
    app.role() = 'recruiter'
    and exists (
      select 1
      from public.applications a
      join public.job_profile_assignments ja
        on ja.profile_id = a.profile_id and ja.recruiter_id = a.assigned_recruiter_id
      where a.id = p_application_id
        and a.assigned_recruiter_id = auth.uid()
    )
  )
$$;

create or replace function app.can_access_candidate(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app.is_admin() or (
    app.role() = 'recruiter'
    and exists (
      select 1
      from public.applications a
      join public.job_profile_assignments ja
        on ja.profile_id = a.profile_id and ja.recruiter_id = a.assigned_recruiter_id
      where a.candidate_id = p_candidate_id
        and a.assigned_recruiter_id = auth.uid()
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Round robin
-- ---------------------------------------------------------------------------
-- Siguiente reclutador de la vacante y avanza el turno. El FOR UPDATE serializa
-- altas simultáneas a la misma vacante. Null si la vacante no tiene reclutadores.
create or replace function app.next_recruiter_for_profile(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recruiter uuid;
begin
  select a.recruiter_id into v_recruiter
  from public.job_profile_assignments a
  where a.profile_id = p_profile_id
  order by a.turn_seq asc nulls first, a.assigned_at asc, a.recruiter_id
  limit 1
  for update;

  if v_recruiter is not null then
    update public.job_profile_assignments
    set turn_seq = nextval('app.recruiter_turn_seq'), last_candidate_at = now()
    where profile_id = p_profile_id and recruiter_id = v_recruiter;
  end if;
  return v_recruiter;
end;
$$;

create or replace function app.before_application_insert_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if app.role() = 'recruiter' then
    -- alta manual: el candidato es de quien lo captura (la política de insert exige que la vacante sea suya)
    new.assigned_recruiter_id := auth.uid();
  elsif new.assigned_recruiter_id is null then
    new.assigned_recruiter_id := app.next_recruiter_for_profile(new.profile_id);
  elsif not exists (
    select 1 from public.job_profile_assignments
    where profile_id = new.profile_id and recruiter_id = new.assigned_recruiter_id
  ) then
    raise exception 'El reclutador no está asignado a esta vacante' using errcode = '23514';
  end if;

  new.assigned_at := case when new.assigned_recruiter_id is not null then now() end;
  return new;
end;
$$;

create trigger applications_before_insert_assign
  before insert on public.applications
  for each row execute function app.before_application_insert_assign();

-- Reasignar: solo admin (o el sistema), y solo a alguien que trabaje la vacante.
create or replace function app.guard_application_reassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_recruiter_id is not distinct from old.assigned_recruiter_id then
    return new;
  end if;

  if not (app.is_admin() or app.is_service() or coalesce(current_setting('app.reassigning', true), '') = 'on') then
    raise exception 'Solo un administrador reasigna candidatos' using errcode = '42501';
  end if;

  if new.assigned_recruiter_id is not null and not exists (
    select 1 from public.job_profile_assignments
    where profile_id = new.profile_id and recruiter_id = new.assigned_recruiter_id
  ) then
    raise exception 'El reclutador no está asignado a esta vacante' using errcode = '23514';
  end if;

  new.assigned_at := case when new.assigned_recruiter_id is not null then now() end;
  return new;
end;
$$;

create trigger applications_guard_reassign
  before update of assigned_recruiter_id on public.applications
  for each row execute function app.guard_application_reassign();

-- Reparte por turno las postulaciones en proceso que no tienen reclutador.
create or replace function app.distribute_unassigned_applications(p_profile_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app   record;
  v_count int := 0;
begin
  if not exists (select 1 from public.job_profile_assignments where profile_id = p_profile_id) then
    return 0;
  end if;

  perform set_config('app.reassigning', 'on', true);
  for v_app in
    select id from public.applications
    where profile_id = p_profile_id
      and assigned_recruiter_id is null
      and stage not in ('hired', 'discarded')
    order by applied_at, id
    for update
  loop
    update public.applications
    set assigned_recruiter_id = app.next_recruiter_for_profile(p_profile_id)
    where id = v_app.id;
    v_count := v_count + 1;
  end loop;
  perform set_config('app.reassigning', '', true);
  return v_count;
end;
$$;

-- Cambió quién trabaja la vacante: se sueltan los candidatos en proceso del que sale
-- y se reparte lo que esté sin asignar entre los que quedan.
create or replace function app.after_profile_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform set_config('app.reassigning', 'on', true);
    update public.applications
    set assigned_recruiter_id = null
    where profile_id = old.profile_id
      and assigned_recruiter_id = old.recruiter_id
      and stage not in ('hired', 'discarded');
    perform set_config('app.reassigning', '', true);

    perform app.distribute_unassigned_applications(old.profile_id);
    return old;
  end if;

  perform app.distribute_unassigned_applications(new.profile_id);
  return new;
end;
$$;

create trigger job_profile_assignments_redistribute
  after insert or delete on public.job_profile_assignments
  for each row execute function app.after_profile_assignment_change();

-- internas: solo las llaman los triggers (que corren como dueño)
revoke execute on function app.next_recruiter_for_profile(uuid)         from public, anon, authenticated;
revoke execute on function app.distribute_unassigned_applications(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Alta manual de un candidato que ya existe: el reclutador no ve candidatos
--    ajenos, así que el teléfono se resuelve aquí. Solo devuelve el id.
-- ---------------------------------------------------------------------------
create or replace function public.find_candidate_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.candidates c
  where c.phone_e164 = p_phone
    and app.is_staff()
$$;

revoke execute on function public.find_candidate_by_phone from public, anon;
grant execute on function public.find_candidate_by_phone to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Políticas: "staff" pasa a ser admin, o reclutador con la postulación asignada
-- ---------------------------------------------------------------------------

-- candidates · el reclutador crea; lee y edita solo a sus candidatos; borrar es de admin
drop policy candidates_all_staff on public.candidates;
create policy candidates_all_admin on public.candidates for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy candidates_select_recruiter on public.candidates for select to authenticated
  using ((select app.role()) = 'recruiter' and app.can_access_candidate(id));
create policy candidates_insert_recruiter on public.candidates for insert to authenticated
  with check ((select app.role()) = 'recruiter');
create policy candidates_update_recruiter on public.candidates for update to authenticated
  using ((select app.role()) = 'recruiter' and app.can_access_candidate(id))
  with check ((select app.role()) = 'recruiter');

-- applications
drop policy applications_select_staff on public.applications;
drop policy applications_insert_staff on public.applications;
drop policy applications_update_staff on public.applications;
create policy applications_select_admin on public.applications for select to authenticated
  using ((select app.is_admin()));
create policy applications_select_recruiter on public.applications for select to authenticated
  using (
    assigned_recruiter_id = (select auth.uid())
    and profile_id = any ((select app.assigned_profile_ids())::uuid[])
  );
create policy applications_insert_admin on public.applications for insert to authenticated
  with check ((select app.is_admin()));
create policy applications_insert_recruiter on public.applications for insert to authenticated
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
create policy applications_update_admin on public.applications for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy applications_update_recruiter on public.applications for update to authenticated
  using (
    assigned_recruiter_id = (select auth.uid())
    and profile_id = any ((select app.assigned_profile_ids())::uuid[])
  )
  with check (
    assigned_recruiter_id = (select auth.uid())
    and profile_id = any ((select app.assigned_profile_ids())::uuid[])
  );

-- application_stage_events · prefilter_answers
drop policy stage_events_select_staff on public.application_stage_events;
drop policy stage_events_insert_staff on public.application_stage_events;
create policy stage_events_select_staff on public.application_stage_events for select to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id));
create policy stage_events_insert_staff on public.application_stage_events for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy prefilter_answers_select_staff on public.prefilter_answers;
drop policy prefilter_answers_insert_staff on public.prefilter_answers;
create policy prefilter_answers_select_staff on public.prefilter_answers for select to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id));
create policy prefilter_answers_insert_staff on public.prefilter_answers for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_application(application_id));

-- WhatsApp: la conversación es de la persona
drop policy wa_conversations_select_staff on public.wa_conversations;
drop policy wa_conversations_insert_staff on public.wa_conversations;
drop policy wa_conversations_update_staff on public.wa_conversations;
create policy wa_conversations_select_staff on public.wa_conversations for select to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id));
create policy wa_conversations_insert_staff on public.wa_conversations for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));
create policy wa_conversations_update_staff on public.wa_conversations for update to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id))
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));

drop policy wa_messages_select_staff on public.wa_messages;
drop policy wa_messages_insert_staff on public.wa_messages;
drop policy wa_messages_update_staff on public.wa_messages;
create policy wa_messages_select_staff on public.wa_messages for select to authenticated
  using (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  );
create policy wa_messages_insert_staff on public.wa_messages for insert to authenticated
  with check (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  );
create policy wa_messages_update_staff on public.wa_messages for update to authenticated
  using (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  )
  with check (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  );

-- interviews · interview_transcripts
drop policy interviews_all_staff on public.interviews;
create policy interviews_all_staff on public.interviews for all to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id))
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy interview_transcripts_select_staff on public.interview_transcripts;
create policy interview_transcripts_select_staff on public.interview_transcripts for select to authenticated
  using (
    (select app.is_admin())
    or exists (select 1 from public.interviews i where i.id = interview_id and app.can_access_application(i.application_id))
  );

-- psychometric_tests · candidate_documents · placement_followups
drop policy psychometric_tests_all_staff on public.psychometric_tests;
create policy psychometric_tests_all_staff on public.psychometric_tests for all to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id))
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy candidate_documents_all_staff on public.candidate_documents;
create policy candidate_documents_all_staff on public.candidate_documents for all to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id))
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));

drop policy placement_followups_all_staff on public.placement_followups;
create policy placement_followups_all_staff on public.placement_followups for all to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id))
  with check ((select app.is_admin()) or app.can_access_application(application_id));

-- ---------------------------------------------------------------------------
-- 6. Notificaciones: lo de un candidato avisa a los admins y a su reclutador,
--    no a todo el staff. notify_staff queda para avisos generales del sistema.
-- ---------------------------------------------------------------------------
create or replace function app.notify_application(
  p_application_id uuid,
  p_kind           public.notification_kind,
  p_title          text,
  p_body           text default null,
  p_href           text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, href)
  select u.id, p_kind, p_title, p_body, 'application', p_application_id, p_href
  from public.users u
  where u.is_active
    and (
      u.role = 'admin'
      or u.id = (select a.assigned_recruiter_id from public.applications a where a.id = p_application_id)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function app.notify_application(uuid, public.notification_kind, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_staff from authenticated;

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
  v_name   text;
  v_title  text;
  v_client_name text;
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

  select c.full_name, p.title, cl.name into v_name, v_title, v_client_name
  from public.candidates c, public.job_profiles p
  join public.clients cl on cl.id = p.client_id
  where c.id = v_app.candidate_id and p.id = v_app.profile_id;

  perform app.notify_application(
    v_app.id,
    'client_decision',
    case p_decision when 'approve' then v_client_name || ' dio Vo.Bo. a ' || v_name else v_client_name || ' no continúa con ' || v_name end,
    v_title || case when p_comment is not null then ' · ' || p_comment else '' end,
    '/candidatos/' || v_app.id
  );

  return jsonb_build_object('id', v_app.id, 'stage', v_app.stage, 'decided_at', v_app.client_decision_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Vistas
-- ---------------------------------------------------------------------------
-- v_pipeline: mismas columnas más el reclutador asignado (para la ficha y el filtro del admin).
-- Es security_invoker: hereda las políticas de arriba.
create or replace view public.v_pipeline
with (security_invoker = true)
as
select
  a.id                                  as application_id,
  a.candidate_id,
  a.profile_id,
  p.client_id,
  cl.name                               as client_name,
  p.title                               as profile_title,
  c.full_name,
  c.first_name,
  c.phone_e164,
  c.email,
  c.zone,
  c.municipality,
  c.age_reported,
  c.education_level,
  c.cv_file_path,
  a.stage,
  app.stage_order(a.stage)              as stage_order,
  a.stage_changed_at,
  a.applied_at,
  a.source_channel,
  a.prefilter_status,
  a.cv_score,
  ac.cv_threshold,
  a.commute_minutes,
  a.experience_months,
  a.salary_expectation,
  a.available,
  a.ai_note,
  a.discard_reason_key,
  a.discard_reason,
  a.discarded_from_stage,
  a.client_decision,
  a.hired_at,
  greatest(0, floor(extract(epoch from (now() - a.stage_changed_at)) / 86400))::int as days_in_stage,
  pi.id                                 as prime_interview_id,
  pi.status                             as prime_interview_status,
  pi.scheduled_at                       as prime_interview_at,
  pi.score                              as prime_interview_score,
  ci.id                                 as client_interview_id,
  ci.status                             as client_interview_status,
  ci.scheduled_at                       as client_interview_at,
  ps.status                             as psych_status,
  ps.verdict                            as psych_verdict,
  ps.fit_pct                            as psych_fit_pct,
  coalesce(d.validated_count, 0)::int   as docs_validated,
  coalesce(d.pending_review_count, 0)::int as docs_in_review,
  dt.required_count::int                as docs_required,
  wc.ai_paused                          as wa_ai_paused,
  wc.status                             as wa_status,
  wc.last_inbound_at                    as wa_last_inbound_at,
  a.assigned_recruiter_id,
  ru.full_name                          as assigned_recruiter_name
from public.applications a
join public.candidates c    on c.id = a.candidate_id
join public.job_profiles p  on p.id = a.profile_id
join public.clients cl      on cl.id = p.client_id
left join public.users ru   on ru.id = a.assigned_recruiter_id
left join public.job_profile_ai_configs ac on ac.profile_id = p.id
left join lateral (
  select i.id, i.status, i.scheduled_at, i.score
  from public.interviews i
  where i.application_id = a.id and i.type = 'prime' and i.status <> 'cancelled'
  order by i.scheduled_at desc nulls last
  limit 1
) pi on true
left join lateral (
  select i.id, i.status, i.scheduled_at
  from public.interviews i
  where i.application_id = a.id and i.type = 'client' and i.status <> 'cancelled'
  order by i.scheduled_at desc nulls last
  limit 1
) ci on true
left join lateral (
  select t.status, t.verdict, t.fit_pct
  from public.psychometric_tests t
  where t.application_id = a.id
  order by t.created_at desc
  limit 1
) ps on true
left join lateral (
  select
    count(*) filter (where cd.status = 'validated')                as validated_count,
    count(*) filter (where cd.status in ('received', 'in_review')) as pending_review_count
  from public.candidate_documents cd
  where cd.candidate_id = a.candidate_id and cd.status <> 'rejected'
) d on true
cross join lateral (
  select count(*) as required_count from public.document_types where required
) dt
left join lateral (
  select w.ai_paused, w.status, w.last_inbound_at
  from public.wa_conversations w
  where w.candidate_id = a.candidate_id
  order by (w.application_id = a.id) desc nulls last, w.created_at desc
  limit 1
) wc on true
where (select app.is_staff());

-- Vistas del portal (security definer): antes cualquier staff las leía completas.
create or replace view public.v_portal_applications
with (security_invoker = false)
as
select
  a.id                                  as application_id,
  a.profile_id,
  p.client_id,
  p.title                               as profile_title,
  c.full_name,
  c.zone,
  c.municipality,
  c.education_level,
  a.stage,
  app.stage_order(a.stage)              as stage_order,
  a.stage_changed_at,
  a.applied_at,
  a.discarded_from_stage,
  a.client_decision,
  a.client_decision_at,
  a.hired_at,
  pi.scheduled_at                       as prime_interview_at,
  pi.summary                            as prime_interview_summary,
  pi.score                              as prime_interview_score,
  ps.verdict                            as psych_verdict,
  ps.fit_pct                            as psych_fit_pct,
  coalesce(d.validated_count, 0)::int   as docs_validated,
  dt.required_count::int                as docs_required,
  ci.scheduled_at                       as client_interview_at,
  ci.status                             as client_interview_status,
  ci.meeting_url                        as client_interview_url
from public.applications a
join public.candidates c    on c.id = a.candidate_id
join public.job_profiles p  on p.id = a.profile_id
left join lateral (
  select i.scheduled_at, i.summary, i.score
  from public.interviews i
  where i.application_id = a.id and i.type = 'prime' and i.status <> 'cancelled'
  order by i.scheduled_at desc nulls last
  limit 1
) pi on true
left join lateral (
  select i.scheduled_at, i.status, i.meeting_url
  from public.interviews i
  where i.application_id = a.id and i.type = 'client' and i.status <> 'cancelled'
  order by i.scheduled_at desc nulls last
  limit 1
) ci on true
left join lateral (
  select t.verdict, t.fit_pct
  from public.psychometric_tests t
  where t.application_id = a.id and t.status = 'parsed'
  order by t.created_at desc
  limit 1
) ps on true
left join lateral (
  select count(*) filter (where cd.status = 'validated') as validated_count
  from public.candidate_documents cd
  where cd.candidate_id = a.candidate_id and cd.status <> 'rejected'
) d on true
cross join lateral (
  select count(*) as required_count from public.document_types where required
) dt
where app.client_visible(a.stage, a.discarded_from_stage)
  and (p.client_id = app.client_id() or app.can_access_application(a.id));

create or replace view public.v_portal_documents
with (security_invoker = false)
as
select
  a.id                 as application_id,
  cd.document_type_key,
  dtp.label,
  dtp.required,
  dtp.sort_order,
  cd.status,
  cd.validated_at
from public.applications a
join public.job_profiles p on p.id = a.profile_id
join public.candidate_documents cd on cd.candidate_id = a.candidate_id and cd.status <> 'rejected'
join public.document_types dtp on dtp.key = cd.document_type_key
where app.client_visible(a.stage, a.discarded_from_stage)
  and (p.client_id = app.client_id() or app.can_access_application(a.id));
