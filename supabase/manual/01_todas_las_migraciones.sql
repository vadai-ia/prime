-- Prime HR · las 12 migraciones concatenadas en orden, para pegar UNA vez en el SQL Editor.
-- Generado el 16 sep 2026 desde supabase/migrations/. Si cambias una migración, vuelve a generar este archivo.
-- Se ejecuta como una sola transacción: si algo falla, no queda nada a medias.


-- =====================================================================
-- 0001_extensions_enums.sql
-- =====================================================================

-- 0001 · Extensiones, esquema de helpers y enums
-- Convención: identificadores en inglés snake_case; etiquetas en español viven en la UI.

create extension if not exists pgcrypto;

-- Esquema para helpers de seguridad y utilidades (no expuesto por PostgREST).
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;
alter default privileges in schema app grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums del plan (sección 3.1)
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'recruiter', 'client');
create type public.profile_status    as enum ('intake', 'active', 'paused', 'closed');
create type public.application_stage as enum (
  'new', 'prefilter', 'cv_review', 'prime_interview', 'psychometric',
  'documents', 'client_interview', 'hired', 'discarded'
);
create type public.source_channel    as enum ('pandape', 'facebook', 'linkedin', 'prime_pool', 'referral', 'other');
create type public.prefilter_status  as enum ('pending', 'in_progress', 'passed', 'failed', 'exception');
create type public.interview_type    as enum ('prime', 'client');
create type public.interview_status  as enum ('scheduled', 'confirmed', 'no_show', 'cancelled', 'recorded', 'transcribed', 'analyzed');
create type public.psych_status      as enum ('pending', 'sent', 'completed', 'parsed', 'failed');
create type public.psych_verdict     as enum ('fit', 'fit_with_reservations', 'not_recommended');
create type public.doc_status        as enum ('pending', 'received', 'in_review', 'validated', 'rejected');
create type public.wa_direction      as enum ('inbound', 'outbound');
create type public.wa_flow           as enum ('prefilter', 'scheduling', 'psychometric', 'documents', 'reminder', 'manual');
create type public.actor_type        as enum ('agent', 'recruiter', 'client', 'system');
create type public.task_status       as enum ('pending', 'running', 'done', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Enums que el plan dejaba como texto entre paréntesis. Se vuelven enums para
-- que `supabase gen types` produzca uniones de TypeScript en lugar de string.
-- ---------------------------------------------------------------------------
create type public.intake_status          as enum ('draft', 'generated');
create type public.wa_conversation_status as enum ('open', 'closed_success', 'closed_rule', 'handoff', 'expired');
create type public.wa_message_type        as enum ('text', 'image', 'document', 'audio', 'video', 'template', 'interactive');
create type public.wa_message_status      as enum ('queued', 'sent', 'delivered', 'read', 'failed');
create type public.wa_template_purpose    as enum ('first_contact', 'interview_confirm', 'psych_link', 'docs_request', 'reminder', 'courtesy_close');
create type public.meeting_platform       as enum ('meet', 'zoom');
create type public.received_via           as enum ('whatsapp', 'upload', 'email');
create type public.report_type            as enum ('daily_internal', 'daily_client', 'weekly_client');
create type public.report_status          as enum ('pending', 'rendered', 'sent', 'failed');
create type public.ai_run_kind            as enum (
  'profile_generation', 'cv_score', 'prefilter_reply', 'interview_analysis',
  'psych_parse', 'doc_check', 'weekly_insights'
);
create type public.ai_run_status          as enum ('ok', 'error', 'refusal');
create type public.webhook_source         as enum ('whaapy', 'fireflies', 'resend', 'google');
create type public.audit_action           as enum ('view_cv', 'view_document', 'download_document', 'view_psych_report', 'export');
create type public.integration_provider   as enum ('google');
create type public.client_decision        as enum ('approve', 'reject');

-- Motivo de descarte categorizado: alimenta v_bi_discard_reasons en cualquier etapa,
-- no solo en prefiltro. El texto libre sigue en applications.discard_reason.
create type public.discard_reason_key as enum (
  'age', 'commute', 'salary', 'schedule', 'experience', 'education',
  'no_response', 'invalid_phone', 'cv_score', 'interview', 'psychometric',
  'documents', 'client_rejected', 'withdrew', 'other'
);


-- =====================================================================
-- 0002_helpers.sql
-- =====================================================================

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


-- =====================================================================
-- 0003_identity.sql
-- =====================================================================

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


-- =====================================================================
-- 0004_clients_profiles.sql
-- =====================================================================

-- 0004 · Clientes, levantamiento y perfiles de puesto

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  industry           text,
  address            text,
  city               text,
  contact_name       text,
  contact_title      text,
  contact_email      text,
  contact_phone      text,
  client_since       date,
  timezone           text not null default 'America/Mexico_City',
  daily_report_time  time not null default '18:00',
  weekly_report_dow  smallint not null default 5 check (weekly_report_dow between 0 and 6), -- 0 = domingo
  weekly_report_time time not null default '09:00',
  report_recipients  text[] not null default '{}',   -- correos que reciben el diario y el semanal
  portal_enabled     boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function app.set_updated_at();

alter table public.users
  add constraint users_client_id_fkey foreign key (client_id) references public.clients (id) on delete restrict;

-- Levantamiento (secciones I–VI del Excel). Se conserva para auditoría y regeneración.
create table public.job_intakes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients (id) on delete restrict,   -- null hasta dar de alta al cliente
  profile_id uuid,                                                      -- FK abajo (tabla creada después)
  form       jsonb not null default '{}'::jsonb,
  status     public.intake_status not null default 'draft',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_intakes_client_id_idx on public.job_intakes (client_id);

create trigger job_intakes_set_updated_at
  before update on public.job_intakes
  for each row execute function app.set_updated_at();

-- Descriptivo de puesto (D.P.)
create table public.job_profiles (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  intake_id          uuid references public.job_intakes (id) on delete set null,
  title              text not null,
  status             public.profile_status not null default 'intake',
  openings           int not null default 1 check (openings >= 0),
  unit               text,
  work_zone          text,
  objective          text,
  reports_to         text,
  prepared_by        uuid references public.users (id) on delete set null,
  prepared_at        date,
  specs              jsonb not null default '{}'::jsonb,   -- {age, sex, marital_status, children, residence}
  requirements       jsonb not null default '{}'::jsonb,   -- {education, experience, knowledge, languages, systems}
  activities         text[] not null default '{}',
  conditions         jsonb not null default '{}'::jsonb,   -- {salary, benefits, schedule, modality, travel, staff_in_charge, tools}
  relations          jsonb not null default '[]'::jsonb,   -- [{with, purpose}]
  competencies       jsonb not null default '{}'::jsonb,   -- {functional:[{name,level}], leadership:[{name,level}], labor:[string]}
  selection_process  text[] not null default '{}',
  posting_text       text,
  published_channels public.source_channel[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index job_profiles_client_id_idx on public.job_profiles (client_id);
create index job_profiles_status_idx on public.job_profiles (status);

create trigger job_profiles_set_updated_at
  before update on public.job_profiles
  for each row execute function app.set_updated_at();

alter table public.job_intakes
  add constraint job_intakes_profile_id_fkey foreign key (profile_id) references public.job_profiles (id) on delete set null;

-- Configuración que usa la IA. Una fila por perfil; `version` sube en cada
-- regeneración y applications.cv_score_version guarda contra cuál se calificó.
-- El historial completo queda en ai_runs.output.
create table public.job_profile_ai_configs (
  profile_id             uuid primary key references public.job_profiles (id) on delete cascade,
  version                int not null default 1,
  age_min                int,
  age_max                int,
  age_is_blocking        boolean not null default false,   -- alerta por defecto (LFT art. 3 y 133)
  commute_max_min        int,
  experience_min_months  int,
  salary_expectation_max numeric(12, 2),
  schedule_text          text,
  requires_saturdays     boolean not null default false,
  education_min          text,
  cv_weights             jsonb not null default '[]'::jsonb,   -- [{key, label, weight}] suma 100
  cv_threshold           int not null default 70 check (cv_threshold between 0 and 100),
  prefilter_questions    jsonb not null default '[]'::jsonb,   -- [{order, key, text, rule_key, answer_type}]
  psych_minimums         jsonb not null default '[]'::jsonb,   -- [{scale, min}]
  psych_blocking         jsonb not null default '[]'::jsonb,   -- [{scale, min}]
  generated_by_ai        boolean not null default false,
  generated_at           timestamptz,
  prompt_version         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint job_profile_ai_configs_age_chk check (age_min is null or age_max is null or age_min <= age_max)
);

create trigger job_profile_ai_configs_set_updated_at
  before update on public.job_profile_ai_configs
  for each row execute function app.set_updated_at();


-- =====================================================================
-- 0005_candidates_applications.sql
-- =====================================================================

-- 0005 · Candidatos (persona) y postulaciones (etapa)

create table public.candidates (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  first_name          text,                                   -- para el saludo del agente
  phone_e164          text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email               text,
  birth_date          date,
  age_reported        int check (age_reported between 14 and 99),
  gender              text,
  zone                text,
  municipality        text,
  education_level     text,
  cv_file_path        text,                                   -- bucket cvs
  cv_text             text,
  cv_summary          text,
  privacy_consent_at  timestamptz,
  privacy_consent_via text,                                   -- whatsapp | form | recruiter
  whaapy_contact_id   text,
  in_prime_pool       boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index candidates_email_idx on public.candidates (lower(email)) where email is not null;
create index candidates_whaapy_contact_id_idx on public.candidates (whaapy_contact_id) where whaapy_contact_id is not null;
create index candidates_full_name_idx on public.candidates (lower(full_name));

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function app.set_updated_at();

create table public.applications (
  id                      uuid primary key default gen_random_uuid(),
  candidate_id            uuid not null references public.candidates (id) on delete cascade,
  profile_id              uuid not null references public.job_profiles (id) on delete restrict,
  stage                   public.application_stage not null default 'new',
  stage_changed_at        timestamptz not null default now(),
  source_channel          public.source_channel not null default 'other',
  applied_at              timestamptz not null default now(),
  commute_minutes         int,
  experience_months       int,
  salary_expectation      numeric(12, 2),
  available               boolean,
  availability_notes      text,
  prefilter_status        public.prefilter_status not null default 'pending',
  prefilter_result        jsonb,                                 -- [{criterion, answer, ok, required}]
  cv_score                int check (cv_score between 0 and 100),
  cv_score_breakdown      jsonb,
  cv_score_version        int,                                   -- job_profile_ai_configs.version usada
  cv_scored_at            timestamptz,
  cv_ai_rationale         text,
  ai_note                 text,                                  -- "Nota de la IA" de la ficha
  discard_reason_key      public.discard_reason_key,
  discard_reason          text,
  discarded_from_stage    public.application_stage,
  discarded_by            public.actor_type,
  discarded_by_user_id    uuid references public.users (id) on delete set null,
  discarded_at            timestamptz,
  client_decision         public.client_decision,
  client_decision_at      timestamptz,
  client_decision_by      uuid references public.users (id) on delete set null,
  client_decision_comment text,
  hired_at                timestamptz,
  agreed_salary           numeric(12, 2),
  confirmation_sheet_path text,                                  -- bucket documents
  confirmation_signed_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint applications_candidate_profile_key unique (candidate_id, profile_id)
);

create index applications_profile_id_idx on public.applications (profile_id);
create index applications_candidate_id_idx on public.applications (candidate_id);
create index applications_stage_idx on public.applications (stage);
create index applications_profile_stage_idx on public.applications (profile_id, stage);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function app.set_updated_at();

-- Línea de tiempo: una fila por cambio de etapa (incluida la creación). Base del BI de tiempos.
create table public.application_stage_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_stage     public.application_stage,
  to_stage       public.application_stage not null,
  actor_type     public.actor_type not null,
  actor_user_id  uuid references public.users (id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now()
);

create index application_stage_events_app_idx on public.application_stage_events (application_id, created_at);
create index application_stage_events_to_stage_idx on public.application_stage_events (to_stage, created_at);

-- Una fila por pregunta del prefiltro; se hace upsert si el agente repregunta.
create table public.prefilter_answers (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  question_key   text not null,
  question_text  text not null,
  answer_raw     text,
  answer_parsed  jsonb,
  passes         boolean,
  rule_snapshot  jsonb,                                          -- regla vigente al evaluar
  answered_at    timestamptz not null default now(),
  constraint prefilter_answers_app_question_key unique (application_id, question_key)
);

-- ---------------------------------------------------------------------------
-- Cambio de etapa. Dos triggers: BEFORE completa campos derivados, AFTER
-- registra el evento. Quien quiera dar motivo o actor usa set_application_stage().
-- ---------------------------------------------------------------------------
create or replace function app.actor_from_context()
returns public.actor_type
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.actor_type', true), '')::public.actor_type,
    case
      when app.role() = 'client' then 'client'::public.actor_type
      when app.is_staff()        then 'recruiter'::public.actor_type
      else 'system'::public.actor_type
    end
  )
$$;

create or replace function app.before_application_stage_change()
returns trigger
language plpgsql
as $$
begin
  if new.stage is not distinct from old.stage then
    return new;
  end if;

  new.stage_changed_at := now();

  if new.stage = 'discarded' then
    new.discarded_at         := coalesce(new.discarded_at, now());
    new.discarded_from_stage := coalesce(new.discarded_from_stage, old.stage);
    new.discarded_by         := coalesce(new.discarded_by, app.actor_from_context());
    new.discarded_by_user_id := coalesce(new.discarded_by_user_id, auth.uid());
    new.discard_reason       := coalesce(new.discard_reason, nullif(current_setting('app.stage_reason', true), ''));
  elsif old.stage = 'discarded' then
    -- reapertura: se limpia el descarte
    new.discarded_at         := null;
    new.discarded_from_stage := null;
    new.discarded_by         := null;
    new.discarded_by_user_id := null;
    new.discard_reason       := null;
    new.discard_reason_key   := null;
  end if;

  if new.stage = 'hired' then
    new.hired_at := coalesce(new.hired_at, now());
  end if;

  return new;
end;
$$;

create trigger applications_before_stage_change
  before update of stage on public.applications
  for each row execute function app.before_application_stage_change();

create or replace function app.after_application_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  insert into public.application_stage_events (application_id, from_stage, to_stage, actor_type, actor_user_id, reason)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.stage end,
    new.stage,
    app.actor_from_context(),
    auth.uid(),
    nullif(current_setting('app.stage_reason', true), '')
  );

  return new;
end;
$$;

create trigger applications_after_stage_change
  after insert or update of stage on public.applications
  for each row execute function app.after_application_stage_change();

-- RPC para mover de etapa con motivo y actor. Corre con RLS del que llama
-- (security invoker): un cliente no puede usarla; el service role sí.
create or replace function public.set_application_stage(
  p_application_id     uuid,
  p_to_stage           public.application_stage,
  p_reason             text default null,
  p_discard_reason_key public.discard_reason_key default null,
  p_actor_type         public.actor_type default null
)
returns public.applications
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.applications;
begin
  perform set_config('app.stage_reason', coalesce(p_reason, ''), true);
  perform set_config('app.actor_type', coalesce(p_actor_type::text, ''), true);

  update public.applications
  set stage = p_to_stage,
      discard_reason_key = case
        when p_to_stage = 'discarded' then coalesce(p_discard_reason_key, discard_reason_key)
        else discard_reason_key
      end
  where id = p_application_id
  returning * into v_row;

  perform set_config('app.stage_reason', '', true);
  perform set_config('app.actor_type', '', true);

  if v_row.id is null then
    raise exception 'Postulación % no encontrada o sin permiso', p_application_id using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.set_application_stage from public, anon;
grant execute on function public.set_application_stage to authenticated, service_role;


-- =====================================================================
-- 0006_whatsapp.sql
-- =====================================================================

-- 0006 · WhatsApp (Whaapy)

create table public.wa_conversations (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null references public.candidates (id) on delete cascade,
  application_id         uuid references public.applications (id) on delete set null,  -- null = conversación general
  phone_e164             text not null,
  whaapy_conversation_id text,
  flow                   public.wa_flow not null default 'manual',
  flow_state             jsonb not null default '{}'::jsonb,   -- {question_index, awaiting, retries}
  status                 public.wa_conversation_status not null default 'open',
  ai_paused              boolean not null default false,
  paused_by              uuid references public.users (id) on delete set null,
  last_inbound_at        timestamptz,
  last_outbound_at       timestamptz,
  window_expires_at      timestamptz,                            -- last_inbound_at + 24 h
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index wa_conversations_candidate_id_idx on public.wa_conversations (candidate_id);
create index wa_conversations_application_id_idx on public.wa_conversations (application_id);
create unique index wa_conversations_whaapy_id_key on public.wa_conversations (whaapy_conversation_id) where whaapy_conversation_id is not null;
-- El webhook enruta por teléfono: solo puede haber una conversación abierta por número.
create unique index wa_conversations_one_open_per_phone on public.wa_conversations (phone_e164) where status = 'open';

create trigger wa_conversations_set_updated_at
  before update on public.wa_conversations
  for each row execute function app.set_updated_at();

create table public.wa_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.wa_conversations (id) on delete cascade,
  direction           public.wa_direction not null,
  whaapy_message_id   text,
  wamid               text,                                    -- id de WhatsApp
  type                public.wa_message_type not null default 'text',
  body                text,
  interactive_payload jsonb,
  media_path          text,                                    -- bucket wa-media (nunca la URL temporal)
  media_mime          text,
  status              public.wa_message_status not null default 'queued',
  error               text,
  sent_by             public.actor_type,
  sent_by_user_id     uuid references public.users (id) on delete set null,
  ai_run_id           uuid,                                    -- FK en 0008
  created_at          timestamptz not null default now()
);

create index wa_messages_conversation_idx on public.wa_messages (conversation_id, created_at);
create unique index wa_messages_whaapy_id_key on public.wa_messages (whaapy_message_id) where whaapy_message_id is not null;
create unique index wa_messages_wamid_key on public.wa_messages (wamid) where wamid is not null;

-- Catálogo de templates aprobados por Meta
create table public.wa_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  language    text not null default 'es_MX',
  purpose     public.wa_template_purpose not null,
  variables   jsonb not null default '[]'::jsonb,              -- [{position, key, example}]
  meta_status text not null default 'pending',                 -- pending | approved | rejected | paused
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint wa_templates_name_language_key unique (name, language)
);

create trigger wa_templates_set_updated_at
  before update on public.wa_templates
  for each row execute function app.set_updated_at();


-- =====================================================================
-- 0007_interviews_psych_docs.sql
-- =====================================================================

-- 0007 · Entrevistas, psicométrico y expediente

create table public.interviews (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid not null references public.applications (id) on delete cascade,
  type                   public.interview_type not null,
  status                 public.interview_status not null default 'scheduled',
  scheduled_at           timestamptz,
  duration_min           int not null default 30,
  platform               public.meeting_platform not null default 'meet',
  meeting_url            text,
  calendar_event_id      text,
  calendar_owner_id      uuid references public.users (id) on delete set null,
  interviewer_user_id    uuid references public.users (id) on delete set null,
  client_interviewer_name text,
  fireflies_meeting_id   text,
  summary                text,
  score                  int check (score between 0 and 100),
  findings               jsonb,                                 -- [{criterion, ok, evidence, quote, at}]
  analyzed_at            timestamptz,
  analysis_version       text,
  ai_run_id              uuid,                                  -- FK en 0008
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index interviews_application_id_idx on public.interviews (application_id);
create index interviews_scheduled_at_idx on public.interviews (scheduled_at);
create unique index interviews_fireflies_meeting_id_key on public.interviews (fireflies_meeting_id) where fireflies_meeting_id is not null;

create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function app.set_updated_at();

-- Separada para que el cliente nunca la lea y para no cargar texto largo en listados.
create table public.interview_transcripts (
  interview_id            uuid primary key references public.interviews (id) on delete cascade,
  fireflies_transcript_id text,
  language                text,
  text                    text,
  sentences               jsonb,                                -- [{speaker_name, text, start_time}]
  duration_sec            int,
  received_at             timestamptz not null default now()
);

create table public.psychometric_tests (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications (id) on delete cascade,
  provider         text not null default 'psicotest',
  test_link        text,
  sent_at          timestamptz,
  reminder_sent_at timestamptz,
  due_at           timestamptz,
  completed_at     timestamptz,
  report_file_path text,                                        -- bucket psychometrics
  status           public.psych_status not null default 'pending',
  parsed           jsonb,                                       -- {iq, iq_level, coleibor, cibain_high, cibain_low, inceval, cacter, ciesman_low}
  fit_rows         jsonb,                                       -- [{scale, min, score, ok, blocking}]
  fit_pct          int check (fit_pct between 0 and 100),
  verdict          public.psych_verdict,
  parsed_at        timestamptz,
  ai_run_id        uuid,                                        -- FK en 0008
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index psychometric_tests_application_id_idx on public.psychometric_tests (application_id, created_at desc);

create trigger psychometric_tests_set_updated_at
  before update on public.psychometric_tests
  for each row execute function app.set_updated_at();

-- Catálogo de documentos del expediente (semilla en seed.sql)
create table public.document_types (
  key              text primary key,
  label            text not null,
  required         boolean not null default true,
  sort_order       int not null default 0,
  accepts          text[] not null default '{image,pdf}',
  validation_hints text                                          -- lo que Claude debe verificar
);

-- Pertenece a la persona; application_id da contexto. Un documento rechazado se
-- vuelve a pedir y genera una fila nueva; solo puede haber uno "vivo" por tipo.
create table public.candidate_documents (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.candidates (id) on delete cascade,
  application_id    uuid references public.applications (id) on delete set null,
  document_type_key text not null references public.document_types (key) on delete restrict,
  file_path         text,                                       -- bucket documents
  mime              text,
  size_bytes        bigint,
  status            public.doc_status not null default 'pending',
  received_via      public.received_via,
  ai_check          jsonb,                                      -- {legible, name_matches, extracted:{curp, rfc, nss, address}, issues[]}
  rejected_reason   text,
  validated_by      uuid references public.users (id) on delete set null,
  validated_at      timestamptz,
  ai_run_id         uuid,                                       -- FK en 0008
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index candidate_documents_candidate_id_idx on public.candidate_documents (candidate_id);
create index candidate_documents_application_id_idx on public.candidate_documents (application_id);
create unique index candidate_documents_one_live_per_type on public.candidate_documents (candidate_id, document_type_key) where status <> 'rejected';

create trigger candidate_documents_set_updated_at
  before update on public.candidate_documents
  for each row execute function app.set_updated_at();


-- =====================================================================
-- 0008_reports_system.sql
-- =====================================================================

-- 0008 · Reportes, inteligencia y tablas de sistema

-- Observabilidad y costo de cada llamada a Claude
create table public.ai_runs (
  id                uuid primary key default gen_random_uuid(),
  kind              public.ai_run_kind not null,
  entity_type       text,
  entity_id         uuid,
  model             text not null,
  prompt_version    text,
  effort            text,
  input_tokens      int,
  output_tokens     int,
  cache_read_tokens int,
  cost_usd          numeric(10, 5),
  latency_ms        int,
  status            public.ai_run_status not null default 'ok',
  error             text,
  output            jsonb,
  created_at        timestamptz not null default now()
);

create index ai_runs_entity_idx on public.ai_runs (entity_type, entity_id);
create index ai_runs_kind_created_idx on public.ai_runs (kind, created_at desc);

-- FKs pendientes hacia ai_runs
alter table public.wa_messages         add constraint wa_messages_ai_run_id_fkey         foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
alter table public.interviews          add constraint interviews_ai_run_id_fkey          foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
alter table public.psychometric_tests  add constraint psychometric_tests_ai_run_id_fkey  foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
alter table public.candidate_documents add constraint candidate_documents_ai_run_id_fkey foreign key (ai_run_id) references public.ai_runs (id) on delete set null;

create table public.report_runs (
  id                uuid primary key default gen_random_uuid(),
  type              public.report_type not null,
  client_id         uuid references public.clients (id) on delete cascade,   -- null en daily_internal
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  recipients        text[] not null default '{}',
  subject           text,
  html_path         text,                                                    -- bucket reports
  pdf_path          text,
  sent_at           timestamptz,
  status            public.report_status not null default 'pending',
  error             text,
  resend_message_id text,
  created_at        timestamptz not null default now(),
  constraint report_runs_client_chk check ((type = 'daily_internal') = (client_id is null))
);

create index report_runs_client_type_idx on public.report_runs (client_id, type, period_start desc);

-- Áreas de mejora generadas cada lunes
create table public.ai_insights (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients (id) on delete cascade,        -- null = global
  week_start date not null,
  items      jsonb not null default '[]'::jsonb,
  ai_run_id  uuid references public.ai_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_insights_client_week_key unique nulls not distinct (client_id, week_start)
);

-- Idempotencia y replay de webhooks
create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  source       public.webhook_source not null,
  event_type   text not null,
  external_id  text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  attempts     int not null default 0,
  constraint webhook_events_source_external_key unique (source, external_id)
);

create index webhook_events_pending_idx on public.webhook_events (received_at) where processed_at is null;

-- Cola simple sobre Postgres
create table public.scheduled_tasks (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  dedupe_key   text,                                   -- evita encolar dos veces lo mismo (p. ej. wa_reminder:{conversation_id})
  run_at       timestamptz not null default now(),
  status       public.task_status not null default 'pending',
  attempts     int not null default 0,
  max_attempts int not null default 5,
  locked_at    timestamptz,
  locked_by    text,
  last_error   text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index scheduled_tasks_status_run_at_idx on public.scheduled_tasks (status, run_at);
create unique index scheduled_tasks_dedupe_key_key on public.scheduled_tasks (dedupe_key) where dedupe_key is not null and status in ('pending', 'running');

-- Tokens OAuth cifrados (AES-256-GCM en la app, ENCRYPTION_KEY)
create table public.user_integrations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  provider          public.integration_provider not null,
  access_token_enc  text not null,
  refresh_token_enc text,
  expires_at        timestamptz,
  scopes            text[] not null default '{}',
  account_email     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint user_integrations_user_provider_key unique (user_id, provider)
);

create trigger user_integrations_set_updated_at
  before update on public.user_integrations
  for each row execute function app.set_updated_at();

-- Bitácora de lecturas de datos sensibles (LFPDPPP)
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  action      public.audit_action not null,
  entity_type text not null,
  entity_id   uuid,
  ip          inet,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_user_idx on public.audit_log (user_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);


-- =====================================================================
-- 0009_rls.sql
-- =====================================================================

-- 0009 · Row Level Security
--
-- Matriz (plan §2.3). Los helpers app.* leen role y client_id del JWT.
-- Se envuelven en (select ...) para que Postgres los evalúe una vez por consulta.
-- El service role hace bypass de RLS: webhooks, cron y jobs escriben con él.

-- ---------------------------------------------------------------------------
-- Visibilidad del cliente (security definer para no recursar RLS)
-- ---------------------------------------------------------------------------
create or replace function app.application_visible_to_client(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.job_profiles p on p.id = a.profile_id
    where a.id = p_application_id
      and p.client_id = app.client_id()
      and app.client_visible(a.stage, a.discarded_from_stage)
  )
$$;

create or replace function app.candidate_visible_to_client(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.job_profiles p on p.id = a.profile_id
    where a.candidate_id = p_candidate_id
      and p.client_id = app.client_id()
      and app.client_visible(a.stage, a.discarded_from_stage)
  )
$$;

-- ---------------------------------------------------------------------------
-- Activar RLS en todo
-- ---------------------------------------------------------------------------
alter table public.users                    enable row level security;
alter table public.clients                  enable row level security;
alter table public.job_intakes              enable row level security;
alter table public.job_profiles             enable row level security;
alter table public.job_profile_ai_configs   enable row level security;
alter table public.candidates               enable row level security;
alter table public.applications             enable row level security;
alter table public.application_stage_events enable row level security;
alter table public.prefilter_answers        enable row level security;
alter table public.wa_conversations         enable row level security;
alter table public.wa_messages              enable row level security;
alter table public.wa_templates             enable row level security;
alter table public.interviews               enable row level security;
alter table public.interview_transcripts    enable row level security;
alter table public.psychometric_tests       enable row level security;
alter table public.document_types           enable row level security;
alter table public.candidate_documents      enable row level security;
alter table public.report_runs              enable row level security;
alter table public.ai_insights              enable row level security;
alter table public.ai_runs                  enable row level security;
alter table public.webhook_events           enable row level security;
alter table public.scheduled_tasks          enable row level security;
alter table public.user_integrations        enable row level security;
alter table public.audit_log                enable row level security;

-- ---------------------------------------------------------------------------
-- users · admin CRUD · staff R · client R (self) · cualquiera edita su nombre/teléfono
-- ---------------------------------------------------------------------------
create policy users_select_staff on public.users for select to authenticated
  using ((select app.is_staff()));
create policy users_select_self on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_insert_admin on public.users for insert to authenticated
  with check ((select app.is_admin()));
create policy users_update_admin on public.users for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_delete_admin on public.users for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- clients · admin CRUD · recruiter R · client R (propio)
-- ---------------------------------------------------------------------------
create policy clients_select_staff on public.clients for select to authenticated
  using ((select app.is_staff()));
create policy clients_select_own on public.clients for select to authenticated
  using (id = (select app.client_id()));
create policy clients_insert_admin on public.clients for insert to authenticated
  with check ((select app.is_admin()));
create policy clients_update_admin on public.clients for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy clients_delete_admin on public.clients for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- job_intakes · staff CRUD
-- ---------------------------------------------------------------------------
create policy job_intakes_all_staff on public.job_intakes for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- ---------------------------------------------------------------------------
-- job_profiles · admin CRUD · recruiter CRU · client R (propios)
-- ---------------------------------------------------------------------------
create policy job_profiles_select_staff on public.job_profiles for select to authenticated
  using ((select app.is_staff()));
create policy job_profiles_select_client on public.job_profiles for select to authenticated
  using (client_id = (select app.client_id()));
create policy job_profiles_insert_staff on public.job_profiles for insert to authenticated
  with check ((select app.is_staff()));
create policy job_profiles_update_staff on public.job_profiles for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy job_profiles_delete_admin on public.job_profiles for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- job_profile_ai_configs · admin CRUD · recruiter CRU
-- ---------------------------------------------------------------------------
create policy job_profile_ai_configs_select_staff on public.job_profile_ai_configs for select to authenticated
  using ((select app.is_staff()));
create policy job_profile_ai_configs_insert_staff on public.job_profile_ai_configs for insert to authenticated
  with check ((select app.is_staff()));
create policy job_profile_ai_configs_update_staff on public.job_profile_ai_configs for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy job_profile_ai_configs_delete_admin on public.job_profile_ai_configs for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- candidates · staff CRUD · client R vía postulaciones visibles
-- ---------------------------------------------------------------------------
create policy candidates_all_staff on public.candidates for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy candidates_select_client on public.candidates for select to authenticated
  using ((select app.is_client()) and app.candidate_visible_to_client(id));

-- ---------------------------------------------------------------------------
-- applications · admin CRUD · recruiter CRU · client R (visibles); decisión vía RPC
-- ---------------------------------------------------------------------------
create policy applications_select_staff on public.applications for select to authenticated
  using ((select app.is_staff()));
create policy applications_select_client on public.applications for select to authenticated
  using (
    (select app.is_client())
    and app.client_visible(stage, discarded_from_stage)
    and exists (
      select 1 from public.job_profiles p
      where p.id = applications.profile_id and p.client_id = (select app.client_id())
    )
  );
create policy applications_insert_staff on public.applications for insert to authenticated
  with check ((select app.is_staff()));
create policy applications_update_staff on public.applications for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy applications_delete_admin on public.applications for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- application_stage_events · admin CRUD · recruiter CR · client R (visibles)
-- ---------------------------------------------------------------------------
create policy stage_events_select_staff on public.application_stage_events for select to authenticated
  using ((select app.is_staff()));
create policy stage_events_select_client on public.application_stage_events for select to authenticated
  using ((select app.is_client()) and app.application_visible_to_client(application_id));
create policy stage_events_insert_staff on public.application_stage_events for insert to authenticated
  with check ((select app.is_staff()));
create policy stage_events_update_admin on public.application_stage_events for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy stage_events_delete_admin on public.application_stage_events for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- prefilter_answers · admin CRUD · recruiter CR · client R (visibles)
-- ---------------------------------------------------------------------------
create policy prefilter_answers_select_staff on public.prefilter_answers for select to authenticated
  using ((select app.is_staff()));
create policy prefilter_answers_select_client on public.prefilter_answers for select to authenticated
  using ((select app.is_client()) and app.application_visible_to_client(application_id));
create policy prefilter_answers_insert_staff on public.prefilter_answers for insert to authenticated
  with check ((select app.is_staff()));
create policy prefilter_answers_update_admin on public.prefilter_answers for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy prefilter_answers_delete_admin on public.prefilter_answers for delete to authenticated
  using ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- wa_conversations, wa_messages · admin CRUD · recruiter CRU · client —
-- ---------------------------------------------------------------------------
create policy wa_conversations_select_staff on public.wa_conversations for select to authenticated
  using ((select app.is_staff()));
create policy wa_conversations_insert_staff on public.wa_conversations for insert to authenticated
  with check ((select app.is_staff()));
create policy wa_conversations_update_staff on public.wa_conversations for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy wa_conversations_delete_admin on public.wa_conversations for delete to authenticated
  using ((select app.is_admin()));

create policy wa_messages_select_staff on public.wa_messages for select to authenticated
  using ((select app.is_staff()));
create policy wa_messages_insert_staff on public.wa_messages for insert to authenticated
  with check ((select app.is_staff()));
create policy wa_messages_update_staff on public.wa_messages for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy wa_messages_delete_admin on public.wa_messages for delete to authenticated
  using ((select app.is_admin()));

-- wa_templates · admin CRUD · recruiter R (es configuración)
create policy wa_templates_select_staff on public.wa_templates for select to authenticated
  using ((select app.is_staff()));
create policy wa_templates_write_admin on public.wa_templates for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- ---------------------------------------------------------------------------
-- interviews · staff CRUD · client R (visibles)
-- ---------------------------------------------------------------------------
create policy interviews_all_staff on public.interviews for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy interviews_select_client on public.interviews for select to authenticated
  using ((select app.is_client()) and app.application_visible_to_client(application_id));

-- interview_transcripts · staff R · escribe el service role
create policy interview_transcripts_select_staff on public.interview_transcripts for select to authenticated
  using ((select app.is_staff()));

-- ---------------------------------------------------------------------------
-- psychometric_tests · staff CRUD · client: solo vía v_portal_applications (sin archivo)
-- ---------------------------------------------------------------------------
create policy psychometric_tests_all_staff on public.psychometric_tests for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- document_types · todos R · admin CRUD
create policy document_types_select_all on public.document_types for select to authenticated
  using (true);
create policy document_types_write_admin on public.document_types for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- candidate_documents · staff CRUD · client: solo estado vía v_portal_documents
create policy candidate_documents_all_staff on public.candidate_documents for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- ---------------------------------------------------------------------------
-- report_runs · staff R · client R (propios) · escribe el service role
-- ---------------------------------------------------------------------------
create policy report_runs_select_staff on public.report_runs for select to authenticated
  using ((select app.is_staff()));
create policy report_runs_select_client on public.report_runs for select to authenticated
  using (client_id = (select app.client_id()) and type in ('daily_client', 'weekly_client'));

-- ai_insights · admin R
create policy ai_insights_select_admin on public.ai_insights for select to authenticated
  using ((select app.is_admin()));

-- ai_runs, webhook_events, scheduled_tasks, audit_log · admin R · escribe el service role
create policy ai_runs_select_admin on public.ai_runs for select to authenticated
  using ((select app.is_admin()));
create policy webhook_events_select_admin on public.webhook_events for select to authenticated
  using ((select app.is_admin()));
create policy scheduled_tasks_select_admin on public.scheduled_tasks for select to authenticated
  using ((select app.is_admin()));
create policy audit_log_select_admin on public.audit_log for select to authenticated
  using ((select app.is_admin()));

-- user_integrations · cada quien la suya
create policy user_integrations_all_self on public.user_integrations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- =====================================================================
-- 0010_rpc.sql
-- =====================================================================

-- 0010 · Funciones RPC

-- ---------------------------------------------------------------------------
-- Decisión del cliente (Vo.Bo. / no continuar). SECURITY DEFINER: valida rol,
-- client_id y etapa. El cliente nunca hace UPDATE directo sobre applications.
-- ---------------------------------------------------------------------------
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

  return jsonb_build_object('id', v_app.id, 'stage', v_app.stage, 'decided_at', v_app.client_decision_at);
end;
$$;

revoke execute on function public.client_decide_application from public, anon;
grant execute on function public.client_decide_application to authenticated;

-- ---------------------------------------------------------------------------
-- Cola: tomar tareas con FOR UPDATE SKIP LOCKED. Solo service role (cron).
-- ---------------------------------------------------------------------------
create or replace function public.claim_scheduled_tasks(
  p_limit  int default 10,
  p_worker text default null
)
returns setof public.scheduled_tasks
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id
    from public.scheduled_tasks
    where status = 'pending'
      and run_at <= now()
    order by run_at
    limit p_limit
    for update skip locked
  )
  update public.scheduled_tasks t
  set status    = 'running',
      locked_at = now(),
      locked_by = p_worker,
      attempts  = attempts + 1
  from picked
  where t.id = picked.id
  returning t.*;
$$;

-- Cierre de tarea con backoff exponencial: run_at = now() + 2^attempts minutos.
create or replace function public.finish_scheduled_task(
  p_task_id uuid,
  p_ok      boolean,
  p_error   text default null
)
returns public.scheduled_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.scheduled_tasks;
begin
  select * into v_task from public.scheduled_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Tarea % no encontrada', p_task_id;
  end if;

  if p_ok then
    update public.scheduled_tasks
    set status = 'done', finished_at = now(), locked_at = null, locked_by = null, last_error = null
    where id = p_task_id
    returning * into v_task;
  elsif v_task.attempts >= v_task.max_attempts then
    update public.scheduled_tasks
    set status = 'failed', finished_at = now(), locked_at = null, locked_by = null, last_error = p_error
    where id = p_task_id
    returning * into v_task;
  else
    update public.scheduled_tasks
    set status = 'pending', locked_at = null, locked_by = null, last_error = p_error,
        run_at = now() + (power(2, v_task.attempts) * interval '1 minute')
    where id = p_task_id
    returning * into v_task;
  end if;

  return v_task;
end;
$$;

-- Encolar con dedupe: si ya hay una tarea pendiente/corriendo con la misma clave, no duplica.
create or replace function public.enqueue_task(
  p_type       text,
  p_payload    jsonb default '{}'::jsonb,
  p_run_at     timestamptz default now(),
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.scheduled_tasks (type, payload, run_at, dedupe_key)
  values (p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_run_at, now()), p_dedupe_key)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pending', 'running') do nothing
  returning id into v_id;

  if v_id is null and p_dedupe_key is not null then
    select id into v_id from public.scheduled_tasks
    where dedupe_key = p_dedupe_key and status in ('pending', 'running')
    limit 1;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.claim_scheduled_tasks  from public, anon, authenticated;
revoke execute on function public.finish_scheduled_task  from public, anon, authenticated;
revoke execute on function public.enqueue_task           from public, anon;
grant  execute on function public.claim_scheduled_tasks  to service_role;
grant  execute on function public.finish_scheduled_task  to service_role;
-- El staff puede encolar desde Server Actions (p. ej. reenviar template); el cliente no.
grant  execute on function public.enqueue_task           to service_role, authenticated;

create or replace function app.enqueue_task_guard()
returns trigger
language plpgsql
as $$
begin
  if not (app.is_staff() or app.is_service()) then
    raise exception 'Sin permiso para encolar tareas' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger scheduled_tasks_insert_guard
  before insert on public.scheduled_tasks
  for each row execute function app.enqueue_task_guard();

-- ---------------------------------------------------------------------------
-- Registro de auditoría desde la app (lecturas de documentos). Lo llama el
-- servidor con la sesión del usuario; se guarda quién y desde qué IP.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action      public.audit_action,
  p_entity_type text,
  p_entity_id   uuid,
  p_ip          text default null,
  p_metadata    jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (user_id, action, entity_type, entity_id, ip, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, nullif(p_ip, '')::inet, p_metadata);
$$;

revoke execute on function public.log_audit from public, anon;
grant execute on function public.log_audit to authenticated, service_role;


-- =====================================================================
-- 0011_views.sql
-- =====================================================================

-- 0011 · Vistas
--
-- v_pipeline y v_bi_* son security_invoker: aplican las políticas del que consulta.
-- v_portal_* son security definer (dueño postgres) con filtro explícito por
-- app.client_id(): así el cliente ve estado y veredicto pero nunca las columnas
-- internas ni las rutas de archivos.

-- ---------------------------------------------------------------------------
-- v_pipeline: lo que pintan el kanban, la lista y el tablero
-- ---------------------------------------------------------------------------
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
  wc.last_inbound_at                    as wa_last_inbound_at
from public.applications a
join public.candidates c    on c.id = a.candidate_id
join public.job_profiles p  on p.id = a.profile_id
join public.clients cl      on cl.id = p.client_id
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

-- ---------------------------------------------------------------------------
-- Portal del cliente
-- ---------------------------------------------------------------------------
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
  and (p.client_id = app.client_id() or app.is_staff());

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
  and (p.client_id = app.client_id() or app.is_staff());

-- Las vistas definer necesitan grant explícito; las invoker heredan de las tablas.
grant select on public.v_portal_applications to authenticated;
grant select on public.v_portal_documents    to authenticated;

-- ---------------------------------------------------------------------------
-- BI interno (solo staff)
-- ---------------------------------------------------------------------------

-- Embudo: cuántas postulaciones tocaron cada etapa, por perfil
create or replace view public.v_bi_funnel
with (security_invoker = true)
as
select
  p.client_id,
  p.id                          as profile_id,
  p.title                       as profile_title,
  e.to_stage                    as stage,
  app.stage_order(e.to_stage)   as stage_order,
  count(distinct e.application_id) as applications
from public.application_stage_events e
join public.applications a on a.id = e.application_id
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, e.to_stage;

-- Canal: postulantes y contratados por canal de origen
create or replace view public.v_bi_channel
with (security_invoker = true)
as
select
  p.client_id,
  p.id               as profile_id,
  p.title            as profile_title,
  a.source_channel,
  count(*)                                              as applications,
  count(*) filter (where a.stage = 'hired')             as hired,
  count(*) filter (where a.stage = 'discarded')         as discarded,
  count(*) filter (where a.prefilter_status = 'passed') as prefilter_passed
from public.applications a
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, a.source_channel;

-- Duración por etapa: horas entre entrar a una etapa y salir de ella
create or replace view public.v_bi_stage_durations
with (security_invoker = true)
as
with spans as (
  select
    e.application_id,
    e.to_stage                                   as stage,
    e.created_at                                 as entered_at,
    lead(e.created_at) over (partition by e.application_id order by e.created_at) as left_at
  from public.application_stage_events e
)
select
  p.client_id,
  p.id                                   as profile_id,
  p.title                                as profile_title,
  s.stage,
  app.stage_order(s.stage)               as stage_order,
  count(*)                               as samples,
  round(avg(extract(epoch from (s.left_at - s.entered_at)) / 3600)::numeric, 1)    as avg_hours,
  round((percentile_cont(0.5) within group (order by extract(epoch from (s.left_at - s.entered_at)) / 3600))::numeric, 1) as median_hours
from spans s
join public.applications a on a.id = s.application_id
join public.job_profiles p on p.id = a.profile_id
where s.left_at is not null
  and app.is_staff()
group by p.client_id, p.id, p.title, s.stage;

-- Motivos de descarte por perfil y etapa de origen
create or replace view public.v_bi_discard_reasons
with (security_invoker = true)
as
select
  p.client_id,
  p.id                    as profile_id,
  p.title                 as profile_title,
  a.discarded_from_stage,
  a.discard_reason_key,
  count(*)                as applications
from public.applications a
join public.job_profiles p on p.id = a.profile_id
where a.stage = 'discarded'
  and app.is_staff()
group by p.client_id, p.id, p.title, a.discarded_from_stage, a.discard_reason_key;

-- Preguntas del prefiltro que más descartan
create or replace view public.v_bi_prefilter_failures
with (security_invoker = true)
as
select
  p.client_id,
  p.id                 as profile_id,
  p.title              as profile_title,
  pa.question_key,
  count(*)                                   as answered,
  count(*) filter (where pa.passes = false)  as failed
from public.prefilter_answers pa
join public.applications a on a.id = pa.application_id
join public.job_profiles p on p.id = a.profile_id
where app.is_staff()
group by p.client_id, p.id, p.title, pa.question_key;


-- =====================================================================
-- 0012_storage.sql
-- =====================================================================

-- 0012 · Storage: buckets privados
--
-- Sin políticas sobre storage.objects para authenticated: toda lectura y
-- escritura pasa por el servidor con service role (URL firmada de 60 s tras
-- verificar rol + audit_log; subida con createSignedUploadUrl).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs',           'cvs',           false,  20971520, array['application/pdf']),
  ('documents',     'documents',     false,  20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('psychometrics', 'psychometrics', false,  33554432, array['application/pdf']),
  ('wa-media',      'wa-media',      false, 104857600, null),
  ('reports',       'reports',       false,  20971520, array['application/pdf', 'text/html'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- =====================================================================
-- Historial de migraciones (opcional): deja el registro como si lo hubiera
-- aplicado el CLI, para que un futuro `supabase db push` no las repita.
-- =====================================================================

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0001', 'extensions_enums'),
  ('0002', 'helpers'),
  ('0003', 'identity'),
  ('0004', 'clients_profiles'),
  ('0005', 'candidates_applications'),
  ('0006', 'whatsapp'),
  ('0007', 'interviews_psych_docs'),
  ('0008', 'reports_system'),
  ('0009', 'rls'),
  ('0010', 'rpc'),
  ('0011', 'views'),
  ('0012', 'storage')
on conflict (version) do nothing;
