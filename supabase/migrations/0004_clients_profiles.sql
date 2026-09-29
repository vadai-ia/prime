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
