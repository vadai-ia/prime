-- 0034 · Distintivo de contratado (plan §12.28)
--
-- Pedido por el usuario el 27 nov: que la persona contratada lleve un distintivo en la base y que
-- al sacarla de Contratado se le quite. Vive en candidates (la persona, no la postulación) para que
-- se vea en cualquier vacante donde aparezca:
--   hired_badge_at        cuándo la contrataron (null = sin distintivo)
--   hired_application_id  la postulación por la que está contratada
-- Lo mantiene un trigger: al entrar una postulación a Contratado se pone; al salir (cancelar la
-- contratación o descartar) se recalcula con las demás postulaciones contratadas y, si no queda
-- ninguna, se quita. Nadie lo escribe a mano.
--
-- Ver el distintivo no dice de qué cliente: quien no ve esa postulación (RLS) solo ve la fecha.

alter table public.candidates
  add column hired_badge_at timestamptz,
  add column hired_application_id uuid references public.applications (id) on delete set null;

create or replace function app.refresh_hired_badge(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_at timestamptz;
begin
  select a.id, a.hired_at into v_id, v_at
  from public.applications a
  where a.candidate_id = p_candidate_id and a.stage = 'hired'
  order by a.hired_at desc nulls last
  limit 1;

  -- El candado de abajo solo deja pasar el cambio si viene de aquí.
  perform set_config('app.hired_badge_refresh', 'on', true);
  update public.candidates c
  set hired_badge_at = v_at, hired_application_id = v_id
  where c.id = p_candidate_id
    and (c.hired_badge_at is distinct from v_at or c.hired_application_id is distinct from v_id);
  perform set_config('app.hired_badge_refresh', 'off', true);
end;
$$;

revoke execute on function app.refresh_hired_badge(uuid) from public, anon, authenticated;

-- Candado: el distintivo no se escribe a mano (ni al editar el candidato ni al darlo de alta).
create or replace function app.guard_hired_badge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.hired_badge_refresh', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then
      new.hired_badge_at := null;
      new.hired_application_id := null;
    elsif new.hired_application_id is null and old.hired_application_id is not null
          and not exists (select 1 from public.applications a where a.id = old.hired_application_id) then
      -- se borró la postulación (on delete set null): se deja pasar y se quita el distintivo
      new.hired_badge_at := null;
    else
      new.hired_badge_at := old.hired_badge_at;
      new.hired_application_id := old.hired_application_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger candidates_guard_hired_badge
  before insert or update on public.candidates
  for each row execute function app.guard_hired_badge();

create or replace function app.after_application_hired_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app.refresh_hired_badge(old.candidate_id);
    return old;
  end if;
  if tg_op = 'INSERT' or new.stage is distinct from old.stage or new.hired_at is distinct from old.hired_at then
    if new.stage = 'hired' or (tg_op = 'UPDATE' and old.stage = 'hired') then
      perform app.refresh_hired_badge(new.candidate_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger applications_hired_badge
  after insert or update of stage, hired_at or delete on public.applications
  for each row execute function app.after_application_hired_badge();

-- Los que ya estaban contratados reciben su distintivo.
select app.refresh_hired_badge(c.id)
from public.candidates c
where exists (select 1 from public.applications a where a.candidate_id = c.id and a.stage = 'hired')
   or c.hired_badge_at is not null;

-- v_pipeline: las mismas columnas de 0015 y, al final, el distintivo.
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
  ru.full_name                          as assigned_recruiter_name,
  c.hired_badge_at,
  c.hired_application_id
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
