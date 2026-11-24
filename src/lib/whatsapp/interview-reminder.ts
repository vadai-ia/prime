import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { utcIsoToZoned, zonedToUtcIso } from "@/lib/domain/time";
import { whaapyEnabled } from "@/lib/integrations/whaapy";
import { enqueueOnce, formatWhen, sendSystemTemplate, type Outcome } from "./system-send";

// Recordatorio de entrevista por WhatsApp un día antes (interview_confirm, plan §12.21). El barrido
// diario (interview_reminders, 8:00 con el cron) encola uno por cada entrevista de mañana; si se
// agenda o reagenda cuando ese barrido ya pasó, lo encola la propia Server Action y sale en el momento.

type Admin = ReturnType<typeof createAdminClient>;

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";
/** Hora local del barrido; la misma que el cron diario (vercel.json, 14:00 UTC). */
export const SWEEP_AT = "08:00";
const ACTIVE = ["scheduled", "confirmed"] as const;

export { formatWhen };

/** La llave cambia si cambia la hora: reagendar a otro día deja salir un recordatorio nuevo. */
export function reminderKey(interviewId: string, scheduledAt: string): string {
  return `interview_confirm:${interviewId}:${new Date(scheduledAt).toISOString()}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/**
 * true si el barrido que debía avisar de esta entrevista (el día anterior a las 8:00) ya pasó y
 * la entrevista todavía no empieza: entonces se avisa en el momento.
 */
export function sweepAlreadyPassed(scheduledAt: string, now = new Date()): boolean {
  if (new Date(scheduledAt) <= now) return false;
  const sweep = zonedToUtcIso(addDays(utcIsoToZoned(scheduledAt, TZ).date, -1), SWEEP_AT, TZ);
  return !!sweep && new Date(sweep) <= now;
}

/** Encola el recordatorio si no existe. Devuelve el id de la tarea, o null si ya estaba. */
export async function enqueueInterviewReminder(admin: Admin, interview: { id: string; scheduled_at: string }): Promise<string | null> {
  const scheduled_at = new Date(interview.scheduled_at).toISOString();
  return enqueueOnce(admin, "interview_confirm", { interview_id: interview.id, scheduled_at }, reminderKey(interview.id, scheduled_at));
}

/** Barrido diario: un recordatorio por cada entrevista activa de mañana (día local). */
export async function sweepTomorrowInterviews(admin: Admin, now = new Date()): Promise<Outcome> {
  if (!whaapyEnabled()) return { ok: true, detail: "WhatsApp no está configurado (falta WHAAPY_API_KEY); no se mandó nada" };
  const tomorrow = addDays(utcIsoToZoned(now.toISOString(), TZ).date, 1);
  const from = zonedToUtcIso(tomorrow, "00:00", TZ);
  const to = zonedToUtcIso(addDays(tomorrow, 1), "00:00", TZ);
  if (!from || !to) return { ok: false, error: "No se pudo calcular el día de mañana", retry: false };

  const { data, error } = await admin.from("interviews").select("id, scheduled_at").in("status", [...ACTIVE]).gte("scheduled_at", from).lt("scheduled_at", to);
  if (error) return { ok: false, error: error.message, retry: true };

  let queued = 0;
  for (const iv of data ?? []) {
    if (iv.scheduled_at && (await enqueueInterviewReminder(admin, { id: iv.id, scheduled_at: iv.scheduled_at }))) queued++;
  }
  return { ok: true, detail: `${data?.length ?? 0} entrevistas mañana, ${queued} recordatorios encolados` };
}

/** Manda el recordatorio de una entrevista. Vuelve a revisarla: si se canceló o se movió, no manda nada. */
export async function sendInterviewReminder(admin: Admin, interviewId: string, scheduledAt: string): Promise<Outcome> {
  const { data: iv, error } = await admin.from("interviews").select("id, status, scheduled_at, meeting_url, application_id").eq("id", interviewId).maybeSingle();
  if (error) return { ok: false, error: error.message, retry: true };
  if (!iv) return { ok: true, detail: "La entrevista ya no existe" };
  if (!(ACTIVE as readonly string[]).includes(iv.status)) return { ok: true, detail: `No se mandó: la entrevista está ${iv.status}` };
  if (!iv.scheduled_at || new Date(iv.scheduled_at).getTime() !== new Date(scheduledAt).getTime()) return { ok: true, detail: "No se mandó: la entrevista cambió de hora" };
  if (new Date(iv.scheduled_at) <= new Date()) return { ok: true, detail: "No se mandó: la entrevista ya empezó" };
  if (!iv.meeting_url) return { ok: false, error: "La entrevista no tiene enlace de la videollamada", retry: false };

  const when = formatWhen(iv.scheduled_at);
  const link = iv.meeting_url;
  return sendSystemTemplate(admin, { applicationId: iv.application_id, template: "interview", parameters: (_c, vacancy) => [vacancy, when, link] });
}
