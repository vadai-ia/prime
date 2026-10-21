import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TaskType } from "./handlers";

// Tareas que se repiten. El cron (diario en Hobby) revisa esta lista y encola la que ya toca, una sola
// vez por día: la llave `tipo:fecha` se busca en toda la cola (no solo en pendientes), así que una
// tarea ya terminada hoy no se vuelve a encolar. Aquí entrarán los tres correos (tasks.md §3).

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

type Recurring = { type: TaskType; /** Hora local "HH:MM" a partir de la cual corre ese día. */ dailyAt: string };

export const RECURRING: Recurring[] = [{ type: "followups_due", dailyAt: "08:00" }];

/** Fecha y hora en la zona de la app: { date: "2026-10-20", time: "08:05" }. */
export function localNow(now = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Las que tocan hoy y todavía no se encolaron. */
export function dueRecurring(now = new Date()): { type: TaskType; dedupeKey: string }[] {
  const { date, time } = localNow(now);
  return RECURRING.filter((r) => time >= r.dailyAt).map((r) => ({ type: r.type, dedupeKey: `${r.type}:${date}` }));
}

export async function enqueueRecurring(admin: ReturnType<typeof createAdminClient>, now = new Date()): Promise<string[]> {
  const due = dueRecurring(now);
  if (due.length === 0) return [];
  const { data: existing, error } = await admin
    .from("scheduled_tasks")
    .select("dedupe_key")
    .in("dedupe_key", due.map((d) => d.dedupeKey));
  if (error) throw error;
  const seen = new Set((existing ?? []).map((r) => r.dedupe_key));

  const queued: string[] = [];
  for (const d of due.filter((x) => !seen.has(x.dedupeKey))) {
    const { error: enqueueError } = await admin.rpc("enqueue_task", { p_type: d.type, p_dedupe_key: d.dedupeKey });
    if (enqueueError) throw enqueueError;
    queued.push(d.dedupeKey);
  }
  return queued;
}
