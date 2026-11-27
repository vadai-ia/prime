-- 0032 · Candidatos sugeridos de otras vacantes (27 nov 2026, plan §12.25)
--
-- Al abrir una vacante, el admin pide "Buscar candidatos de otras vacantes": el sistema toma a las
-- personas que ya pasaron por Prime en cualquier otra vacante (de cualquier cliente), las ordena por
-- qué tanto su CV se parece a la vacante y la IA califica a las mejores con los criterios de la
-- vacante. Solo el admin ve las sugerencias (decidido con el usuario el 27 nov): para el reclutador
-- sería ver candidatos de vacantes que no trabaja (§2.3). Cuando el admin trae a alguien, se crea una
-- postulación normal (canal "Bolsa Prime") y desde ahí la ven los reclutadores de la vacante.
--
-- Quién entra a la búsqueda: todos (no hace falta marcarlos en la bolsa), menos
--   - lista negra,
--   - quien sigue en proceso en alguna vacante (etapa distinta de Descartado y Contratado),
--   - quien está trabajando por Prime (Contratado sin un seguimiento "se fue"),
--   - quien ya está postulado a esta vacante,
--   - quien ya fue sugerido para esta vacante (sugerido, traído o descartado: no se repite).

-- ---------------------------------------------------------------------------
-- 1. Permiso (espejo en src/lib/auth/permissions.ts)
-- ---------------------------------------------------------------------------
create or replace function app.has_permission(p_permission text)
returns boolean
language sql
stable
as $$
  select case p_permission
    when 'manage_assignments'       then app.is_admin()
    when 'export'                   then app.is_admin()
    when 'view_inactive_candidates' then app.is_admin()
    when 'view_blacklist'           then app.is_admin()
    when 'suggest_candidates'       then app.is_admin()
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. Búsqueda de texto sobre el CV (español: "vendedora" encuentra "vendedor", "ventas")
-- ---------------------------------------------------------------------------
alter table public.candidates
  add column cv_tsv tsvector generated always as (to_tsvector('spanish'::regconfig, coalesce(cv_text, '') || ' ' || coalesce(cv_summary, ''))) stored;

create index candidates_cv_tsv_idx on public.candidates using gin (cv_tsv);

-- ---------------------------------------------------------------------------
-- 3. Sugerencias
-- ---------------------------------------------------------------------------
create type public.suggestion_status as enum ('pending', 'scored', 'failed', 'added', 'dismissed');

create table public.profile_candidate_suggestions (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.job_profiles (id) on delete cascade,
  candidate_id          uuid not null references public.candidates (id) on delete cascade,
  source_application_id uuid references public.applications (id) on delete set null,  -- su postulación más reciente en otra vacante
  match_rank            real not null default 0,                                        -- parecido del CV con la vacante (texto), para ordenar antes de la IA
  status                public.suggestion_status not null default 'pending',
  cv_score              int check (cv_score between 0 and 100),
  cv_score_breakdown    jsonb,
  cv_score_version      int,                                                            -- job_profile_ai_configs.cv_version usada
  rationale             text,
  flags                 text,
  error                 text,
  scored_at             timestamptz,
  added_application_id  uuid references public.applications (id) on delete set null,
  decided_by            uuid references public.users (id) on delete set null,
  decided_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profile_candidate_suggestions_key unique (profile_id, candidate_id)
);

create index profile_candidate_suggestions_profile_idx on public.profile_candidate_suggestions (profile_id, status);

create trigger profile_candidate_suggestions_set_updated_at
  before update on public.profile_candidate_suggestions
  for each row execute function app.set_updated_at();

-- Solo admin lee y decide (traer o descartar). Las filas las crea y califica la cola (service role).
alter table public.profile_candidate_suggestions enable row level security;

create policy profile_candidate_suggestions_select_admin on public.profile_candidate_suggestions for select to authenticated
  using ((select app.has_permission('suggest_candidates')));

create policy profile_candidate_suggestions_update_admin on public.profile_candidate_suggestions for update to authenticated
  using ((select app.has_permission('suggest_candidates')))
  with check ((select app.has_permission('suggest_candidates')));

-- ---------------------------------------------------------------------------
-- 4. A quién se busca: los mejores N por parecido del CV con la vacante
-- ---------------------------------------------------------------------------
-- Solo para la cola (service role): devuelve personas de otras vacantes, sin pasar por RLS.
create or replace function public.suggestion_pool(p_profile_id uuid, p_limit int default 12)
returns table (candidate_id uuid, source_application_id uuid, match_rank real)
language sql
stable
security definer
set search_path = public
as $$
  with prof as (
    select
      p.id,
      -- el puesto pesa más; requisitos y actividades suman
      replace(plainto_tsquery('spanish'::regconfig, p.title)::text, '&', '|') as q_title,
      replace(plainto_tsquery('spanish'::regconfig, concat_ws(' ',
        p.title,
        (select string_agg(v.value, ' ') from jsonb_each_text(p.requirements) v),
        array_to_string(p.activities, ' ')
      ))::text, '&', '|') as q_all
    from public.job_profiles p
    where p.id = p_profile_id
  ),
  q as (
    select
      id,
      case when q_title = '' then null else q_title::tsquery end as q_title,
      case when q_all = '' then null else q_all::tsquery end as q_all
    from prof
  ),
  eligible as (
    select c.id, c.cv_tsv
    from public.candidates c, q
    where q.q_all is not null
      and c.cv_tsv @@ q.q_all
      -- ya está en esta vacante o ya se le sugirió
      and not exists (select 1 from public.applications a where a.candidate_id = c.id and a.profile_id = p_profile_id)
      and not exists (select 1 from public.profile_candidate_suggestions s where s.candidate_id = c.id and s.profile_id = p_profile_id)
      -- en proceso en otra vacante
      and not exists (select 1 from public.applications a where a.candidate_id = c.id and a.stage not in ('discarded', 'hired'))
      -- trabajando por Prime: contratado sin un seguimiento "se fue"
      and not exists (
        select 1 from public.applications a
        where a.candidate_id = c.id and a.stage = 'hired'
          and not exists (select 1 from public.placement_followups f where f.application_id = a.id and f.outcome = 'left')
      )
      -- lista negra
      and app.blacklist_entry_for(c.id, c.phone_e164, c.curp, c.email) is null
  )
  select
    e.id,
    (select a.id from public.applications a where a.candidate_id = e.id order by a.stage_changed_at desc, a.id limit 1),
    (2 * coalesce(ts_rank(e.cv_tsv, q.q_title), 0) + ts_rank(e.cv_tsv, q.q_all))::real as match_rank
  from eligible e, q
  order by match_rank desc, e.id
  limit greatest(1, least(p_limit, 50))
$$;

revoke execute on function public.suggestion_pool(uuid, int) from public, anon, authenticated;
grant execute on function public.suggestion_pool(uuid, int) to service_role;
