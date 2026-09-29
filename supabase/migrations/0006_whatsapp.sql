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
