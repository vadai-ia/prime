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
