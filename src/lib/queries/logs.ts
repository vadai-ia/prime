import "server-only";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Tables } from "@/lib/db/types";

// Logs técnicos (Configuración → Logs técnicos). Solo admin: RLS de ai_runs, scheduled_tasks,
// webhook_events y audit_log ya solo deja leer al admin (0009); aquí se exige igual.

export type AiRunRow = Omit<Tables<"ai_runs">, "output">;
export type TaskLogRow = Pick<Tables<"scheduled_tasks">, "id" | "type" | "status" | "attempts" | "max_attempts" | "run_at" | "last_error" | "created_at" | "finished_at">;
export type WebhookRow = Omit<Tables<"webhook_events">, "payload">;
export type AuditRow = Tables<"audit_log"> & { user_name: string | null };

export type AiSummary = { costToday: number; cost7d: number; cost30d: number; runs30d: number; errors7d: number };

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

export async function listAiRuns({ onlyErrors = false }: { onlyErrors?: boolean } = {}): Promise<AiRunRow[]> {
  await requireAdmin();
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase
    .from("ai_runs")
    .select("id, kind, entity_type, entity_id, model, prompt_version, effort, input_tokens, output_tokens, cache_read_tokens, cost_usd, latency_ms, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (onlyErrors) query = query.neq("status", "ok");
  const { data, error } = await query;
  if (error) throw error;
  return data;
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
