-- Reportes por rango de fechas (plan §12.27). Las vistas v_bi_* suman todo el histórico; estas
-- funciones devuelven las mismas columnas filtradas por un periodo [p_from, p_to). Si las dos
-- fechas vienen nulas, el resultado es igual al de la vista.
--
-- Son security invoker (el default de SQL): corren con los permisos de quien consulta, así que
-- aplican las mismas políticas RLS que las vistas (el reclutador solo ve sus vacantes).
--
-- Qué fecha cuenta en cada una:
--   bi_funnel             postulaciones que llegaron en el periodo y hasta qué etapa avanzaron
--   bi_channel            postulaciones que llegaron en el periodo, por canal
--   bi_stage_durations    estancias en una etapa que empezaron en el periodo
--   bi_discard_reasons    descartes hechos en el periodo
--   bi_prefilter_failures respuestas del prefiltro contestadas en el periodo

create or replace function public.bi_funnel(p_from timestamptz default null, p_to timestamptz default null)
returns table (client_id uuid, profile_id uuid, profile_title text, stage public.application_stage, stage_order int, applications bigint)
language sql
stable
set search_path = ''
as $$
  select p.client_id, p.id, p.title, e.to_stage, app.stage_order(e.to_stage), count(distinct e.application_id)
  from public.application_stage_events e
  join public.applications a on a.id = e.application_id
  join public.job_profiles p on p.id = a.profile_id
  where app.is_staff()
    and (p_from is null or a.applied_at >= p_from)
    and (p_to is null or a.applied_at < p_to)
  group by p.client_id, p.id, p.title, e.to_stage;
$$;

create or replace function public.bi_channel(p_from timestamptz default null, p_to timestamptz default null)
returns table (client_id uuid, profile_id uuid, profile_title text, source_channel public.source_channel, applications bigint, hired bigint, discarded bigint, prefilter_passed bigint)
language sql
stable
set search_path = ''
as $$
  select p.client_id, p.id, p.title, a.source_channel,
         count(*),
         count(*) filter (where a.stage = 'hired'),
         count(*) filter (where a.stage = 'discarded'),
         count(*) filter (where a.prefilter_status = 'passed')
  from public.applications a
  join public.job_profiles p on p.id = a.profile_id
  where app.is_staff()
    and (p_from is null or a.applied_at >= p_from)
    and (p_to is null or a.applied_at < p_to)
  group by p.client_id, p.id, p.title, a.source_channel;
$$;

create or replace function public.bi_stage_durations(p_from timestamptz default null, p_to timestamptz default null)
returns table (client_id uuid, profile_id uuid, profile_title text, stage public.application_stage, stage_order int, samples bigint, avg_hours numeric, median_hours numeric)
language sql
stable
set search_path = ''
as $$
  with spans as (
    select e.application_id, e.to_stage as stage, e.created_at as entered_at,
           lead(e.created_at) over (partition by e.application_id order by e.created_at) as left_at
    from public.application_stage_events e
  )
  select p.client_id, p.id, p.title, s.stage, app.stage_order(s.stage),
         count(*),
         round(avg(extract(epoch from (s.left_at - s.entered_at)) / 3600)::numeric, 1),
         round((percentile_cont(0.5) within group (order by extract(epoch from (s.left_at - s.entered_at)) / 3600))::numeric, 1)
  from spans s
  join public.applications a on a.id = s.application_id
  join public.job_profiles p on p.id = a.profile_id
  where s.left_at is not null
    and app.is_staff()
    and (p_from is null or s.entered_at >= p_from)
    and (p_to is null or s.entered_at < p_to)
  group by p.client_id, p.id, p.title, s.stage;
$$;

create or replace function public.bi_discard_reasons(p_from timestamptz default null, p_to timestamptz default null)
returns table (client_id uuid, profile_id uuid, profile_title text, discarded_from_stage public.application_stage, discard_reason_key public.discard_reason_key, applications bigint)
language sql
stable
set search_path = ''
as $$
  select p.client_id, p.id, p.title, a.discarded_from_stage, a.discard_reason_key, count(*)
  from public.applications a
  join public.job_profiles p on p.id = a.profile_id
  where a.stage = 'discarded'
    and app.is_staff()
    and (p_from is null or a.discarded_at >= p_from)
    and (p_to is null or a.discarded_at < p_to)
  group by p.client_id, p.id, p.title, a.discarded_from_stage, a.discard_reason_key;
$$;

create or replace function public.bi_prefilter_failures(p_from timestamptz default null, p_to timestamptz default null)
returns table (client_id uuid, profile_id uuid, profile_title text, question_key text, answered bigint, failed bigint)
language sql
stable
set search_path = ''
as $$
  select p.client_id, p.id, p.title, pa.question_key, count(*), count(*) filter (where pa.passes = false)
  from public.prefilter_answers pa
  join public.applications a on a.id = pa.application_id
  join public.job_profiles p on p.id = a.profile_id
  where app.is_staff()
    and (p_from is null or pa.answered_at >= p_from)
    and (p_to is null or pa.answered_at < p_to)
  group by p.client_id, p.id, p.title, pa.question_key;
$$;

-- Solo usuarios con sesión (el cliente y anon no): adentro, app.is_staff() deja fuera al cliente igual.
revoke execute on function public.bi_funnel(timestamptz, timestamptz) from public, anon;
revoke execute on function public.bi_channel(timestamptz, timestamptz) from public, anon;
revoke execute on function public.bi_stage_durations(timestamptz, timestamptz) from public, anon;
revoke execute on function public.bi_discard_reasons(timestamptz, timestamptz) from public, anon;
revoke execute on function public.bi_prefilter_failures(timestamptz, timestamptz) from public, anon;
grant execute on function public.bi_funnel(timestamptz, timestamptz) to authenticated;
grant execute on function public.bi_channel(timestamptz, timestamptz) to authenticated;
grant execute on function public.bi_stage_durations(timestamptz, timestamptz) to authenticated;
grant execute on function public.bi_discard_reasons(timestamptz, timestamptz) to authenticated;
grant execute on function public.bi_prefilter_failures(timestamptz, timestamptz) to authenticated;
