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
