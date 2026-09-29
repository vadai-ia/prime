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
