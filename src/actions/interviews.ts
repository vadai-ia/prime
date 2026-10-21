"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { STAGES } from "@/lib/labels";
import { zonedToUtcIso } from "@/lib/domain/time";
import { cancelEvent, createTeamsEvent, getAccessToken, MicrosoftGraphError, moveEvent } from "@/lib/integrations/microsoft-graph";

// Entrevistas por Teams con Outlook (plan §4.4, opción B). Si quien agenda conectó su Outlook en
// Mi cuenta, el evento siempre se crea en su calendario con reunión de Teams e invita al candidato
// (si tiene correo), al entrevistador y a Fireflies. Sin Outlook conectado, el enlace se pega a mano. Mover y cancelar siguen al evento con el token del dueño del
// calendario (interviews.calendar_owner_id), aunque lo haga otra persona.

export type InterviewActionState = { error?: string; ok?: boolean; warning?: string } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const graphMessage = (e: unknown) => (e instanceof MicrosoftGraphError ? e.message : "No se pudo hablar con Outlook.");

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Crea el evento de Teams de una entrevista. Lee candidato y vacante con la sesión del usuario (RLS). */
async function createCalendarEvent(
  supabase: Supabase,
  token: string,
  iv: { id: string; application_id: string; type: "prime" | "client"; scheduled_at: string; duration_min: number; interviewer_user_id: string | null; owner_id: string },
): Promise<{ eventId: string; joinUrl: string | null }> {
  const { data: app } = await supabase.from("applications").select("candidates(full_name, email), job_profiles(title)").eq("id", iv.application_id).maybeSingle();
  const candidate = app?.candidates;
  const title = app?.job_profiles?.title ?? "vacante";

  const attendees: { email: string; name?: string | null }[] = [];
  if (candidate?.email) attendees.push({ email: candidate.email, name: candidate.full_name });
  if (iv.interviewer_user_id && iv.interviewer_user_id !== iv.owner_id) {
    const { data: interviewer } = await supabase.from("users").select("email, full_name").eq("id", iv.interviewer_user_id).maybeSingle();
    if (interviewer?.email) attendees.push({ email: interviewer.email, name: interviewer.full_name });
  }

  // El candidato ve el asunto y el cuerpo: nada interno (cliente, score, notas)
  const who = candidate?.full_name ?? "Candidato";
  const kind = iv.type === "prime" ? "Entrevista" : "Entrevista con la empresa";
  return createTeamsEvent(token, {
    transactionId: iv.id,
    subject: `${kind} · ${title} · ${who}`,
    bodyHtml: `<p>Hola ${escapeHtml(who.split(" ")[0])}:</p><p>Te esperamos en tu ${kind.toLowerCase()} para la vacante <b>${escapeHtml(title)}</b>. Únete con el enlace de Teams de esta invitación unos minutos antes.</p><p>Prime HR Innovation</p>`,
    startIso: iv.scheduled_at,
    durationMin: iv.duration_min,
    attendees,
    inviteFireflies: true,
  });
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida");
const url = z.string().trim().url("El enlace de la reunión no es válido").or(z.literal(""));

function done(applicationId: string): InterviewActionState {
  revalidatePath(`/candidatos/${applicationId}`);
  revalidatePath("/candidatos");
  revalidatePath("/entrevistas");
  revalidatePath("/tablero");
  return { ok: true };
}

const scheduleSchema = z.object({
  application_id: z.string().uuid(),
  type: z.enum(["prime", "client"]),
  date,
  time,
  duration_min: z.coerce.number().int().min(10, "Duración mínima de 10 minutos").max(240, "Duración máxima de 4 horas").default(30),
  meeting_url: url,
  interviewer_user_id: z.string().uuid().or(z.literal("")),
  client_interviewer_name: z.string().trim().max(120),
  advance: z.boolean(),
});

/** Agendar una entrevista Prime o con cliente. Si se pide, mueve la postulación a la etapa de esa entrevista. */
export async function scheduleInterview(_prev: InterviewActionState, formData: FormData): Promise<InterviewActionState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = scheduleSchema.safeParse({
    application_id: formData.get("application_id"),
    type: formData.get("type"),
    date: formData.get("date"),
    time: formData.get("time"),
    duration_min: formData.get("duration_min") || 30,
    meeting_url: formData.get("meeting_url") ?? "",
    interviewer_user_id: formData.get("interviewer_user_id") ?? "",
    client_interviewer_name: formData.get("client_interviewer_name") ?? "",
    advance: formData.get("advance") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  const scheduledAt = zonedToUtcIso(d.date, d.time);
  if (!scheduledAt) return { error: "Fecha u hora no válida" };

  const supabase = await createClient();
  const { data: application } = await supabase.from("applications").select("id, stage").eq("id", d.application_id).maybeSingle();
  if (!application) return { error: "Candidato no encontrado" };

  const interviewId = randomUUID();
  const interviewerId = d.type === "prime" ? d.interviewer_user_id || session.userId : null;

  // Outlook conectado: el evento de Teams lo crea el sistema (un enlace pegado se ignora)
  let meetingUrl = d.meeting_url || null;
  let eventId: string | null = null;
  let token: string | null = null;
  try {
    token = await getAccessToken(session.userId);
    if (token) {
      const event = await createCalendarEvent(supabase, token, {
        id: interviewId,
        application_id: application.id,
        type: d.type,
        scheduled_at: scheduledAt,
        duration_min: d.duration_min,
        interviewer_user_id: interviewerId,
        owner_id: session.userId,
      });
      eventId = event.eventId;
      meetingUrl = event.joinUrl;
    }
  } catch (e) {
    return { error: `No se pudo crear la entrevista en Outlook: ${graphMessage(e)} Si sigue fallando, desconecta Outlook en Mi cuenta y agenda pegando el enlace de Teams.` };
  }

  const { error } = await supabase.from("interviews").insert({
    id: interviewId,
    application_id: application.id,
    type: d.type,
    status: "scheduled",
    scheduled_at: scheduledAt,
    duration_min: d.duration_min,
    platform: "teams",
    meeting_url: meetingUrl,
    calendar_event_id: eventId,
    calendar_owner_id: session.userId,
    interviewer_user_id: interviewerId,
    client_interviewer_name: d.type === "client" ? d.client_interviewer_name || null : null,
  });
  if (error) {
    // que no quede un evento huérfano en el calendario
    if (token && eventId) await cancelEvent(token, eventId, "Se canceló al agendar.").catch(() => undefined);
    return { error: error.message };
  }

  const target = d.type === "prime" ? "prime_interview" : "client_interview";
  const open = application.stage !== "discarded" && application.stage !== "hired";
  if (d.advance && open && STAGES.indexOf(application.stage) < STAGES.indexOf(target)) {
    const { error: stageError } = await supabase.rpc("set_application_stage", { p_application_id: application.id, p_to_stage: target, p_reason: "Entrevista agendada" });
    if (stageError) return { error: `La entrevista quedó agendada, pero no se pudo mover de etapa: ${stageError.message}` };
  }
  return done(application.id);
}

const rescheduleSchema = z.object({ application_id: z.string().uuid(), interview_id: z.string().uuid(), date, time, meeting_url: url });

/** Reagendar: nueva fecha y hora (y enlace, si cambió). La entrevista vuelve a "Agendada". */
export async function rescheduleInterview(_prev: InterviewActionState, formData: FormData): Promise<InterviewActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = rescheduleSchema.safeParse({
    application_id: formData.get("application_id"),
    interview_id: formData.get("interview_id"),
    date: formData.get("date"),
    time: formData.get("time"),
    meeting_url: formData.get("meeting_url") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  const scheduledAt = zonedToUtcIso(d.date, d.time);
  if (!scheduledAt) return { error: "Fecha u hora no válida" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("interviews")
    .select("id, application_id, type, status, duration_min, calendar_event_id, calendar_owner_id, interviewer_user_id")
    .eq("id", d.interview_id)
    .maybeSingle();
  if (!current) return { error: "Entrevista no encontrada" };

  // Mover el evento en el Outlook de quien la agendó; si se había cancelado (Outlook lo borra), se crea otro
  let calendar: { calendar_event_id?: string; meeting_url?: string } = {};
  let warning: string | undefined;
  const ownerId = current.calendar_owner_id;
  if (current.calendar_event_id && ownerId) {
    try {
      const token = await getAccessToken(ownerId);
      if (!token) {
        warning = "La fecha quedó guardada, pero el Outlook de quien agendó ya no está conectado: mueve el evento a mano en su calendario.";
      } else {
        const recreate = async () => {
          const event = await createCalendarEvent(supabase, token, {
            id: randomUUID(),
            application_id: current.application_id,
            type: current.type,
            scheduled_at: scheduledAt,
            duration_min: current.duration_min,
            interviewer_user_id: current.interviewer_user_id,
            owner_id: ownerId,
          });
          calendar = { calendar_event_id: event.eventId, ...(event.joinUrl ? { meeting_url: event.joinUrl } : {}) };
        };
        if (current.status === "cancelled") await recreate();
        else
          await moveEvent(token, current.calendar_event_id, scheduledAt, current.duration_min).catch((e) => {
            if (e instanceof MicrosoftGraphError && e.status === 404) return recreate();
            throw e;
          });
      }
    } catch (e) {
      return { error: `No se pudo mover el evento en Outlook: ${graphMessage(e)}` };
    }
  }

  const { data, error } = await supabase
    .from("interviews")
    .update({ scheduled_at: scheduledAt, status: "scheduled", ...(d.meeting_url && !current.calendar_event_id ? { meeting_url: d.meeting_url } : {}), ...calendar })
    .eq("id", d.interview_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Entrevista no encontrada" };
  return { ...done(d.application_id), warning };
}

const closeSchema = z.object({
  application_id: z.string().uuid(),
  interview_id: z.string().uuid(),
  status: z.enum(["confirmed", "completed", "no_show", "cancelled"]),
  summary: z.string().trim().max(4000),
  score: z.coerce.number().int().min(0, "La calificación va de 0 a 100").max(100, "La calificación va de 0 a 100").or(z.literal("")),
});

/** Confirmar, cancelar, marcar que no se presentó, o cerrar como realizada con notas y calificación del entrevistador. */
export async function setInterviewStatus(_prev: InterviewActionState, formData: FormData): Promise<InterviewActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = closeSchema.safeParse({
    application_id: formData.get("application_id"),
    interview_id: formData.get("interview_id"),
    status: formData.get("status"),
    summary: formData.get("summary") ?? "",
    score: formData.get("score") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const supabase = await createClient();

  // Cancelar en Outlook (Exchange avisa a los invitados). Si falla, la entrevista se cancela igual aquí.
  let warning: string | undefined;
  if (d.status === "cancelled") {
    const { data: current } = await supabase.from("interviews").select("calendar_event_id, calendar_owner_id").eq("id", d.interview_id).maybeSingle();
    if (current?.calendar_event_id && current.calendar_owner_id) {
      try {
        const token = await getAccessToken(current.calendar_owner_id);
        if (token) await cancelEvent(token, current.calendar_event_id, "La entrevista se canceló.");
        else warning = "Cancelada aquí, pero el Outlook de quien agendó ya no está conectado: borra el evento a mano.";
      } catch (e) {
        if (!(e instanceof MicrosoftGraphError && e.status === 404)) warning = `Cancelada aquí, pero no en Outlook: ${graphMessage(e)}`;
      }
    }
  }

  const notes = d.status === "completed" ? { summary: d.summary || null, score: d.score === "" ? null : d.score } : {};
  const { data, error } = await supabase.from("interviews").update({ status: d.status, ...notes }).eq("id", d.interview_id).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Entrevista no encontrada" };
  return { ...done(d.application_id), warning };
}
