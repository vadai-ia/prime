-- Prime HR · migraciones 0023 y 0024 para pegar en el SQL Editor (después de 10_*.sql).
-- Permanencia (Sigue / Se fue / No se sabe), base de candidatos inactivos (solo admin), avisos
-- automáticos (candidato asignado, entrevista agendada, documento recibido, intento de registrar
-- a alguien de la lista negra) y quién conectó su Outlook.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en dos transacciones: los tipos de aviso
-- nuevos tienen que existir antes de usarse. Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0023 y 0024.

begin;

-- 0023 · Tipos de aviso nuevos (21 oct 2026)
--
-- Van solos: un valor de enum nuevo no se puede usar en la misma transacción que lo crea.
-- Los usa 0024 (candidato asignado, entrevista agendada, intento de registrar a alguien
-- de la lista negra).

alter type public.notification_kind add value if not exists 'candidate_assigned';
alter type public.notification_kind add value if not exists 'interview_scheduled';
alter type public.notification_kind add value if not exists 'blacklist_attempt';


commit;

begin;

-- 0024 · Permanencia, inactivos, avisos y estado de Outlook (21 oct 2026)
--
--   1. notify_application ya no le avisa a quien hizo el cambio (ya lo sabe).
--   2. Avisos automáticos: candidato asignado (al reclutador), entrevista agendada y documento
--      recibido (admins y su reclutador).
--   3. Intento de registrar a alguien de la lista negra: la base rechaza la postulación (0021) y
--      con eso se pierde lo que se haya escrito; la app llama a esta RPC después para avisar a
--      los admins. Solo avisa si de verdad está en la lista.
--   4. Permanencia: record_placement_followup captura Sigue / Se fue / No se sabe. Se fue en un
--      corte cierra también los siguientes. Corre con la sesión del usuario (RLS decide).
--   5. v_inactive_candidates: la base de inactivos, solo admin (view_inactive_candidates).
--   6. list_user_integrations: el admin ve quién conectó su Outlook, sin tokens.

-- ---------------------------------------------------------------------------
-- 1. Avisos de un candidato: admins y su reclutador, menos quien hizo el cambio
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
      or u.id = (select a.assigned_recruiter_id from public.applications a where a.id = p_application_id)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function app.notify_application(uuid, public.notification_kind, text, text, text) from public, anon, authenticated;

-- "Puesto · Cliente" de una postulación, para el cuerpo de los avisos
create or replace function app.application_context(p_application_id uuid)
returns table (full_name text, context text)
language sql
stable
security definer
set search_path = public
as $$
  select c.full_name, p.title || ' · ' || cl.name
  from public.applications a
  join public.candidates c on c.id = a.candidate_id
  join public.job_profiles p on p.id = a.profile_id
  join public.clients cl on cl.id = p.client_id
  where a.id = p_application_id
$$;

revoke execute on function app.application_context(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Avisos automáticos
-- ---------------------------------------------------------------------------

-- Candidato asignado: solo al reclutador que lo recibe, y no si se lo asignó él mismo (alta manual)
create or replace function app.notify_candidate_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
begin
  if new.assigned_recruiter_id is null
     or new.assigned_recruiter_id is not distinct from auth.uid()
     or (tg_op = 'UPDATE' and new.assigned_recruiter_id is not distinct from old.assigned_recruiter_id)
     or new.stage in ('discarded', 'hired') then
    return new;
  end if;

  select * into v_ctx from app.application_context(new.id);
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, href)
  select u.id, 'candidate_assigned', 'Te asignaron a ' || v_ctx.full_name, v_ctx.context, 'application', new.id, '/candidatos/' || new.id
  from public.users u
  where u.id = new.assigned_recruiter_id and u.is_active;
  return new;
end;
$$;

drop trigger if exists applications_notify_assigned on public.applications;
create trigger applications_notify_assigned
  after insert or update of assigned_recruiter_id on public.applications
  for each row execute function app.notify_candidate_assigned();

-- Entrevista agendada
create or replace function app.notify_interview_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx  record;
  v_when text;
begin
  select * into v_ctx from app.application_context(new.application_id);
  v_when := case
    when new.scheduled_at is null then 'sin fecha'
    else to_char(new.scheduled_at at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI')
  end;
  perform app.notify_application(
    new.application_id,
    'interview_scheduled',
    case when new.type = 'prime' then 'Entrevista Prime' else 'Entrevista con cliente' end || ' agendada: ' || v_ctx.full_name,
    v_when || ' · ' || v_ctx.context,
    '/candidatos/' || new.application_id
  );
  return new;
end;
$$;

drop trigger if exists interviews_notify_scheduled on public.interviews;
create trigger interviews_notify_scheduled
  after insert on public.interviews
  for each row execute function app.notify_interview_scheduled();

-- Documento recibido (carga manual hoy; WhatsApp después)
create or replace function app.notify_document_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx   record;
  v_label text;
begin
  if new.application_id is null or new.status <> 'received' then
    return new;
  end if;
  select * into v_ctx from app.application_context(new.application_id);
  select t.label into v_label from public.document_types t where t.key = new.document_type_key;
  perform app.notify_application(
    new.application_id,
    'document_received',
    'Documento recibido: ' || v_ctx.full_name,
    coalesce(v_label, new.document_type_key) || ' · ' || v_ctx.context,
    '/candidatos/' || new.application_id
  );
  return new;
end;
$$;

drop trigger if exists candidate_documents_notify_received on public.candidate_documents;
create trigger candidate_documents_notify_received
  after insert on public.candidate_documents
  for each row execute function app.notify_document_received();

-- ---------------------------------------------------------------------------
-- 3. Intento de registrar a alguien de la lista negra: aviso a los admins
-- ---------------------------------------------------------------------------
create or replace function public.report_blacklist_attempt(p_phone text, p_email text default null, p_profile_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry   public.candidate_blacklist;
  v_actor   text;
  v_profile text;
  v_count   int;
begin
  if not app.is_staff() then
    return 0;
  end if;
  select * into v_entry from public.candidate_blacklist b where b.id = app.blacklist_entry_for(null, p_phone, null, p_email);
  if v_entry.id is null then
    return 0;
  end if;
  -- uno por persona cada hora: reintentar el formulario no llena la campana
  if exists (
    select 1 from public.notifications n
    where n.kind = 'blacklist_attempt' and n.entity_id = v_entry.id and n.created_at > now() - interval '1 hour'
  ) then
    return 0;
  end if;

  select coalesce(nullif(u.full_name, ''), u.email) into v_actor from public.users u where u.id = auth.uid();
  select p.title || ' · ' || cl.name into v_profile
  from public.job_profiles p join public.clients cl on cl.id = p.client_id where p.id = p_profile_id;

  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, href)
  select u.id, 'blacklist_attempt',
         'Intentaron registrar a ' || v_entry.full_name || ' (lista negra)',
         coalesce(v_actor, 'Alguien') || coalesce(' · ' || v_profile, ''),
         'candidate_blacklist', v_entry.id, '/candidatos/lista-negra'
  from public.users u
  where u.is_active and u.role = 'admin' and u.id is distinct from auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.report_blacklist_attempt(text, text, uuid) from public, anon;
grant execute on function public.report_blacklist_attempt(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Permanencia: capturar un corte (30, 90 o 180 días)
-- ---------------------------------------------------------------------------
create or replace function public.record_placement_followup(
  p_followup_id uuid,
  p_outcome     public.followup_outcome,
  p_left_at     date default null,
  p_left_reason text default null,
  p_notes       text default null
)
returns public.placement_followups
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.placement_followups;
begin
  if not app.is_staff() then
    raise exception 'Solo el equipo de Prime captura la permanencia' using errcode = '42501';
  end if;
  if p_outcome = 'pending' then
    raise exception 'Elige Sigue, Se fue o No se sabe' using errcode = '22023';
  end if;
  if p_outcome = 'left' and p_left_at is null then
    raise exception 'Con "Se fue" indica la fecha de salida' using errcode = '22023';
  end if;

  update public.placement_followups
  set outcome     = p_outcome,
      left_at     = case when p_outcome = 'left' then p_left_at end,
      left_reason = case when p_outcome = 'left' then nullif(trim(p_left_reason), '') end,
      notes       = nullif(trim(p_notes), ''),
      recorded_by = auth.uid(),
      recorded_at = now()
  where id = p_followup_id
  returning * into v_row;

  -- RLS: si no la ve, no la actualiza
  if v_row.id is null then
    raise exception 'Seguimiento no encontrado o no lo tienes asignado' using errcode = 'P0002';
  end if;

  -- Se fue: los cortes siguientes que nadie capturó quedan igual
  if p_outcome = 'left' then
    update public.placement_followups
    set outcome = 'left', left_at = v_row.left_at, left_reason = v_row.left_reason,
        recorded_by = auth.uid(), recorded_at = now()
    where application_id = v_row.application_id
      and checkpoint_days > v_row.checkpoint_days
      and outcome = 'pending';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.record_placement_followup(uuid, public.followup_outcome, date, text, text) from public, anon;
grant execute on function public.record_placement_followup(uuid, public.followup_outcome, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Base de inactivos (solo admin): personas sin postulación en proceso y que no están
--    trabajando por Prime (contratadas sin un "se fue"). El corte de tiempo lo elige la pantalla.
-- ---------------------------------------------------------------------------
create or replace view public.v_inactive_candidates
with (security_invoker = true)
as
with apps as (
  select
    a.id, a.candidate_id, a.stage, a.stage_changed_at, a.cv_score, a.discard_reason_key, a.discarded_from_stage,
    p.title as profile_title,
    cl.name as client_name,
    exists (
      select 1 from public.placement_followups f
      where f.application_id = a.id and f.outcome = 'left'
    ) as left_job,
    row_number() over (partition by a.candidate_id order by a.stage_changed_at desc, a.id) as rn
  from public.applications a
  join public.job_profiles p on p.id = a.profile_id
  join public.clients cl on cl.id = p.client_id
),
totals as (
  select
    candidate_id,
    count(*)::int                  as applications_count,
    max(stage_changed_at)          as last_activity_at,
    max(cv_score)                  as best_cv_score,
    bool_or(stage = 'hired')       as was_hired
  from apps
  group by candidate_id
  having bool_and(stage = 'discarded' or (stage = 'hired' and left_job))
)
select
  c.id                     as candidate_id,
  c.full_name,
  c.phone_e164,
  c.email,
  c.municipality,
  c.education_level,
  t.applications_count,
  t.last_activity_at,
  t.best_cv_score,
  t.was_hired,
  l.id                     as last_application_id,
  l.profile_title          as last_profile_title,
  l.client_name            as last_client_name,
  l.stage                  as last_stage,
  l.discard_reason_key     as last_discard_reason_key,
  l.discarded_from_stage   as last_discarded_from_stage
from totals t
join public.candidates c on c.id = t.candidate_id
join apps l on l.candidate_id = t.candidate_id and l.rn = 1
where app.has_permission('view_inactive_candidates')
  and not exists (
    select 1 from public.candidate_blacklist b
    where b.candidate_id = c.id and b.removed_at is null
  );

-- ---------------------------------------------------------------------------
-- 6. Quién conectó su Outlook (solo admin; nunca los tokens)
-- ---------------------------------------------------------------------------
create or replace function public.list_user_integrations()
returns table (user_id uuid, provider public.integration_provider, account_email text, connected_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app.is_admin() then
    raise exception 'Solo un admin' using errcode = '42501';
  end if;
  return query
  select i.user_id, i.provider, i.account_email, i.created_at, i.updated_at
  from public.user_integrations i;
end;
$$;

revoke execute on function public.list_user_integrations() from public, anon;
grant execute on function public.list_user_integrations() to authenticated;


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0023', 'notification_kinds'),
  ('0024', 'admin_tools')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select n.nspname || '.' || p.proname as name, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace),
  checks (orden, objeto, ok) as (
    values
      (1, 'notification_kind con candidate_assigned, interview_scheduled y blacklist_attempt',
          (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
           where t.typname = 'notification_kind' and e.enumlabel in ('candidate_assigned', 'interview_scheduled', 'blacklist_attempt')) = 3),
      (2, 'avisos: candidato asignado, entrevista agendada y documento recibido',
          (select count(*) from pg_trigger where not tgisinternal
           and tgname in ('applications_notify_assigned', 'interviews_notify_scheduled', 'candidate_documents_notify_received')) = 3),
      (3, 'los avisos no le llegan a quien hizo el cambio',
          exists (select 1 from fn where name = 'app.notify_application' and src like '%is distinct from auth.uid()%')),
      (4, 'RPC report_blacklist_attempt, record_placement_followup y list_user_integrations',
          (select count(*) from fn where name in ('public.report_blacklist_attempt', 'public.record_placement_followup', 'public.list_user_integrations')) = 3),
      (5, 'vista v_inactive_candidates',
          to_regclass('public.v_inactive_candidates') is not null)
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
