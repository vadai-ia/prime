-- 0003 · Identidad: espejo de auth.users

create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  role         public.user_role not null,
  client_id    uuid,                       -- FK a clients se agrega en 0004
  phone        text,
  avatar_url   text,
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint users_client_role_chk check ((role = 'client') = (client_id is not null))
);

create index users_role_idx on public.users (role);
create index users_client_id_idx on public.users (client_id) where client_id is not null;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sincronización desde auth.users. La fuente de verdad de role y client_id es
-- app_metadata; este trigger copia. Un usuario sin rol válido no tiene espejo
-- y por tanto no pasa ninguna política.
-- ---------------------------------------------------------------------------
create or replace function app.sync_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := new.raw_app_meta_data ->> 'role';
  v_client uuid := nullif(new.raw_app_meta_data ->> 'client_id', '')::uuid;
begin
  if v_role is null or v_role not in ('admin', 'recruiter', 'client') then
    return new;
  end if;

  perform set_config('app.sync_from_auth', 'on', true);

  insert into public.users (id, email, full_name, role, client_id, phone, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_role::public.user_role,
    v_client,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email     = excluded.email,
    role      = excluded.role,
    client_id = excluded.client_id;

  return new;
end;
$$;

create trigger on_auth_user_changed
  after insert or update of email, raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function app.sync_user_from_auth();

-- role y client_id solo cambian vía app_metadata; is_active solo lo toca un admin
-- (o el service role, que además banea la cuenta en auth).
create or replace function app.protect_users_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.role, new.client_id) is distinct from (old.role, old.client_id)
     and coalesce(current_setting('app.sync_from_auth', true), '') <> 'on' then
    raise exception 'role y client_id se cambian desde app_metadata (auth.admin.updateUserById)'
      using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active
     and not (app.is_admin() or app.is_service()) then
    raise exception 'solo un admin puede activar o desactivar usuarios'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger users_protect_columns
  before update on public.users
  for each row execute function app.protect_users_columns();
