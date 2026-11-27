import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { utcIsoToZoned, zonedToUtcIso } from "@/lib/domain/time";
import { whaapyEnabled } from "@/lib/integrations/whaapy";
import { getAccessToken, getEventJoinUrl } from "@/lib/integrations/microsoft-graph";
import { doneAt, enqueueOnce, formatWhen, sendSystemTemplate, type Outcome } from "./system-send";

// Entrevista por WhatsApp con la plantilla confirmacion_entrevista_utility (interview_confirm, plan
// §12.21). Sale dos veces: al agendar o reagendar, en el momento (kind "scheduled"), y un día antes
// a las 8:00 con el barrido diario (interview_reminders, kind "reminder"). El recordatorio no sale si
// la confirmación salió hace menos de RECENT_HOURS (se agendó hoy para mañana).

type Admin = ReturnType<typeof createAdminClient>;

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";
/** Hora local del barrido; la misma que el cron diario (vercel.json, 14:00 UTC). */
export const SWEEP_AT = "08:00";
const ACTIVE = ["scheduled", "confirmed"] as const;

export { formatWhen };

export type InterviewMessageKind = "scheduled" | "reminder";
/** Si la confirmación salió hace menos de esto, el recordatorio del día anterior ya no se manda. */
const RECENT_HOURS = 18;

/** Confirmación al agendar: una por entrevista y hora (reagendar a otra hora manda otra). */
export function scheduledKey(interviewId: string, scheduledAt: string): string {
  return `interview_scheduled:${interviewId}:${new Date(scheduledAt).toISOString()}`;
}

/** Encola la confirmación de entrevista agendada para que salga en el momento. */
export async function enqueueInterviewConfirmation(admin: Admin, interview: { id: string; scheduled_at: string }): Promise<string | null> {
  const scheduled_at = new Date(interview.scheduled_at).toISOString();
  return enqueueOnce(admin, "interview_confirm", { interview_id: interview.id, scheduled_at, kind: "scheduled" }, scheduledKey(interview.id, scheduled_at));
}

/** La llave cambia si cambia la hora: reagendar a otro día deja salir un recordatorio nuevo. */
export function reminderKey(interviewId: string, scheduledAt: string): string {
  return `interview_confirm:${interviewId}:${new Date(scheduledAt).toISOString()}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
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
export async function sendInterviewReminder(admin: Admin, interviewId: string, scheduledAt: string, kind: InterviewMessageKind = "reminder"): Promise<Outcome> {
  const { data: iv, error } = await admin
    .from("interviews")
    .select("id, status, scheduled_at, meeting_url, application_id, calendar_event_id, calendar_owner_id")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, retry: true };
  if (!iv) return { ok: true, detail: "La entrevista ya no existe" };
  if (!(ACTIVE as readonly string[]).includes(iv.status)) return { ok: true, detail: `No se mandó: la entrevista está ${iv.status}` };
  if (!iv.scheduled_at || new Date(iv.scheduled_at).getTime() !== new Date(scheduledAt).getTime()) return { ok: true, detail: "No se mandó: la entrevista cambió de hora" };
  if (new Date(iv.scheduled_at) <= new Date()) return { ok: true, detail: "No se mandó: la entrevista ya empezó" };
  if (kind === "reminder") {
    const confirmed = await doneAt(admin, scheduledKey(iv.id, iv.scheduled_at));
    if (confirmed && Date.now() - confirmed.getTime() < RECENT_HOURS * 3_600_000) return { ok: true, detail: "No se mandó: la confirmación salió hace poco al agendar" };
  }
  const link = iv.meeting_url ?? (await joinUrlFromOutlook(admin, iv));
  if (!link) return { ok: false, error: MISSING_LINK, retry: false };

  const when = formatWhen(iv.scheduled_at);
  return sendSystemTemplate(admin, { applicationId: iv.application_id, template: "interview", parameters: (_c, vacancy) => [vacancy, when, link] });
}

const MISSING_LINK =
  "La entrevista no tiene enlace de Teams, así que no salió el recordatorio al candidato. En la ficha → Entrevista → Reagendar, deja la misma fecha y hora, pega el enlace y guarda: el recordatorio sale en ese momento.";

/**
 * Entrevista creada en Outlook a la que Outlook no le devolvió el enlace al agendar: se pide otra vez
 * al evento (con el token de quien agendó) y se guarda. null si no hay evento o Outlook no responde.
 */
async function joinUrlFromOutlook(admin: Admin, iv: { id: string; calendar_event_id: string | null; calendar_owner_id: string | null }): Promise<string | null> {
  if (!iv.calendar_event_id || !iv.calendar_owner_id) return null;
  try {
    const token = await getAccessToken(iv.calendar_owner_id);
    const url = token ? await getEventJoinUrl(token, iv.calendar_event_id) : null;
    if (url) await admin.from("interviews").update({ meeting_url: url }).eq("id", iv.id).is("meeting_url", null);
    return url;
  } catch (e) {
    console.error("[whaapy] enlace de Teams del recordatorio", iv.id, e);
    return null;
  }
}
