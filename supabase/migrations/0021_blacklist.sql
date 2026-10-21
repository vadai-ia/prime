-- 0021 · Lista negra (plan §2.3: solo admin la ve y la maneja)
--
-- Una persona marcada no puede volver a postularse a ninguna vacante: lo impide un trigger en
-- applications, así que vale para el alta manual, la carga masiva y WhatsApp. Se reconoce por
-- candidato, teléfono, CURP o correo (copiados al marcarla, por si después cambian o se borra).
-- El reclutador no ve la lista ni el motivo: solo que "no se puede registrar".
-- Al marcarla se descartan sus postulaciones abiertas con un motivo neutro; las contrataciones
-- no se tocan. Quitarla deja el historial (removed_at) y no reabre nada.

create type public.blacklist_reason as enum ('theft', 'abandonment', 'fake_documents', 'misconduct', 'other');

create table public.candidate_blacklist (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates (id) on delete set null,
  full_name    text not null,
  phone_e164   text,
  curp         text,
  email        text,
  reason_key   public.blacklist_reason not null,
  reason_note  text,
  added_by     uuid references public.users (id) on delete set null,
  added_at     timestamptz not null default now(),
  removed_at   timestamptz,
  removed_by   uuid references public.users (id) on delete set null,
  removed_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists candidate_blacklist_active_candidate_key on public.candidate_blacklist (candidate_id) where removed_at is null and candidate_id is not null;
create index candidate_blacklist_phone_idx on public.candidate_blacklist (phone_e164) where removed_at is null;
create index candidate_blacklist_curp_idx on public.candidate_blacklist (upper(curp)) where removed_at is null and curp is not null;
create index candidate_blacklist_email_idx on public.candidate_blacklist (lower(email)) where removed_at is null and email is not null;

create trigger candidate_blacklist_set_updated_at
  before update on public.candidate_blacklist
  for each row execute function app.set_updated_at();

-- Solo lectura para admin; se escribe únicamente con las RPC de abajo.
alter table public.candidate_blacklist enable row level security;

create policy candidate_blacklist_select_admin on public.candidate_blacklist for select to authenticated
  using ((select app.has_permission('view_blacklist')));

-- Registro vigente que coincide con la persona (o null).
create or replace function app.blacklist_entry_for(p_candidate_id uuid, p_phone text, p_curp text, p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.candidate_blacklist b
  where b.removed_at is null
    and (
      (p_candidate_id is not null and b.candidate_id = p_candidate_id)
      or (p_phone is not null and b.phone_e164 = p_phone)
      or (nullif(p_curp, '') is not null and upper(b.curp) = upper(p_curp))
      or (nullif(p_email, '') is not null and lower(b.email) = lower(p_email))
    )
  order by b.added_at desc
  limit 1
$$;

revoke execute on function app.blacklist_entry_for(uuid, text, text, text) from public, anon, authenticated;

-- Ninguna postulación nueva para alguien en la lista negra, venga de donde venga.
create or replace function app.block_blacklisted_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.candidates;
begin
  select * into v_c from public.candidates where id = new.candidate_id;
  if app.blacklist_entry_for(new.candidate_id, v_c.phone_e164, v_c.curp, v_c.email) is not null then
    raise exception 'candidate_blacklisted' using errcode = 'P0001', hint = 'La persona está en la lista negra.';
  end if;
  return new;
end;
$$;

create trigger applications_block_blacklisted
  before insert on public.applications
  for each row execute function app.block_blacklisted_application();

-- Para el alta: ¿se puede registrar este teléfono o correo? Solo dice sí o no, nunca el motivo.
create or replace function public.is_blacklisted(p_phone text, p_email text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.is_staff() then
    return false;
  end if;
  return app.blacklist_entry_for(null, p_phone, null, p_email) is not null;
end;
$$;

revoke execute on function public.is_blacklisted(text, text) from public, anon;
grant execute on function public.is_blacklisted(text, text) to authenticated;

create or replace function public.blacklist_candidate(p_candidate_id uuid, p_reason_key public.blacklist_reason, p_note text default null)
returns public.candidate_blacklist
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c   public.candidates;
  v_row public.candidate_blacklist;
begin
  if not app.has_permission('view_blacklist') then
    raise exception 'Solo un admin maneja la lista negra' using errcode = '42501';
  end if;

  select * into v_c from public.candidates where id = p_candidate_id;
  if v_c.id is null then
    raise exception 'Candidato no encontrado' using errcode = 'P0002';
  end if;

  select * into v_row from public.candidate_blacklist where candidate_id = p_candidate_id and removed_at is null;
  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.candidate_blacklist (candidate_id, full_name, phone_e164, curp, email, reason_key, reason_note, added_by)
  values (v_c.id, v_c.full_name, v_c.phone_e164, v_c.curp, v_c.email, p_reason_key, nullif(trim(p_note), ''), auth.uid())
  returning * into v_row;

  -- Postulaciones abiertas: descartadas con un motivo que no dice "lista negra" (lo ve el reclutador)
  perform set_config('app.stage_reason', 'Descartado por administración', true);
  update public.applications
  set stage = 'discarded', discard_reason_key = 'other'
  where candidate_id = p_candidate_id and stage not in ('discarded', 'hired');
  perform set_config('app.stage_reason', '', true);

  return v_row;
end;
$$;

create or replace function public.unblacklist_candidate(p_entry_id uuid, p_note text default null)
returns public.candidate_blacklist
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.candidate_blacklist;
begin
  if not app.has_permission('view_blacklist') then
    raise exception 'Solo un admin maneja la lista negra' using errcode = '42501';
  end if;

  update public.candidate_blacklist
  set removed_at = now(), removed_by = auth.uid(), removed_note = nullif(trim(p_note), '')
  where id = p_entry_id and removed_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Registro no encontrado o ya se había quitado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.blacklist_candidate(uuid, public.blacklist_reason, text) from public, anon;
revoke execute on function public.unblacklist_candidate(uuid, text) from public, anon;
grant execute on function public.blacklist_candidate(uuid, public.blacklist_reason, text) to authenticated;
grant execute on function public.unblacklist_candidate(uuid, text) to authenticated;
