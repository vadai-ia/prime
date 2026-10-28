-- Prime HR · migración 0029 para pegar en el SQL Editor (después de 15_*.sql).
-- El reclutador ve a TODOS los candidatos de las vacantes que trabaja (ya no solo los suyos).
-- Se acaba el reparto por turno: los candidatos nuevos no se asignan a nadie y quitar a un
-- reclutador de una vacante no reparte nada. Los avisos de un candidato llegan a todos los
-- reclutadores de su vacante.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0029.

begin;

-- 0029 · El reclutador ve a todos los candidatos de sus vacantes (27 oct 2026, plan §2.3 y §12.16)
--
-- Antes (0015): cada postulación nueva se asignaba por turno a un reclutador de la vacante y solo
-- él la veía. Ahora la unidad es la vacante: un reclutador asignado a una vacante ve y trabaja a
-- todos sus candidatos, igual que los demás reclutadores de esa vacante. Admin sigue viendo todo.
--
-- - can_access_application / can_access_candidate y las políticas de applications pasan a
--   "la vacante es mía" (app.assigned_profile_ids()).
-- - Sin round robin: next_recruiter_for_profile ya no elige a nadie y nada se reparte al quitar
--   o desactivar a un reclutador. applications.assigned_recruiter_id queda como "quién lo
--   capturó" (alta manual de un reclutador); no decide quién lo ve.
-- - Avisos de un candidato: a los admins y a todos los reclutadores de su vacante.
-- - Candidato nuevo: avisa a los reclutadores de la vacante (menos a quien lo capturó).

-- ---------------------------------------------------------------------------
-- 1. La regla
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
      join public.job_profile_assignments ja on ja.profile_id = a.profile_id
      where a.id = p_application_id
        and ja.recruiter_id = auth.uid()
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
      join public.job_profile_assignments ja on ja.profile_id = a.profile_id
      where a.candidate_id = p_candidate_id
        and ja.recruiter_id = auth.uid()
    )
  )
$$;

drop policy if exists applications_select_recruiter on public.applications;
drop policy if exists applications_select_recruiter on public.applications;
create policy applications_select_recruiter on public.applications for select to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]));

drop policy if exists applications_update_recruiter on public.applications;
drop policy if exists applications_update_recruiter on public.applications;
create policy applications_update_recruiter on public.applications for update to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));

-- ---------------------------------------------------------------------------
-- 2. Sin round robin
-- ---------------------------------------------------------------------------
create or replace function app.next_recruiter_for_profile(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select null::uuid
$$;

create or replace function app.distribute_unassigned_applications(p_profile_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select 0
$$;

-- Quitar a un reclutador de la vacante ya no suelta ni reparte candidatos: los siguen viendo los demás.
create or replace function app.after_profile_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Avisos
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
    and u.id is distinct from auth.uid()
    and (
      u.role = 'admin'
      or u.id in (
        select ja.recruiter_id
        from public.applications a
        join public.job_profile_assignments ja on ja.profile_id = a.profile_id
        where a.id = p_application_id
      )
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function app.notify_application(uuid, public.notification_kind, text, text, text) from public, anon, authenticated;

-- Candidato nuevo: a los reclutadores de la vacante, menos a quien lo capturó.
create or replace function app.notify_candidate_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
begin
  if new.stage in ('discarded', 'hired') then
    return new;
  end if;

  select * into v_ctx from app.application_context(new.id);
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, href)
  select u.id, 'candidate_assigned', 'Nuevo candidato: ' || v_ctx.full_name, v_ctx.context, 'application', new.id, '/candidatos/' || new.id
  from public.users u
  join public.job_profile_assignments ja on ja.recruiter_id = u.id and ja.profile_id = new.profile_id
  where u.is_active
    and u.id is distinct from auth.uid();
  return new;
end;
$$;

drop trigger if exists applications_notify_assigned on public.applications;
drop trigger if exists applications_notify_assigned on public.applications;
create trigger applications_notify_assigned
  after insert on public.applications
  for each row execute function app.notify_candidate_assigned();


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0029', 'vacancy_scope')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select p.proname, pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'app'),
  pol as (select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'applications'),
  checks (orden, objeto, ok) as (
    values
      (1, 'can_access_application por vacante',
          exists (select 1 from fn where proname = 'can_access_application' and def not like '%assigned_recruiter_id%')),
      (2, 'can_access_candidate por vacante',
          exists (select 1 from fn where proname = 'can_access_candidate' and def not like '%assigned_recruiter_id%')),
      (3, 'applications: el reclutador ve toda su vacante',
          exists (select 1 from pol where policyname = 'applications_select_recruiter' and qual not like '%assigned_recruiter_id%')),
      (4, 'sin reparto por turno',
          exists (select 1 from fn where proname = 'next_recruiter_for_profile' and def not like '%turn_seq%')),
      (5, 'avisos a los reclutadores de la vacante',
          exists (select 1 from fn where proname = 'notify_application' and def like '%job_profile_assignments%'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
