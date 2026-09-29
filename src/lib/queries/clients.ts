import "server-only";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import { listPipeline, countStages } from "./pipeline";
import { RECRUITERS_EMBED, recruiterNames } from "./profiles";
import type { Client, ClientDetail, ClientSummary, PipelineRow, ProfileSummary } from "./types";

const IN_PROCESS = new Set(["prefilter", "cv_review", "prime_interview", "psychometric", "documents", "client_interview"]);

function summarize(client: ClientSummary extends infer T ? Omit<T, "active_profiles" | "in_process" | "hired"> : never, profiles: { client_id: string; status: string }[], rows: PipelineRow[]): ClientSummary {
  const mine = rows.filter((r) => r.client_id === client.id);
  return {
    ...client,
    active_profiles: profiles.filter((p) => p.client_id === client.id && p.status === "active").length,
    in_process: mine.filter((r) => r.stage && IN_PROCESS.has(r.stage)).length,
    hired: mine.filter((r) => r.stage === "hired").length,
  };
}

export async function listClients(opts: { includeInactive?: boolean } = {}): Promise<ClientSummary[]> {
  await requireStaff();
  const rows = await listPipeline({ includeDiscarded: true });

  if (MOCK) {
    return mock.clients.filter((c) => opts.includeInactive || c.is_active).map((c) => summarize(c, mock.profiles, rows));
  }

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, industry, city, contact_name, contact_email, contact_phone, portal_enabled, is_active, client_since")
    .order("name");
  if (!opts.includeInactive) query = query.eq("is_active", true);
  const [{ data: clients, error }, { data: profiles }] = await Promise.all([query, supabase.from("job_profiles").select("client_id, status")]);
  if (error) throw error;
  return clients.map((c) => summarize(c, profiles ?? [], rows));
}

/** Solo la fila de la empresa, para el formulario de edición. */
export async function getClientRow(clientId: string): Promise<Client | null> {
  await requireStaff();
  if (MOCK) return mock.clients.find((c) => c.id === clientId) ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getClient(clientId: string): Promise<ClientDetail | null> {
  await requireStaff();
  const rows = await listPipeline({ clientId, includeDiscarded: true });

  const toProfileSummary = (p: { id: string; client_id: string; title: string; status: ProfileSummary["status"]; openings: number; work_zone: string | null; created_at: string }, clientName: string, threshold: number | null, recruiters: string[]): ProfileSummary => ({
    id: p.id, client_id: p.client_id, title: p.title, status: p.status, openings: p.openings, work_zone: p.work_zone, created_at: p.created_at,
    client_name: clientName, counts: countStages(rows.filter((r) => r.profile_id === p.id)), cv_threshold: threshold, recruiters,
  });

  if (MOCK) {
    const client = mock.clients.find((c) => c.id === clientId);
    if (!client) return null;
    return {
      ...client,
      profiles: mock.profiles.filter((p) => p.client_id === clientId).map((p) => toProfileSummary(p, client.name, mock.aiConfigByProfile(p.id)?.cv_threshold ?? null, mock.recruiterNames(p.id))),
      users: mock.users.filter((u) => u.client_id === clientId).map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, is_active: u.is_active })),
      reports: mock.reportRuns.filter((r) => r.client_id === clientId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }

  const supabase = await createClient();
  const { data: client, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw error;
  if (!client) return null;
  const [{ data: profiles }, { data: users }, { data: reports }] = await Promise.all([
    supabase.from("job_profiles").select(`id, client_id, title, status, openings, work_zone, created_at, job_profile_ai_configs(cv_threshold), ${RECRUITERS_EMBED}`).eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("users").select("id, full_name, email, is_active").eq("client_id", clientId),
    supabase.from("report_runs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    ...client,
    profiles: (profiles ?? []).map((p) => toProfileSummary(p, client.name, p.job_profile_ai_configs?.cv_threshold ?? null, recruiterNames(p.job_profile_assignments))),
    users: users ?? [],
    reports: reports ?? [],
  };
}
