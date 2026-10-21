import "server-only";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Tables } from "@/lib/db/types";

export type QueueOverview = {
  pending: number;
  running: number;
  failed: number;
  doneLastDay: number;
  /** Última tarea terminada: si es vieja y hay pendientes, el cron no está corriendo. */
  lastFinishedAt: string | null;
  /** Hay pendientes que debían correr hace más de 25 horas: el cron diario no está llegando. */
  cronStale: boolean;
  /** Fallidas, pendientes y corriendo, más recientes primero. */
  open: Pick<Tables<"scheduled_tasks">, "id" | "type" | "status" | "attempts" | "max_attempts" | "run_at" | "last_error" | "created_at" | "finished_at">[];
};

const EMPTY: QueueOverview = { pending: 0, running: 0, failed: 0, doneLastDay: 0, lastFinishedAt: null, cronStale: false, open: [] };

/** Configuración → Tareas automáticas. Solo admin (RLS: scheduled_tasks_select_admin). */
export async function getQueueOverview(): Promise<QueueOverview> {
  await requireAdmin();
  if (MOCK) return EMPTY;
  const supabase = await createClient();
  const count = (status: Tables<"scheduled_tasks">["status"], since?: string) => {
    let q = supabase.from("scheduled_tasks").select("id", { count: "exact", head: true }).eq("status", status);
    if (since) q = q.gte("finished_at", since);
    return q;
  };
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [pending, running, failed, done, last, open] = await Promise.all([
    count("pending"),
    count("running"),
    count("failed"),
    count("done", dayAgo),
    supabase.from("scheduled_tasks").select("finished_at").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("scheduled_tasks")
      .select("id, type, status, attempts, max_attempts, run_at, last_error, created_at, finished_at")
      .in("status", ["failed", "pending", "running"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (open.error) throw open.error;
  const staleBefore = Date.now() - 25 * 60 * 60_000;
  return {
    pending: pending.count ?? 0,
    running: running.count ?? 0,
    failed: failed.count ?? 0,
    doneLastDay: done.count ?? 0,
    lastFinishedAt: last.data?.finished_at ?? null,
    cronStale: open.data.some((t) => t.status === "pending" && new Date(t.run_at).getTime() < staleBefore),
    open: open.data,
  };
}
