-- 0011 · Vistas
--
-- v_pipeline y v_bi_* son security_invoker: aplican las políticas del que consulta.
-- v_portal_* son security definer (dueño postgres) con filtro explícito por
-- app.client_id(): así el cliente ve estado y veredicto pero nunca las columnas
-- internas ni las rutas de archivos.

-- ---------------------------------------------------------------------------
-- v_pipeline: lo que pintan el kanban, la lista y el tablero
-- ---------------------------------------------------------------------------
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
  wc.last_inbound_at                    as wa_last_inbound_at
from public.applications a
join public.candidates c    on c.id = a.candidate_id
join public.job_profiles p  on p.id = a.profile_id
join public.clients cl      on cl.id = p.client_id
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

-- ---------------------------------------------------------------------------
-- Portal del cliente
-- ---------------------------------------------------------------------------
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
  and (p.client_id = app.client_id() or app.is_staff());

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
  and (p.client_id = app.client_id() or app.is_staff());

-- Las vistas definer necesitan grant explícito; las invoker heredan de las tablas.
grant select on public.v_portal_applications to authenticated;
grant select on public.v_portal_documents    to authenticated;

-- ---------------------------------------------------------------------------
-- BI interno (solo staff)
-- ---------------------------------------------------------------------------

-- Embudo: cuántas postulaciones tocaron cada etapa, por perfil
create or replace view public.v_bi_funnel
with (security_invoker = true)
as
select
  p.client_id,
  p.id                          as profile_id,
  p.title                       as profile_title,
  e.to_stage                    as stage,
  app.stage_order(e.to_stage)   as stage_order,
  count(distinct e.application_id) as applications
from public.application_stage_events e
join public.applications a on a.id = e.application_id
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, e.to_stage;

-- Canal: postulantes y contratados por canal de origen
create or replace view public.v_bi_channel
with (security_invoker = true)
as
select
  p.client_id,
  p.id               as profile_id,
  p.title            as profile_title,
  a.source_channel,
  count(*)                                              as applications,
  count(*) filter (where a.stage = 'hired')             as hired,
  count(*) filter (where a.stage = 'discarded')         as discarded,
  count(*) filter (where a.prefilter_status = 'passed') as prefilter_passed
from public.applications a
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, a.source_channel;

-- Duración por etapa: horas entre entrar a una etapa y salir de ella
create or replace view public.v_bi_stage_durations
with (security_invoker = true)
as
with spans as (
  select
    e.application_id,
    e.to_stage                                   as stage,
    e.created_at                                 as entered_at,
    lead(e.created_at) over (partition by e.application_id order by e.created_at) as left_at
  from public.application_stage_events e
)
select
  p.client_id,
  p.id                                   as profile_id,
  p.title                                as profile_title,
  s.stage,
  app.stage_order(s.stage)               as stage_order,
  count(*)                               as samples,
  round(avg(extract(epoch from (s.left_at - s.entered_at)) / 3600)::numeric, 1)    as avg_hours,
  round((percentile_cont(0.5) within group (order by extract(epoch from (s.left_at - s.entered_at)) / 3600))::numeric, 1) as median_hours
from spans s
join public.applications a on a.id = s.application_id
join public.job_profiles p on p.id = a.profile_id
where s.left_at is not null
  and app.is_staff()
group by p.client_id, p.id, p.title, s.stage;

-- Motivos de descarte por perfil y etapa de origen
create or replace view public.v_bi_discard_reasons
with (security_invoker = true)
as
select
  p.client_id,
  p.id                    as profile_id,
  p.title                 as profile_title,
  a.discarded_from_stage,
  a.discard_reason_key,
  count(*)                as applications
from public.applications a
join public.job_profiles p on p.id = a.profile_id
where a.stage = 'discarded'
  and app.is_staff()
group by p.client_id, p.id, p.title, a.discarded_from_stage, a.discard_reason_key;

-- Preguntas del prefiltro que más descartan
create or replace view public.v_bi_prefilter_failures
with (security_invoker = true)
as
select
  p.client_id,
  p.id                 as profile_id,
  p.title              as profile_title,
  pa.question_key,
  count(*)                                   as answered,
  count(*) filter (where pa.passes = false)  as failed
from public.prefilter_answers pa
join public.applications a on a.id = pa.application_id
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, pa.question_key;
