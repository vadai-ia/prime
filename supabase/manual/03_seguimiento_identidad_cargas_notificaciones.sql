-- Prime HR · migración 0013 para pegar en el SQL Editor (después de 01_todas_las_migraciones.sql).
-- Seguimiento post-contratación, identidad para la hoja de confirmación, cargas masivas y notificaciones.

-- 0013 · Seguimiento post-contratación, identidad para la hoja de confirmación,
--        cargas masivas y notificaciones internas.
-- Sale de cotejar el alcance de la propuesta (8 módulos) contra el esquema. 16 sep 2026.

-- ---------------------------------------------------------------------------
-- 1. Identidad validada del candidato (la llena el reclutador al validar el
--    expediente; alimenta la hoja de confirmación). Datos sensibles: solo staff.
-- ---------------------------------------------------------------------------
alter table public.candidates
  add column curp            text,
  add column rfc             text,
  add column nss             text,
  add column address_line    text,
  add column retention_until date;   -- fecha de borrado programado para descartados (LFPDPPP; plazo por definir con Prime)

create unique index candidates_curp_key on public.candidates (upper(curp)) where curp is not null;

-- Fecha de ingreso acordada (la hoja de confirmación y el seguimiento parten de aquí)
alter table public.applications
  add column start_date date;

-- ---------------------------------------------------------------------------
-- 2. Seguimiento post-contratación: "permanencia según puntuación" (propuesta §Inteligencia interna).
--    Tres cortes por contratación (30, 90 y 180 días) que el reclutador o el cliente confirman.
-- ---------------------------------------------------------------------------
create type public.followup_outcome as enum ('pending', 'active', 'left', 'unknown');

create table public.placement_followups (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  checkpoint_days smallint not null check (checkpoint_days in (30, 90, 180)),
  due_at          date not null,
  outcome         public.followup_outcome not null default 'pending',
  left_at         date,
  left_reason     text,
  notes           text,
  recorded_by     uuid references public.users (id) on delete set null,
  recorded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint placement_followups_app_checkpoint_key unique (application_id, checkpoint_days)
);

create index placement_followups_due_idx on public.placement_followups (outcome, due_at);

create trigger placement_followups_set_updated_at
  before update on public.placement_followups
  for each row execute function app.set_updated_at();

-- Al contratar (o al fijar la fecha de ingreso) se programan los tres cortes.
create or replace function app.schedule_placement_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base date;
begin
  if new.stage <> 'hired' then
    return new;
  end if;
  v_base := coalesce(new.start_date, new.hired_at::date, current_date);

  insert into public.placement_followups (application_id, checkpoint_days, due_at)
  values (new.id, 30, v_base + 30), (new.id, 90, v_base + 90), (new.id, 180, v_base + 180)
  on conflict (application_id, checkpoint_days) do update
    set due_at = excluded.due_at
    where public.placement_followups.outcome = 'pending';

  return new;
end;
$$;

create trigger applications_schedule_followups
  after insert or update of stage, start_date, hired_at on public.applications
  for each row execute function app.schedule_placement_followups();

-- ---------------------------------------------------------------------------
-- 3. Cargas masivas de candidatos (CSV/Excel de Pandape o lote de CVs)
-- ---------------------------------------------------------------------------
create type public.import_status as enum ('pending', 'processing', 'done', 'failed');

create table public.import_batches (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.job_profiles (id) on delete restrict,
  source_channel public.source_channel not null default 'pandape',
  file_name      text,
  file_path      text,                                   -- bucket wa-media/imports (archivo original)
  status         public.import_status not null default 'pending',
  total_rows     int not null default 0,
  created_count  int not null default 0,
  skipped_count  int not null default 0,                 -- ya existían (mismo teléfono y vacante)
  failed_count   int not null default 0,
  errors         jsonb not null default '[]'::jsonb,     -- [{row, message}]
  created_by     uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index import_batches_profile_idx on public.import_batches (profile_id, created_at desc);

alter table public.applications
  add column import_batch_id uuid references public.import_batches (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Notificaciones en la app (una fila por destinatario). El Vo.Bo. del
--    cliente avisa a Prime al instante; el correo diario llega después.
-- ---------------------------------------------------------------------------
create type public.notification_kind as enum (
  'client_decision', 'prefilter_exception', 'document_received', 'interview_analyzed',
  'psych_parsed', 'candidate_hired', 'task_failed', 'other'
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Una notificación para todo el staff activo (admins y reclutadores).
create or replace function public.notify_staff(
  p_kind        public.notification_kind,
  p_title       text,
  p_body        text default null,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_href        text default null
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
  select u.id, p_kind, p_title, p_body, p_entity_type, p_entity_id, p_href
  from public.users u
  where u.role in ('admin', 'recruiter') and u.is_active;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_staff from public, anon;
grant execute on function public.notify_staff to authenticated, service_role;

-- Marcar leídas (propias)
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_notifications_read to authenticated;

-- La decisión del cliente ahora avisa a Prime (misma RPC, se reemplaza completa).
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

  perform public.notify_staff(
    'client_decision',
    case p_decision when 'approve' then v_client_name || ' dio Vo.Bo. a ' || v_name else v_client_name || ' no continúa con ' || v_name end,
    v_title || case when p_comment is not null then ' · ' || p_comment else '' end,
    'application', v_app.id, '/candidatos/' || v_app.id
  );

  return jsonb_build_object('id', v_app.id, 'stage', v_app.stage, 'decided_at', v_app.client_decision_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS de las tablas nuevas
-- ---------------------------------------------------------------------------
alter table public.placement_followups enable row level security;
alter table public.import_batches      enable row level security;
alter table public.notifications       enable row level security;

create policy placement_followups_all_staff on public.placement_followups for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy placement_followups_select_client on public.placement_followups for select to authenticated
  using ((select app.is_client()) and app.application_visible_to_client(application_id));

create policy import_batches_all_staff on public.import_batches for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- inserta solo el service role o notify_staff()

-- ---------------------------------------------------------------------------
-- 6. BI: permanencia según puntuación (solo staff)
-- ---------------------------------------------------------------------------
create or replace view public.v_bi_retention
with (security_invoker = true)
as
select
  a.id                 as application_id,
  p.client_id,
  p.id                 as profile_id,
  p.title              as profile_title,
  c.full_name,
  a.source_channel,
  a.cv_score,
  pi.score             as prime_interview_score,
  ps.fit_pct           as psych_fit_pct,
  ps.verdict           as psych_verdict,
  a.hired_at,
  a.start_date,
  f.checkpoint_days,
  f.due_at,
  f.outcome,
  f.left_at,
  f.left_reason
from public.applications a
join public.candidates c on c.id = a.candidate_id
join public.job_profiles p on p.id = a.profile_id
join public.placement_followups f on f.application_id = a.id
left join lateral (
  select i.score from public.interviews i
  where i.application_id = a.id and i.type = 'prime' and i.status = 'analyzed'
  order by i.scheduled_at desc nulls last limit 1
) pi on true
left join lateral (
  select t.fit_pct, t.verdict from public.psychometric_tests t
  where t.application_id = a.id and t.status = 'parsed'
  order by t.created_at desc limit 1
) ps on true
where a.hired_at is not null
  and app.is_staff();

-- Historial (opcional, coherente con el bloque de 01_todas_las_migraciones.sql)
insert into supabase_migrations.schema_migrations (version, name) values ('0013', 'followups_identity_imports_notifications') on conflict (version) do nothing;
