// DTOs que consumen las páginas. Los datos de demo (src/lib/mock) y las
// consultas reales producen exactamente estas formas.
import type { Enums, Tables } from "@/lib/db/types";

export type Stage = Enums<"application_stage">;
export type Role = Enums<"user_role">;
export type SourceChannel = Enums<"source_channel">;

// Filas de tablas
export type Client = Tables<"clients">;
export type JobProfile = Tables<"job_profiles">;
export type AiConfig = Tables<"job_profile_ai_configs">;
export type Intake = Tables<"job_intakes">;
export type Candidate = Tables<"candidates">;
export type Application = Tables<"applications">;
export type StageEvent = Tables<"application_stage_events">;
export type PrefilterAnswer = Tables<"prefilter_answers">;
export type WaConversation = Tables<"wa_conversations">;
export type WaMessage = Tables<"wa_messages">;
export type WaTemplate = Tables<"wa_templates">;
export type Interview = Tables<"interviews">;
export type PsychTest = Tables<"psychometric_tests">;
export type DocumentType = Tables<"document_types">;
export type CandidateDocument = Tables<"candidate_documents">;
export type ReportRun = Tables<"report_runs">;
export type AiInsight = Tables<"ai_insights">;
export type User = Tables<"users">;
export type ProfileAssignment = Tables<"job_profile_assignments">;
export type AssignmentEvent = Tables<"job_profile_assignment_events">;

// Filas de vistas
export type PipelineRow = Tables<"v_pipeline">;
export type PortalApplication = Tables<"v_portal_applications">;
export type PortalDocument = Tables<"v_portal_documents">;
export type FunnelRow = Tables<"v_bi_funnel">;
export type ChannelRow = Tables<"v_bi_channel">;
export type StageDurationRow = Tables<"v_bi_stage_durations">;
export type DiscardReasonRow = Tables<"v_bi_discard_reasons">;
export type PrefilterFailureRow = Tables<"v_bi_prefilter_failures">;

export type StageCounts = Record<Stage, number>;

// Compuestos
export type ClientSummary = Pick<
  Client,
  "id" | "name" | "industry" | "city" | "contact_name" | "contact_email" | "contact_phone" | "portal_enabled" | "is_active" | "client_since"
> & { active_profiles: number; in_process: number; hired: number };

export type ProfileSummary = Pick<JobProfile, "id" | "client_id" | "title" | "status" | "openings" | "work_zone" | "created_at"> & {
  client_name: string;
  counts: StageCounts;
  cv_threshold: number | null;
  /** Nombres de los reclutadores asignados. Completo para admin; el reclutador solo lee su propia asignación. */
  recruiters: string[];
};

export type ClientDetail = Client & {
  profiles: ProfileSummary[];
  users: Pick<User, "id" | "full_name" | "email" | "is_active">[];
  reports: ReportRun[];
};

export type ProfileDetail = JobProfile & {
  client_name: string;
  ai_config: AiConfig | null;
  intake: Pick<Intake, "id" | "form" | "status" | "created_at"> | null;
  counts: StageCounts;
};

export type RecruiterOption = Pick<User, "id" | "full_name" | "email" | "avatar_url">;

/** Checklist de reclutadores de una vacante y su historial (solo admin). */
export type ProfileRecruiters = {
  recruiters: (RecruiterOption & { assigned: boolean; assigned_at: string | null })[];
  history: (AssignmentEvent & { recruiter_name: string; actor_name: string | null })[];
};

/** Una postulación de la misma persona (RPC candidate_history_by_phone). Vacante y cliente se ven aunque no sea suya; abrirla, solo si is_mine. */
export type CandidateHistoryRow = {
  application_id: string;
  profile_title: string;
  client_name: string;
  stage: Stage;
  applied_at: string;
  stage_changed_at: string;
  discard_reason_key: Enums<"discard_reason_key"> | null;
  recruiter_name: string | null;
  is_mine: boolean;
};

export type DocumentWithType = CandidateDocument & { label: string; required: boolean; sort_order: number };

export type ApplicationDetail = {
  pipeline: PipelineRow;
  candidate: Candidate;
  application: Application;
  events: StageEvent[];
  prefilterAnswers: PrefilterAnswer[];
  conversation: (WaConversation & { messages: WaMessage[] }) | null;
  interviews: Interview[];
  psych: PsychTest | null;
  documents: DocumentWithType[];
  documentTypes: DocumentType[];
  aiConfig: AiConfig | null;
};

export type InterviewRow = Interview & {
  candidate_name: string;
  profile_title: string;
  client_name: string;
  interviewer_name: string | null;
  stage: Stage;
};

export type UserRow = User & { client_name: string | null };

export type IntegrationStatus = {
  key: "supabase" | "anthropic" | "whaapy" | "fireflies" | "microsoft" | "resend" | "cron";
  label: string;
  configured: boolean;
  detail: string;
};

export type PortalApplicationDetail = { application: PortalApplication; documents: PortalDocument[] };

export type WeeklyReport = {
  client_name: string;
  period_start: string;
  period_end: string;
  funnel: FunnelRow[];
  channel: ChannelRow[];
  advanced: PortalApplication[];
  hired: PortalApplication[];
  next_steps: string[];
  report: ReportRun | null;
};
