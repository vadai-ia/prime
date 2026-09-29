-- 0002 · Helpers de seguridad (esquema app) y utilidades

-- updated_at automático
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claims del JWT. role y client_id viven en app_metadata (solo el service role
-- los escribe, ver actions/users.ts). El service role no tiene app_metadata y
-- de todos modos hace bypass de RLS.
-- ---------------------------------------------------------------------------
create or replace function app.role()
returns public.user_role
language sql
stable
as $$
  select case auth.jwt() -> 'app_metadata' ->> 'role'
    when 'admin'     then 'admin'::public.user_role
    when 'recruiter' then 'recruiter'::public.user_role
    when 'client'    then 'client'::public.user_role
    else null
  end
$$;

create or replace function app.client_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'client_id', '')::uuid
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select app.role() = 'admin'
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
as $$
  select app.role() in ('admin', 'recruiter')
$$;

create or replace function app.is_client()
returns boolean
language sql
stable
as $$
  select app.role() = 'client' and app.client_id() is not null
$$;

-- true cuando no hay JWT de usuario: service role, cron, psql.
create or replace function app.is_service()
returns boolean
language sql
stable
as $$
  select auth.uid() is null
$$;

-- ---------------------------------------------------------------------------
-- Etapas
-- ---------------------------------------------------------------------------
create or replace function app.stage_order(p_stage public.application_stage)
returns int
language sql
immutable
as $$
  select array_position(enum_range(null::public.application_stage), p_stage)
$$;

-- Lo que el cliente puede ver: postulaciones que ya pasaron entrevista Prime,
-- incluidas las descartadas después de ese punto (para que vea su propio "no continuar").
create or replace function app.client_visible(
  p_stage public.application_stage,
  p_discarded_from public.application_stage
)
returns boolean
language sql
immutable
as $$
  select case
    when p_stage = 'discarded'
      then p_discarded_from in ('psychometric', 'documents', 'client_interview')
    else p_stage in ('psychometric', 'documents', 'client_interview', 'hired')
  end
$$;
