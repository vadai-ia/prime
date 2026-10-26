import "server-only";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Tables } from "@/lib/db/types";

// Logs técnicos (Configuración → Logs técnicos). Solo admin: RLS de ai_runs, scheduled_tasks,
// webhook_events y audit_log ya solo deja leer al admin (0009); aquí se exige igual.

/** `detail`: resumen de lo que devolvió la IA, sin datos personales (hoy solo la lectura del CV). */
export type AiRunRow = Omit<Tables<"ai_runs">, "output"> & { detail: string | null };
export type TaskLogRow = Pick<Tables<"scheduled_tasks">, "id" | "type" | "status" | "attempts" | "max_attempts" | "run_at" | "last_error" | "created_at" | "finished_at">;
export type WebhookRow = Omit<Tables<"webhook_events">, "payload">;
export type AuditRow = Tables<"audit_log"> & { user_name: string | null };

export type AiSummary = { costToday: number; cost7d: number; cost30d: number; runs30d: number; errors7d: number };

export type PromptUsage = { kind: Tables<"ai_runs">["kind"]; prompt_version: string; runs: number; errors: number; cost: number; avgLatencyMs: number | null; lastAt: string };

const LIMIT = 150;

function since(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Gasto y errores de la IA. "Hoy" son las últimas 24 horas. */
export async function getAiSummary(): Promise<AiSummary> {
  await requireAdmin();
  const empty = { costToday: 0, cost7d: 0, cost30d: 0, runs30d: 0, errors7d: 0 };
  if (MOCK) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_runs").select("cost_usd, status, created_at").gte("created_at", since(30)).limit(10000);
  if (error) throw error;
  const d1 = since(1);
  const d7 = since(7);
  return data.reduce((acc, r) => {
    const cost = Number(r.cost_usd ?? 0);
    acc.cost30d += cost;
    acc.runs30d += 1;
    if (r.created_at >= d7) {
      acc.cost7d += cost;
      if (r.status !== "ok") acc.errors7d += 1;
    }
    if (r.created_at >= d1) acc.costToday += cost;
    return acc;
  }, empty);
}

/** Llamadas por tarea y versión de prompt en los últimos 90 días, para comparar una versión con la anterior. */
export async function listPromptUsage(): Promise<PromptUsage[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_runs").select("kind, prompt_version, status, cost_usd, latency_ms, created_at").gte("created_at", since(90)).limit(10000);
  if (error) throw error;
  const groups = new Map<string, PromptUsage & { latencySum: number; latencyCount: number }>();
  for (const r of data) {
    const version = r.prompt_version ?? "sin versión";
    const key = `${r.kind}|${version}`;
    const g = groups.get(key) ?? { kind: r.kind, prompt_version: version, runs: 0, errors: 0, cost: 0, avgLatencyMs: null, lastAt: r.created_at, latencySum: 0, latencyCount: 0 };
    g.runs += 1;
    if (r.status !== "ok") g.errors += 1;
    g.cost += Number(r.cost_usd ?? 0);
    if (r.latency_ms !== null) {
      g.latencySum += r.latency_ms;
      g.latencyCount += 1;
    }
    if (r.created_at > g.lastAt) g.lastAt = r.created_at;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map(({ latencySum, latencyCount, ...g }) => ({ ...g, avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function listAiRuns({ onlyErrors = false }: { onlyErrors?: boolean } = {}): Promise<AiRunRow[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase
    .from("ai_runs")
    .select("id, kind, entity_type, entity_id, model, prompt_version, effort, input_tokens, output_tokens, cache_read_tokens, cost_usd, latency_ms, status, error, created_at, output")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (onlyErrors) query = query.neq("status", "ok");
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ output, ...r }) => ({ ...r, detail: r.kind === "cv_extract" ? cvExtractDetail(output) : null }));
}

const CV_FIELD_LABELS: Record<string, string> = {
  full_name: "nombre",
  phone: "teléfono",
  email: "correo",
  municipality: "municipio",
  education_level: "escolaridad",
  birth_date: "nacimiento",
};

/** Qué campos encontró Claude en el CV (sin sus valores) y la edad tal como la leyó, para revisar la lectura. */
function cvExtractDetail(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.is_cv === false) return "No parece un CV";
  const found = Object.entries(CV_FIELD_LABELS)
    .filter(([k]) => typeof o[k] === "string" && (o[k] as string).trim() !== "")
    .map(([, label]) => label);
  const age = typeof o.age === "number" ? `edad ${o.age}` : "sin edad";
  return found.length ? `Leyó ${found.join(", ")}; ${age}` : `No encontró datos; ${age}`;
}

export async function listTaskLog({ onlyErrors = false }: { onlyErrors?: boolean } = {}): Promise<TaskLogRow[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase
    .from("scheduled_tasks")
    .select("id, type, status, attempts, max_attempts, run_at, last_error, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (onlyErrors) query = query.not("last_error", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWebhookLog({ onlyErrors = false }: { onlyErrors?: boolean } = {}): Promise<WebhookRow[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase
    .from("webhook_events")
    .select("id, source, event_type, external_id, received_at, processed_at, error, attempts")
    .order("received_at", { ascending: false })
    .limit(LIMIT);
  if (onlyErrors) query = query.not("error", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Quién abrió CVs, documentos y psicométricos, y quién exportó. */
export async function listAuditLog(): Promise<AuditRow[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_log").select("*, users(full_name, email)").order("created_at", { ascending: false }).limit(LIMIT);
  if (error) throw error;
  return data.map(({ users, ...r }) => ({ ...r, user_name: users ? users.full_name || users.email : null }));
}
