import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/db/types";
import { HANDLERS, isTaskType, type TaskOutcome, type TaskType } from "./handlers";

// Ejecutor de la cola (tasks.md §3). Lo llaman el cron diario (/api/cron/tick) y, para no
// esperar al cron, el after() de quien encola (runTaskNow). Toma tareas con FOR UPDATE SKIP LOCKED,
// así que dos ejecutores a la vez no corren la misma. Una tarea que se queda colgada (la función se
// cortó) se vuelve a tomar a los 10 minutos (migración 0022).

type Task = Tables<"scheduled_tasks">;

export type TaskReport = { id: string; type: string; ok: boolean; detail?: string; error?: string };

const CONCURRENCY = 4;

async function execute(task: Task): Promise<TaskOutcome> {
  if (!isTaskType(task.type)) return { ok: false, error: `Tipo de tarea desconocido: ${task.type}`, retry: false };
  const h = HANDLERS[task.type];
  const payload = h.payload.safeParse(task.payload);
  if (!payload.success) return { ok: false, error: `Payload no válido: ${payload.error.issues[0]?.message ?? "sin detalle"}`, retry: false };
  try {
    // @ts-expect-error: el payload ya pasó por el esquema de este mismo handler
    return await h.run(payload.data, createAdminClient());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retry: true };
  }
}

async function finish(task: Task, outcome: TaskOutcome): Promise<TaskReport> {
  const { error } = await createAdminClient().rpc("finish_scheduled_task", {
    p_task_id: task.id,
    p_ok: outcome.ok,
    p_error: outcome.ok ? undefined : outcome.error.slice(0, 2000),
    p_retry: outcome.ok ? undefined : outcome.retry,
  });
  if (error) console.error("[queue] finish", task.id, error.message);
  return outcome.ok ? { id: task.id, type: task.type, ok: true, detail: outcome.detail } : { id: task.id, type: task.type, ok: false, error: outcome.error };
}

async function claim(limit: number, worker: string, only?: string): Promise<Task[]> {
  const { data, error } = await createAdminClient().rpc("claim_scheduled_tasks", { p_limit: limit, p_worker: worker, p_only: only });
  if (error) throw error;
  return data ?? [];
}

/** Corre lo que ya toca hasta agotar la cola o el tiempo. Devuelve lo que corrió. */
export async function runDueTasks({ budgetMs = 45_000, worker = `tick-${randomUUID().slice(0, 8)}` } = {}): Promise<TaskReport[]> {
  const started = Date.now();
  const reports: TaskReport[] = [];
  while (Date.now() - started < budgetMs) {
    const batch = await claim(CONCURRENCY, worker);
    if (batch.length === 0) break;
    reports.push(...(await Promise.all(batch.map(async (t) => finish(t, await execute(t))))));
    if (batch.length < CONCURRENCY) break;
  }
  return reports;
}

/** Corre una tarea recién encolada sin esperar al cron. Si falla, el cron la reintenta. */
export async function runTaskNow(taskId: string): Promise<TaskReport | null> {
  const [task] = await claim(1, `now-${randomUUID().slice(0, 8)}`, taskId);
  if (!task) return null; // ya la tomó el cron, o no toca todavía
  return finish(task, await execute(task));
}

/**
 * Encola con service role (desde una Server Action ya autorizada, un webhook o el cron).
 * `dedupeKey` evita dos tareas pendientes iguales. Devuelve el id de la tarea.
 */
export async function enqueue(type: TaskType, payload: Record<string, unknown>, opts: { runAt?: Date; dedupeKey?: string } = {}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_task", {
    p_type: type,
    p_payload: payload as Json,
    p_run_at: opts.runAt?.toISOString(),
    p_dedupe_key: opts.dedupeKey,
  });
  if (error || !data) throw new Error(`No se pudo encolar ${type}: ${error?.message ?? "sin id"}`);
  const max = HANDLERS[type].maxAttempts;
  if (max) await admin.from("scheduled_tasks").update({ max_attempts: max }).eq("id", data).eq("status", "pending");
  return data;
}
