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
