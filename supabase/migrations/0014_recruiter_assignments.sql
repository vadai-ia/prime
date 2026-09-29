-- 0014 · Asignación de reclutadores por perfil de puesto y visibilidad acotada
--
-- Decisión de la junta con Prime (11 sep 2026): el reclutador ya no ve todo.
--   · La asignación vive en el perfil: un admin marca qué reclutadores lo trabajan
--     y lo cambia cuando quiera. El reclutador nunca se asigna solo.
--   · El reclutador solo lee sus perfiles asignados y los clientes de esos perfiles.
--   · Exportar, base de inactivos y lista negra son solo de admin (app.has_permission).
-- La regla se expresa una vez (app.assigned_profile_ids) y la reutilizan las
-- políticas de esta migración y las de candidatos (0015).

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create type public.assignment_action as enum ('assigned', 'unassigned');
create type public.assignment_source as enum ('manual', 'user_deactivated', 'role_changed');

create table public.job_profile_assignments (
  profile_id   uuid not null references public.job_profiles (id) on delete cascade,
  recruiter_id uuid not null references public.users (id) on delete cascade,
  assigned_by  uuid references public.users (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (profile_id, recruiter_id)
);

create index job_profile_assignments_recruiter_idx on public.job_profile_assignments (recruiter_id);

-- Historial: quién asignó o quitó a quién y cuándo. Solo lo escribe el trigger.
create table public.job_profile_assignment_events (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.job_profiles (id) on delete cascade,
  recruiter_id  uuid not null references public.users (id) on delete cascade,
  action        public.assignment_action not null,
  source        public.assignment_source not null default 'manual',
  actor_user_id uuid references public.users (id) on delete set null,   -- null = sistema (service role)
  created_at    timestamptz not null default clock_timestamp()
);

create index job_profile_assignment_events_profile_idx on public.job_profile_assignment_events (profile_id, created_at desc);
create index job_profile_assignment_events_recruiter_idx on public.job_profile_assignment_events (recruiter_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. La regla de visibilidad, una sola vez. Leen la tabla (no el JWT): un cambio
--    de asignación aplica en la siguiente consulta, sin volver a iniciar sesión.
--    Security definer para que las políticas no recursen RLS.
-- ---------------------------------------------------------------------------
create or replace function app.assigned_profile_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(a.profile_id), '{}'::uuid[])
  from public.job_profile_assignments a
  where a.recruiter_id = auth.uid()
    and app.role() = 'recruiter'
$$;

create or replace function app.assigned_client_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct p.client_id), '{}'::uuid[])
  from public.job_profile_assignments a
  join public.job_profiles p on p.id = a.profile_id
  where a.recruiter_id = auth.uid()
    and app.role() = 'recruiter'
$$;

-- Para RPCs y triggers. En políticas se usa la forma con (select ...) para que
-- Postgres evalúe el arreglo una vez por consulta y no por fila.
create or replace function app.can_access_profile(p_profile_id uuid)
returns boolean
language sql
stable
as $$
  select app.is_admin() or p_profile_id = any (app.assigned_profile_ids())
$$;

create or replace function app.can_access_client(p_client_id uuid)
returns boolean
language sql
stable
as $$
  select app.is_admin() or p_client_id = any (app.assigned_client_ids())
$$;

-- Permisos que no dependen de la asignación. Los módulos que vengan (exportación,
-- inactivos, lista negra) consultan aquí; en TypeScript el espejo es src/lib/auth/permissions.ts.
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
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- 3. Triggers de la asignación
-- ---------------------------------------------------------------------------
create or replace function app.before_profile_assignment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users u
    where u.id = new.recruiter_id and u.role = 'recruiter' and u.is_active
  ) then
    raise exception 'Solo se asignan reclutadores activos' using errcode = '23514';
  end if;

  -- con sesión de usuario, quien asigna es quien está en sesión (no se puede suplantar)
  if auth.uid() is not null then
    new.assigned_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger job_profile_assignments_before_insert
  before insert on public.job_profile_assignments
  for each row execute function app.before_profile_assignment_insert();

create or replace function app.log_profile_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.assignment_source :=
    coalesce(nullif(current_setting('app.assignment_source', true), ''), 'manual')::public.assignment_source;
begin
  if tg_op = 'DELETE' then
    -- borrado en cascada del perfil o del usuario: ya no hay a quién referir el evento
    if not exists (select 1 from public.job_profiles where id = old.profile_id)
       or not exists (select 1 from public.users where id = old.recruiter_id) then
      return old;
    end if;
    insert into public.job_profile_assignment_events (profile_id, recruiter_id, action, source, actor_user_id)
    values (old.profile_id, old.recruiter_id, 'unassigned', v_source, auth.uid());
    return old;
  end if;

  insert into public.job_profile_assignment_events (profile_id, recruiter_id, action, source, actor_user_id)
  values (new.profile_id, new.recruiter_id, 'assigned', v_source, auth.uid());
  return new;
end;
$$;

create trigger job_profile_assignments_log
  after insert or delete on public.job_profile_assignments
  for each row execute function app.log_profile_assignment();

-- Desactivar a un usuario (o quitarle el rol de reclutador) lo saca de todas sus vacantes.
create or replace function app.release_assignments_on_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_active and not new.is_active then
    perform set_config('app.assignment_source', 'user_deactivated', true);
  elsif old.role = 'recruiter' and new.role <> 'recruiter' then
    perform set_config('app.assignment_source', 'role_changed', true);
  else
    return new;
  end if;

  delete from public.job_profile_assignments where recruiter_id = new.id;
  perform set_config('app.assignment_source', '', true);
  return new;
end;
$$;

create trigger users_release_assignments
  after update of is_active, role on public.users
  for each row execute function app.release_assignments_on_user_change();

-- ---------------------------------------------------------------------------
-- 4. RPC del checklist: deja asignados exactamente a p_recruiter_ids. Solo toca
--    las diferencias, así el historial registra cambios reales. Security invoker:
--    además del chequeo explícito, aplican las políticas de abajo.
-- ---------------------------------------------------------------------------
create or replace function public.set_profile_recruiters(
  p_profile_id    uuid,
  p_recruiter_ids uuid[]
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids   uuid[] := coalesce(p_recruiter_ids, '{}'::uuid[]);
  v_count int;
begin
  if not (app.has_permission('manage_assignments') or app.is_service()) then
    raise exception 'Solo un administrador cambia la asignación de reclutadores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.job_profiles where id = p_profile_id) then
    raise exception 'Perfil de puesto no encontrado' using errcode = 'P0002';
  end if;

  -- primero las altas y luego las bajas: al quitar a alguien, sus candidatos se
  -- reparten entre todos los que quedan, incluidos los recién agregados (0015)
  insert into public.job_profile_assignments (profile_id, recruiter_id)
  select p_profile_id, r.id
  from (select distinct unnest(v_ids) as id) r
  on conflict (profile_id, recruiter_id) do nothing;

  delete from public.job_profile_assignments
  where profile_id = p_profile_id
    and recruiter_id <> all (v_ids);

  select count(*) into v_count from public.job_profile_assignments where profile_id = p_profile_id;
  return v_count;
end;
$$;

revoke execute on function public.set_profile_recruiters from public, anon;
grant execute on function public.set_profile_recruiters to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RLS de las tablas nuevas
-- ---------------------------------------------------------------------------
alter table public.job_profile_assignments       enable row level security;
alter table public.job_profile_assignment_events enable row level security;

create policy job_profile_assignments_all_admin on public.job_profile_assignments for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
-- el reclutador lee sus propias filas (para saber qué trabaja), nunca las escribe
create policy job_profile_assignments_select_own on public.job_profile_assignments for select to authenticated
  using (recruiter_id = (select auth.uid()));

-- historial: solo admin lo lee; lo escribe el trigger
create policy job_profile_assignment_events_select_admin on public.job_profile_assignment_events for select to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Políticas que cambian: donde decía "staff" ahora es admin, o reclutador asignado
-- ---------------------------------------------------------------------------

-- users · el reclutador ve al staff y a los contactos de sus clientes
drop policy users_select_staff on public.users;
create policy users_select_admin on public.users for select to authenticated
  using ((select app.is_admin()));
create policy users_select_recruiter on public.users for select to authenticated
  using (
    (select app.role()) = 'recruiter'
    and (role in ('admin', 'recruiter') or client_id = any ((select app.assigned_client_ids())::uuid[]))
  );

-- clients · el reclutador lee solo los clientes detrás de sus perfiles
drop policy clients_select_staff on public.clients;
create policy clients_select_admin on public.clients for select to authenticated
  using ((select app.is_admin()));
create policy clients_select_recruiter on public.clients for select to authenticated
  using (id = any ((select app.assigned_client_ids())::uuid[]));

-- job_profiles · crear vacantes pasa a ser de admin (quien crea decide quién la trabaja)
drop policy job_profiles_select_staff on public.job_profiles;
drop policy job_profiles_insert_staff on public.job_profiles;
drop policy job_profiles_update_staff on public.job_profiles;
create policy job_profiles_select_admin on public.job_profiles for select to authenticated
  using ((select app.is_admin()));
create policy job_profiles_select_recruiter on public.job_profiles for select to authenticated
  using (id = any ((select app.assigned_profile_ids())::uuid[]));
create policy job_profiles_insert_admin on public.job_profiles for insert to authenticated
  with check ((select app.is_admin()));
create policy job_profiles_update_admin on public.job_profiles for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy job_profiles_update_recruiter on public.job_profiles for update to authenticated
  using (id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (id = any ((select app.assigned_profile_ids())::uuid[]));

-- job_profile_ai_configs · sigue al perfil
drop policy job_profile_ai_configs_select_staff on public.job_profile_ai_configs;
drop policy job_profile_ai_configs_insert_staff on public.job_profile_ai_configs;
drop policy job_profile_ai_configs_update_staff on public.job_profile_ai_configs;
create policy job_profile_ai_configs_all_admin on public.job_profile_ai_configs for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy job_profile_ai_configs_select_recruiter on public.job_profile_ai_configs for select to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
create policy job_profile_ai_configs_insert_recruiter on public.job_profile_ai_configs for insert to authenticated
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
create policy job_profile_ai_configs_update_recruiter on public.job_profile_ai_configs for update to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy job_profile_ai_configs_delete_admin on public.job_profile_ai_configs;   -- cubierto por all_admin

-- job_intakes · el reclutador captura levantamientos y ve los suyos o los de sus perfiles
drop policy job_intakes_all_staff on public.job_intakes;
create policy job_intakes_all_admin on public.job_intakes for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy job_intakes_select_recruiter on public.job_intakes for select to authenticated
  using (
    (select app.role()) = 'recruiter'
    and (created_by = (select auth.uid()) or profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  );
create policy job_intakes_insert_recruiter on public.job_intakes for insert to authenticated
  with check (
    (select app.role()) = 'recruiter'
    and created_by = (select auth.uid())
    and profile_id is null
    and (client_id is null or client_id = any ((select app.assigned_client_ids())::uuid[]))
  );
create policy job_intakes_update_recruiter on public.job_intakes for update to authenticated
  using (
    (select app.role()) = 'recruiter'
    and (created_by = (select auth.uid()) or profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  )
  with check (
    (select app.role()) = 'recruiter'
    and (created_by = (select auth.uid()) or profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  );

-- import_batches · sigue al perfil
drop policy import_batches_all_staff on public.import_batches;
create policy import_batches_all_admin on public.import_batches for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy import_batches_all_recruiter on public.import_batches for all to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));

-- report_runs · los reportes por cliente siguen al cliente; el diario interno (client_id null) es de admin
drop policy report_runs_select_staff on public.report_runs;
create policy report_runs_select_admin on public.report_runs for select to authenticated
  using ((select app.is_admin()));
create policy report_runs_select_recruiter on public.report_runs for select to authenticated
  using (client_id = any ((select app.assigned_client_ids())::uuid[]));

-- ---------------------------------------------------------------------------
-- 7. Exportar es de admin desde hoy: cualquier flujo de exportación registra
--    log_audit('export') y aquí se rechaza a quien no tenga el permiso.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action      public.audit_action,
  p_entity_type text,
  p_entity_id   uuid,
  p_ip          text default null,
  p_metadata    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action = 'export' and not (app.has_permission('export') or app.is_service()) then
    raise exception 'Solo un administrador puede exportar' using errcode = '42501';
  end if;

  insert into public.audit_log (user_id, action, entity_type, entity_id, ip, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, nullif(p_ip, '')::inet, p_metadata);
end;
$$;

revoke execute on function public.log_audit from public, anon;
grant execute on function public.log_audit to authenticated, service_role;
