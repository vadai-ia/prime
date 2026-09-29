import "server-only";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import { countStages } from "@/lib/metrics";
import type { ApplicationDetail, CandidateHistoryRow, DocumentWithType, PipelineRow, SourceChannel, Stage, StageCounts } from "./types";

export { STAGES, STAGE_LABELS } from "@/lib/labels";
export type { PipelineRow, Stage } from "./types";

export type PipelineFilters = {
  profileId?: string;
  clientId?: string;
  stage?: Stage;
  channel?: SourceChannel;
  search?: string;
  includeDiscarded?: boolean;
};

function applyFilters(rows: PipelineRow[], f: PipelineFilters): PipelineRow[] {
  return rows
    .filter((r) => !f.profileId || r.profile_id === f.profileId)
    .filter((r) => !f.clientId || r.client_id === f.clientId)
    .filter((r) => (f.stage ? r.stage === f.stage : f.includeDiscarded || r.stage !== "discarded"))
    .filter((r) => !f.channel || r.source_channel === f.channel)
    .filter((r) => !f.search || (r.full_name ?? "").toLowerCase().includes(f.search.toLowerCase()))
    .sort((a, b) => (a.stage_order ?? 0) - (b.stage_order ?? 0) || (b.stage_changed_at ?? "").localeCompare(a.stage_changed_at ?? ""));
}

/** Kanban, lista y tablero (plan §3.11). Solo staff. */
export async function listPipeline(filters: PipelineFilters = {}): Promise<PipelineRow[]> {
  await requireStaff();
  if (MOCK) return applyFilters(mock.pipelineRows, filters);

  const supabase = await createClient();
  let query = supabase.from("v_pipeline").select("*").order("stage_order").order("stage_changed_at", { ascending: false });
  if (filters.profileId) query = query.eq("profile_id", filters.profileId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.stage) query = query.eq("stage", filters.stage);
  else if (!filters.includeDiscarded) query = query.neq("stage", "discarded");
  if (filters.channel) query = query.eq("source_channel", filters.channel);
  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export { countStages } from "@/lib/metrics";

export async function countByStage(filters: Pick<PipelineFilters, "profileId" | "clientId"> = {}): Promise<StageCounts> {
  return countStages(await listPipeline({ ...filters, includeDiscarded: true }));
}

export async function getPipelineRow(applicationId: string): Promise<PipelineRow | null> {
  await requireStaff();
  if (MOCK) return mock.pipelineRows.find((r) => r.application_id === applicationId) ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_pipeline").select("*").eq("application_id", applicationId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Ficha completa del candidato (drawer con sus cinco pestañas). */
export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
  await requireStaff();

  if (MOCK) {
    const pipeline = mock.pipelineRows.find((r) => r.application_id === applicationId);
    const application = mock.applications.find((a) => a.id === applicationId);
    if (!pipeline || !application) return null;
    const candidate = mock.candidates.find((c) => c.id === application.candidate_id)!;
    const conv = mock.waConversations.find((w) => w.application_id === applicationId) ?? mock.waConversations.find((w) => w.candidate_id === candidate.id) ?? null;
    return {
      pipeline,
      candidate,
      application,
      events: mock.stageEvents.filter((e) => e.application_id === applicationId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      prefilterAnswers: mock.prefilterAnswers.filter((p) => p.application_id === applicationId),
      conversation: conv ? { ...conv, messages: mock.waMessages.filter((m) => m.conversation_id === conv.id).sort((a, b) => a.created_at.localeCompare(b.created_at)) } : null,
      interviews: mock.interviews.filter((i) => i.application_id === applicationId).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")),
      psych: mock.psychTests.filter((t) => t.application_id === applicationId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
      documents: withTypes(mock.candidateDocuments.filter((d) => d.candidate_id === candidate.id), mock.documentTypes),
      documentTypes: mock.documentTypes,
      aiConfig: mock.aiConfigByProfile(application.profile_id),
    };
  }

  const supabase = await createClient();
  const [{ data: pipeline }, { data: application }] = await Promise.all([
    supabase.from("v_pipeline").select("*").eq("application_id", applicationId).maybeSingle(),
    supabase.from("applications").select("*").eq("id", applicationId).maybeSingle(),
  ]);
  if (!pipeline || !application) return null;

  const [candidate, events, answers, conv, interviews, psych, docs, docTypes, aiConfig] = await Promise.all([
    supabase.from("candidates").select("*").eq("id", application.candidate_id).single(),
    supabase.from("application_stage_events").select("*").eq("application_id", applicationId).order("created_at"),
    supabase.from("prefilter_answers").select("*").eq("application_id", applicationId).order("answered_at"),
    supabase.from("wa_conversations").select("*").eq("candidate_id", application.candidate_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("interviews").select("*").eq("application_id", applicationId).order("scheduled_at"),
    supabase.from("psychometric_tests").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("candidate_documents").select("*").eq("candidate_id", application.candidate_id).order("created_at"),
    supabase.from("document_types").select("*").order("sort_order"),
    supabase.from("job_profile_ai_configs").select("*").eq("profile_id", application.profile_id).maybeSingle(),
  ]);
  if (candidate.error) throw candidate.error;

  let messages: ApplicationDetail["conversation"] = null;
  if (conv.data) {
    const { data } = await supabase.from("wa_messages").select("*").eq("conversation_id", conv.data.id).order("created_at");
    messages = { ...conv.data, messages: data ?? [] };
  }

  return {
    pipeline,
    candidate: candidate.data,
    application,
    events: events.data ?? [],
    prefilterAnswers: answers.data ?? [],
    conversation: messages,
    interviews: interviews.data ?? [],
    psych: psych.data ?? null,
    documents: withTypes(docs.data ?? [], docTypes.data ?? []),
    documentTypes: docTypes.data ?? [],
    aiConfig: aiConfig.data ?? null,
  };
}

function withTypes(docs: ApplicationDetail["documents"][number] extends infer T ? Omit<T, "label" | "required" | "sort_order">[] : never, types: ApplicationDetail["documentTypes"]): DocumentWithType[] {
  return docs
    .map((d) => {
      const t = types.find((x) => x.key === d.document_type_key);
      return { ...d, label: t?.label ?? d.document_type_key, required: t?.required ?? true, sort_order: t?.sort_order ?? 0 };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Todas las postulaciones de la persona con ese teléfono, la más reciente primero: "ya se envió a X cliente hace 2 meses".
 * Es una divulgación acotada a propósito (junta del 11 sep 2026): trae vacante, cliente, etapa y reclutador de postulaciones
 * ajenas, sin abrir acceso a ellas.
 */
export async function getCandidateHistory(phoneE164: string): Promise<CandidateHistoryRow[]> {
  await requireStaff();
  if (MOCK) {
    const person = mock.candidates.find((c) => c.phone_e164 === phoneE164);
    if (!person) return [];
    return mock.pipelineRows
      .filter((r) => r.candidate_id === person.id)
      .sort((a, b) => (b.applied_at ?? "").localeCompare(a.applied_at ?? ""))
      .map((r) => ({
        application_id: r.application_id!, profile_title: r.profile_title ?? "", client_name: r.client_name ?? "", stage: r.stage!, applied_at: r.applied_at!,
        stage_changed_at: r.stage_changed_at!, discard_reason_key: r.discard_reason_key, recruiter_name: r.assigned_recruiter_name, is_mine: true,
      }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("candidate_history_by_phone", { p_phone: phoneE164 });
  if (error) throw error;
  return data;
}
