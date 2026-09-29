import "server-only";
import { requireClient } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { Enums } from "@/lib/db/types";
import type { PortalApplication, PortalApplicationDetail, ReportRun, WeeklyReport } from "./types";

export type { PortalApplication, PortalDocument } from "./types";

/** En demo, el cliente ve Telasist salvo que su client_id sea otro cliente de demo. */
async function mockClientId(): Promise<string> {
  const session = await requireClient();
  return mock.clients.some((c) => c.id === session.clientId) ? session.clientId! : mock.IDS.telasist;
}

export async function listPortalApplications(): Promise<PortalApplication[]> {
  await requireClient();
  if (MOCK) {
    const cid = await mockClientId();
    return mock.portalRows.filter((r) => r.client_id === cid).sort((a, b) => (b.stage_order ?? 0) - (a.stage_order ?? 0) || (b.stage_changed_at ?? "").localeCompare(a.stage_changed_at ?? ""));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_portal_applications").select("*").order("stage_order", { ascending: false }).order("stage_changed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPortalApplication(applicationId: string): Promise<PortalApplicationDetail | null> {
  await requireClient();
  if (MOCK) {
    const cid = await mockClientId();
    const application = mock.portalRows.find((r) => r.application_id === applicationId && r.client_id === cid);
    if (!application) return null;
    return { application, documents: mock.portalDocuments.filter((d) => d.application_id === applicationId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) };
  }
  const supabase = await createClient();
  const [{ data: application, error }, { data: documents }] = await Promise.all([
    supabase.from("v_portal_applications").select("*").eq("application_id", applicationId).maybeSingle(),
    supabase.from("v_portal_documents").select("*").eq("application_id", applicationId).order("sort_order"),
  ]);
  if (error) throw error;
  if (!application) return null;
  return { application, documents: documents ?? [] };
}

export async function listPortalProfiles() {
  await requireClient();
  if (MOCK) {
    const cid = await mockClientId();
    return mock.profiles.filter((p) => p.client_id === cid && p.status !== "intake").map((p) => ({ id: p.id, title: p.title, status: p.status, openings: p.openings, work_zone: p.work_zone, created_at: p.created_at }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_profiles").select("id, title, status, openings, work_zone, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPortalReports(type?: Enums<"report_type">): Promise<ReportRun[]> {
  await requireClient();
  if (MOCK) {
    const cid = await mockClientId();
    return mock.reportRuns.filter((r) => r.client_id === cid && r.status === "sent" && (!type || r.type === type)).sort((a, b) => (b.period_start ?? "").localeCompare(a.period_start ?? ""));
  }
  const supabase = await createClient();
  let query = supabase.from("report_runs").select("*").eq("status", "sent").order("period_start", { ascending: false }).limit(20);
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Reporte semanal en pantalla: embudo, canal, avances y siguientes pasos de la última semana. */
export async function getWeeklyReport(): Promise<WeeklyReport> {
  const session = await requireClient();
  const apps = await listPortalApplications();
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 864e5);
  const inWeek = (iso: string | null) => !!iso && new Date(iso) >= start;
  const advanced = apps.filter((a) => inWeek(a.stage_changed_at) && a.stage !== "hired");
  const hired = apps.filter((a) => a.stage === "hired");
  const nextSteps = [
    ...apps.filter((a) => a.stage === "client_interview" && !a.client_interview_at).map((a) => `Agendar entrevista con ${a.full_name} (${a.profile_title}).`),
    ...apps.filter((a) => a.stage === "client_interview" && a.client_interview_at).map((a) => `Entrevista con ${a.full_name} el ${new Date(a.client_interview_at!).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}; después, Vo.Bo. o no continuar desde el portal.`),
    ...apps.filter((a) => a.stage === "documents").map((a) => `${a.full_name} completa su expediente (${a.docs_validated ?? 0} de ${a.docs_required ?? 10}).`),
  ];

  if (MOCK) {
    const cid = await mockClientId();
    const client = mock.clientById(cid);
    return {
      client_name: client.name, period_start: start.toISOString(), period_end: end.toISOString(),
      funnel: mock.funnelRows.filter((r) => r.client_id === cid), channel: mock.channelRows.filter((r) => r.client_id === cid),
      advanced, hired, next_steps: nextSteps, report: mock.reportRuns.find((r) => r.client_id === cid && r.type === "weekly_client" && r.status === "sent") ?? null,
    };
  }

  const supabase = await createClient();
  const [{ data: client }, { data: report }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", session.clientId!).maybeSingle(),
    supabase.from("report_runs").select("*").eq("type", "weekly_client").eq("status", "sent").order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Las vistas v_bi_* son solo staff: el portal arma el embudo desde sus propias filas.
  const stages = ["psychometric", "documents", "client_interview", "hired"] as const;
  const funnel = stages.map((stage, i) => ({ client_id: session.clientId, profile_id: null, profile_title: null, stage, stage_order: i + 5, applications: apps.filter((a) => (a.stage_order ?? 0) >= i + 5 && a.stage !== "discarded").length }));
  return { client_name: client?.name ?? "", period_start: start.toISOString(), period_end: end.toISOString(), funnel, channel: [], advanced, hired, next_steps: nextSteps, report: report ?? null };
}

/** Vo.Bo. / no continuar. La RPC valida rol, empresa y etapa en SQL. */
export async function decideApplication(applicationId: string, decision: Enums<"client_decision">, comment?: string) {
  await requireClient();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_decide_application", { p_application_id: applicationId, p_decision: decision, p_comment: comment ?? undefined });
  if (error) throw error;
  return data;
}
