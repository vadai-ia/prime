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
