-- Prime HR · migraciones 0014 y 0015 para pegar en el SQL Editor (después de 03_*.sql).
-- Asignación de reclutadores por vacante, visibilidad acotada, permisos solo-admin y
-- candidatos por reclutador (round robin). Decisiones de la junta del 11 sep 2026.
--
-- Pegar COMPLETO y correr ANTES de levantar la app con el código nuevo: /perfiles y
-- /clientes ya consultan job_profile_assignments.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ. Si ya estaba aplicado (o quedó a medias), vuelve a dejar
-- todo igual y no toca datos: las asignaciones y los candidatos ya repartidos se conservan.
-- Va en una transacción: si algo falla no queda nada a medias.
-- Al final sale un checklist: todas las filas deben decir "ok".
--
-- Después de la primera vez nadie tiene vacantes asignadas: el reclutador entra y no ve
-- nada hasta que un admin lo marque en Perfiles → (vacante) → pestaña Reclutadores.
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0014 y 0015.

begin;

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
do $$ begin
  create type public.assignment_action as enum ('assigned', 'unassigned');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.assignment_source as enum ('manual', 'user_deactivated', 'role_changed');
exception when duplicate_object then null;
end $$;

create table if not exists public.job_profile_assignments (
  profile_id   uuid not null references public.job_profiles (id) on delete cascade,
  recruiter_id uuid not null references public.users (id) on delete cascade,
  assigned_by  uuid references public.users (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (profile_id, recruiter_id)
);

create index if not exists job_profile_assignments_recruiter_idx on public.job_profile_assignments (recruiter_id);

-- Historial: quién asignó o quitó a quién y cuándo. Solo lo escribe el trigger.
create table if not exists public.job_profile_assignment_events (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.job_profiles (id) on delete cascade,
  recruiter_id  uuid not null references public.users (id) on delete cascade,
  action        public.assignment_action not null,
  source        public.assignment_source not null default 'manual',
  actor_user_id uuid references public.users (id) on delete set null,   -- null = sistema (service role)
  created_at    timestamptz not null default clock_timestamp()
);

create index if not exists job_profile_assignment_events_profile_idx on public.job_profile_assignment_events (profile_id, created_at desc);
create index if not exists job_profile_assignment_events_recruiter_idx on public.job_profile_assignment_events (recruiter_id, created_at desc);

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

drop trigger if exists job_profile_assignments_before_insert on public.job_profile_assignments;
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

drop trigger if exists job_profile_assignments_log on public.job_profile_assignments;
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

drop trigger if exists users_release_assignments on public.users;
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

drop policy if exists job_profile_assignments_all_admin on public.job_profile_assignments;
create policy job_profile_assignments_all_admin on public.job_profile_assignments for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
-- el reclutador lee sus propias filas (para saber qué trabaja), nunca las escribe
drop policy if exists job_profile_assignments_select_own on public.job_profile_assignments;
create policy job_profile_assignments_select_own on public.job_profile_assignments for select to authenticated
  using (recruiter_id = (select auth.uid()));

-- historial: solo admin lo lee; lo escribe el trigger
drop policy if exists job_profile_assignment_events_select_admin on public.job_profile_assignment_events;
create policy job_profile_assignment_events_select_admin on public.job_profile_assignment_events for select to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Políticas que cambian: donde decía "staff" ahora es admin, o reclutador asignado
-- ---------------------------------------------------------------------------

-- users · el reclutador ve al staff y a los contactos de sus clientes
drop policy if exists users_select_staff on public.users;
drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users for select to authenticated
  using ((select app.is_admin()));
drop policy if exists users_select_recruiter on public.users;
create policy users_select_recruiter on public.users for select to authenticated
  using (
    (select app.role()) = 'recruiter'
    and (role in ('admin', 'recruiter') or client_id = any ((select app.assigned_client_ids())::uuid[]))
  );

-- clients · el reclutador lee solo los clientes detrás de sus perfiles
drop policy if exists clients_select_staff on public.clients;
drop policy if exists clients_select_admin on public.clients;
create policy clients_select_admin on public.clients for select to authenticated
  using ((select app.is_admin()));
drop policy if exists clients_select_recruiter on public.clients;
create policy clients_select_recruiter on public.clients for select to authenticated
  using (id = any ((select app.assigned_client_ids())::uuid[]));

-- job_profiles · crear vacantes pasa a ser de admin (quien crea decide quién la trabaja)
drop policy if exists job_profiles_select_staff on public.job_profiles;
drop policy if exists job_profiles_insert_staff on public.job_profiles;
drop policy if exists job_profiles_update_staff on public.job_profiles;
drop policy if exists job_profiles_select_admin on public.job_profiles;
create policy job_profiles_select_admin on public.job_profiles for select to authenticated
  using ((select app.is_admin()));
drop policy if exists job_profiles_select_recruiter on public.job_profiles;
create policy job_profiles_select_recruiter on public.job_profiles for select to authenticated
  using (id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy if exists job_profiles_insert_admin on public.job_profiles;
create policy job_profiles_insert_admin on public.job_profiles for insert to authenticated
  with check ((select app.is_admin()));
drop policy if exists job_profiles_update_admin on public.job_profiles;
create policy job_profiles_update_admin on public.job_profiles for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists job_profiles_update_recruiter on public.job_profiles;
create policy job_profiles_update_recruiter on public.job_profiles for update to authenticated
  using (id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (id = any ((select app.assigned_profile_ids())::uuid[]));

-- job_profile_ai_configs · sigue al perfil
drop policy if exists job_profile_ai_configs_select_staff on public.job_profile_ai_configs;
drop policy if exists job_profile_ai_configs_insert_staff on public.job_profile_ai_configs;
drop policy if exists job_profile_ai_configs_update_staff on public.job_profile_ai_configs;
drop policy if exists job_profile_ai_configs_all_admin on public.job_profile_ai_configs;
create policy job_profile_ai_configs_all_admin on public.job_profile_ai_configs for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists job_profile_ai_configs_select_recruiter on public.job_profile_ai_configs;
create policy job_profile_ai_configs_select_recruiter on public.job_profile_ai_configs for select to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy if exists job_profile_ai_configs_insert_recruiter on public.job_profile_ai_configs;
create policy job_profile_ai_configs_insert_recruiter on public.job_profile_ai_configs for insert to authenticated
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy if exists job_profile_ai_configs_update_recruiter on public.job_profile_ai_configs;
create policy job_profile_ai_configs_update_recruiter on public.job_profile_ai_configs for update to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy if exists job_profile_ai_configs_delete_admin on public.job_profile_ai_configs;   -- cubierto por all_admin

-- job_intakes · el reclutador captura levantamientos y ve los suyos o los de sus perfiles
drop policy if exists job_intakes_all_staff on public.job_intakes;
drop policy if exists job_intakes_all_admin on public.job_intakes;
create policy job_intakes_all_admin on public.job_intakes for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists job_intakes_select_recruiter on public.job_intakes;
create policy job_intakes_select_recruiter on public.job_intakes for select to authenticated
  using (
    (select app.role()) = 'recruiter'
    and (created_by = (select auth.uid()) or profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  );
drop policy if exists job_intakes_insert_recruiter on public.job_intakes;
create policy job_intakes_insert_recruiter on public.job_intakes for insert to authenticated
  with check (
    (select app.role()) = 'recruiter'
    and created_by = (select auth.uid())
    and profile_id is null
    and (client_id is null or client_id = any ((select app.assigned_client_ids())::uuid[]))
  );
drop policy if exists job_intakes_update_recruiter on public.job_intakes;
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
drop policy if exists import_batches_all_staff on public.import_batches;
drop policy if exists import_batches_all_admin on public.import_batches;
create policy import_batches_all_admin on public.import_batches for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists import_batches_all_recruiter on public.import_batches;
create policy import_batches_all_recruiter on public.import_batches for all to authenticated
  using (profile_id = any ((select app.assigned_profile_ids())::uuid[]))
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));

-- report_runs · los reportes por cliente siguen al cliente; el diario interno (client_id null) es de admin
drop policy if exists report_runs_select_staff on public.report_runs;
drop policy if exists report_runs_select_admin on public.report_runs;
create policy report_runs_select_admin on public.report_runs for select to authenticated
  using ((select app.is_admin()));
drop policy if exists report_runs_select_recruiter on public.report_runs;
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
create sequence if not exists app.recruiter_turn_seq;

alter table public.job_profile_assignments
  add column if not exists turn_seq          bigint,
  add column if not exists last_candidate_at timestamptz;   -- informativo: cuándo recibió su último candidato

alter table public.applications
  add column if not exists assigned_recruiter_id uuid references public.users (id) on delete set null,
  add column if not exists assigned_at           timestamptz;

create index if not exists applications_assigned_recruiter_idx on public.applications (assigned_recruiter_id, stage);

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

drop trigger if exists applications_before_insert_assign on public.applications;
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

drop trigger if exists applications_guard_reassign on public.applications;
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

drop trigger if exists job_profile_assignments_redistribute on public.job_profile_assignments;
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
drop policy if exists candidates_all_staff on public.candidates;
drop policy if exists candidates_all_admin on public.candidates;
create policy candidates_all_admin on public.candidates for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists candidates_select_recruiter on public.candidates;
create policy candidates_select_recruiter on public.candidates for select to authenticated
  using ((select app.role()) = 'recruiter' and app.can_access_candidate(id));
drop policy if exists candidates_insert_recruiter on public.candidates;
create policy candidates_insert_recruiter on public.candidates for insert to authenticated
  with check ((select app.role()) = 'recruiter');
drop policy if exists candidates_update_recruiter on public.candidates;
create policy candidates_update_recruiter on public.candidates for update to authenticated
  using ((select app.role()) = 'recruiter' and app.can_access_candidate(id))
  with check ((select app.role()) = 'recruiter');

-- applications
drop policy if exists applications_select_staff on public.applications;
drop policy if exists applications_insert_staff on public.applications;
drop policy if exists applications_update_staff on public.applications;
drop policy if exists applications_select_admin on public.applications;
create policy applications_select_admin on public.applications for select to authenticated
  using ((select app.is_admin()));
drop policy if exists applications_select_recruiter on public.applications;
create policy applications_select_recruiter on public.applications for select to authenticated
  using (
    assigned_recruiter_id = (select auth.uid())
    and profile_id = any ((select app.assigned_profile_ids())::uuid[])
  );
drop policy if exists applications_insert_admin on public.applications;
create policy applications_insert_admin on public.applications for insert to authenticated
  with check ((select app.is_admin()));
drop policy if exists applications_insert_recruiter on public.applications;
create policy applications_insert_recruiter on public.applications for insert to authenticated
  with check (profile_id = any ((select app.assigned_profile_ids())::uuid[]));
drop policy if exists applications_update_admin on public.applications;
create policy applications_update_admin on public.applications for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
drop policy if exists applications_update_recruiter on public.applications;
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
drop policy if exists stage_events_select_staff on public.application_stage_events;
drop policy if exists stage_events_insert_staff on public.application_stage_events;
drop policy if exists stage_events_select_staff on public.application_stage_events;
create policy stage_events_select_staff on public.application_stage_events for select to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id));
drop policy if exists stage_events_insert_staff on public.application_stage_events;
create policy stage_events_insert_staff on public.application_stage_events for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy if exists prefilter_answers_select_staff on public.prefilter_answers;
drop policy if exists prefilter_answers_insert_staff on public.prefilter_answers;
drop policy if exists prefilter_answers_select_staff on public.prefilter_answers;
create policy prefilter_answers_select_staff on public.prefilter_answers for select to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id));
drop policy if exists prefilter_answers_insert_staff on public.prefilter_answers;
create policy prefilter_answers_insert_staff on public.prefilter_answers for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_application(application_id));

-- WhatsApp: la conversación es de la persona
drop policy if exists wa_conversations_select_staff on public.wa_conversations;
drop policy if exists wa_conversations_insert_staff on public.wa_conversations;
drop policy if exists wa_conversations_update_staff on public.wa_conversations;
drop policy if exists wa_conversations_select_staff on public.wa_conversations;
create policy wa_conversations_select_staff on public.wa_conversations for select to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id));
drop policy if exists wa_conversations_insert_staff on public.wa_conversations;
create policy wa_conversations_insert_staff on public.wa_conversations for insert to authenticated
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));
drop policy if exists wa_conversations_update_staff on public.wa_conversations;
create policy wa_conversations_update_staff on public.wa_conversations for update to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id))
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));

drop policy if exists wa_messages_select_staff on public.wa_messages;
drop policy if exists wa_messages_insert_staff on public.wa_messages;
drop policy if exists wa_messages_update_staff on public.wa_messages;
drop policy if exists wa_messages_select_staff on public.wa_messages;
create policy wa_messages_select_staff on public.wa_messages for select to authenticated
  using (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  );
drop policy if exists wa_messages_insert_staff on public.wa_messages;
create policy wa_messages_insert_staff on public.wa_messages for insert to authenticated
  with check (
    (select app.is_admin())
    or exists (select 1 from public.wa_conversations w where w.id = conversation_id and app.can_access_candidate(w.candidate_id))
  );
drop policy if exists wa_messages_update_staff on public.wa_messages;
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
drop policy if exists interviews_all_staff on public.interviews;
drop policy if exists interviews_all_staff on public.interviews;
create policy interviews_all_staff on public.interviews for all to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id))
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy if exists interview_transcripts_select_staff on public.interview_transcripts;
drop policy if exists interview_transcripts_select_staff on public.interview_transcripts;
create policy interview_transcripts_select_staff on public.interview_transcripts for select to authenticated
  using (
    (select app.is_admin())
    or exists (select 1 from public.interviews i where i.id = interview_id and app.can_access_application(i.application_id))
  );

-- psychometric_tests · candidate_documents · placement_followups
drop policy if exists psychometric_tests_all_staff on public.psychometric_tests;
drop policy if exists psychometric_tests_all_staff on public.psychometric_tests;
create policy psychometric_tests_all_staff on public.psychometric_tests for all to authenticated
  using ((select app.is_admin()) or app.can_access_application(application_id))
  with check ((select app.is_admin()) or app.can_access_application(application_id));

drop policy if exists candidate_documents_all_staff on public.candidate_documents;
drop policy if exists candidate_documents_all_staff on public.candidate_documents;
create policy candidate_documents_all_staff on public.candidate_documents for all to authenticated
  using ((select app.is_admin()) or app.can_access_candidate(candidate_id))
  with check ((select app.is_admin()) or app.can_access_candidate(candidate_id));

drop policy if exists placement_followups_all_staff on public.placement_followups;
drop policy if exists placement_followups_all_staff on public.placement_followups;
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


-- Historial (coherente con el bloque de 01_todas_las_migraciones.sql; se crea si no lo corriste)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0014', 'recruiter_assignments'),
  ('0015', 'candidate_scope')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  pol as (select tablename, policyname from pg_policies where schemaname = 'public'),
  fn  as (select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace),
  trg as (select c.relname || '.' || t.tgname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal),
  col as (select table_name || '.' || column_name as name from information_schema.columns where table_schema = 'public'),
  checks (orden, objeto, ok) as (
    values
      (1,  'enum assignment_action (assigned, unassigned)',
           (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'assignment_action') = array['assigned', 'unassigned']),
      (2,  'enum assignment_source (manual, user_deactivated, role_changed)',
           (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'assignment_source') = array['manual', 'user_deactivated', 'role_changed']),
      (3,  'tabla job_profile_assignments con RLS',
           coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.job_profile_assignments')), false)),
      (4,  'tabla job_profile_assignment_events con RLS',
           coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.job_profile_assignment_events')), false)),
      (5,  'columnas turn_seq y last_candidate_at en job_profile_assignments',
           (select count(*) from col where name in ('job_profile_assignments.turn_seq', 'job_profile_assignments.last_candidate_at')) = 2),
      (6,  'columnas assigned_recruiter_id y assigned_at en applications',
           (select count(*) from col where name in ('applications.assigned_recruiter_id', 'applications.assigned_at')) = 2),
      (7,  'v_pipeline trae assigned_recruiter_id y assigned_recruiter_name',
           (select count(*) from col where name in ('v_pipeline.assigned_recruiter_id', 'v_pipeline.assigned_recruiter_name')) = 2),
      (8,  'secuencia app.recruiter_turn_seq',
           to_regclass('app.recruiter_turn_seq') is not null),
      (9,  'helpers de visibilidad (6) y app.has_permission',
           (select count(*) from fn where name in ('app.assigned_profile_ids', 'app.assigned_client_ids', 'app.can_access_profile', 'app.can_access_client', 'app.can_access_application', 'app.can_access_candidate', 'app.has_permission')) = 7),
      (10, 'RPC set_profile_recruiters y find_candidate_by_phone',
           (select count(*) from fn where name in ('public.set_profile_recruiters', 'public.find_candidate_by_phone')) = 2),
      (11, 'round robin: funciones y triggers',
           (select count(*) from fn where name in ('app.next_recruiter_for_profile', 'app.distribute_unassigned_applications', 'app.notify_application')) = 3
           and (select count(*) from trg where name in ('applications.applications_before_insert_assign', 'applications.applications_guard_reassign', 'job_profile_assignments.job_profile_assignments_redistribute')) = 3),
      (12, 'triggers de asignación e historial',
           (select count(*) from trg where name in ('job_profile_assignments.job_profile_assignments_before_insert', 'job_profile_assignments.job_profile_assignments_log', 'users.users_release_assignments')) = 3),
      (13, 'políticas nuevas del reclutador (clients, job_profiles, applications, candidates, users)',
           (select count(*) from pol where policyname in ('clients_select_recruiter', 'job_profiles_select_recruiter', 'applications_select_recruiter', 'candidates_select_recruiter', 'users_select_recruiter')) = 5),
      (14, 'políticas viejas "staff ve todo" eliminadas',
           (select count(*) from pol where policyname in ('clients_select_staff', 'job_profiles_select_staff', 'job_profiles_insert_staff', 'applications_select_staff', 'candidates_all_staff', 'users_select_staff', 'job_intakes_all_staff', 'report_runs_select_staff', 'import_batches_all_staff')) = 0),
      (15, 'notify_staff ya no es ejecutable por usuarios',
           not has_function_privilege('authenticated', 'public.notify_staff(public.notification_kind, text, text, text, uuid, text)', 'execute')),
      (16, 'log_audit rechaza export a quien no es admin',
           (select prosrc like '%has_permission(''export'')%' from pg_proc where oid = to_regproc('public.log_audit')))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
