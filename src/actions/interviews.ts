"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { STAGES } from "@/lib/labels";
import { zonedToUtcIso } from "@/lib/domain/time";

// Agenda manual. Cuando se conecten Google Calendar y Fireflies (plan §4.3 y §4.4), entran en los
// tres puntos marcados "INTEGRACIÓN": crear, mover y cancelar el evento. El resto no cambia.

export type InterviewActionState = { error?: string; ok?: boolean } | undefined;

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
  platform: z.enum(["meet", "zoom"]).default("meet"),
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
    platform: formData.get("platform") || "meet",
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

  // INTEGRACIÓN (crear): evento en Google Calendar con Meet e invitación a Fireflies → meeting_url, calendar_event_id, fireflies_meeting_id.
  const { error } = await supabase.from("interviews").insert({
    application_id: application.id,
    type: d.type,
    status: "scheduled",
    scheduled_at: scheduledAt,
    duration_min: d.duration_min,
    platform: d.platform,
    meeting_url: d.meeting_url || null,
    calendar_owner_id: session.userId,
    interviewer_user_id: d.type === "prime" ? d.interviewer_user_id || session.userId : null,
    client_interviewer_name: d.type === "client" ? d.client_interviewer_name || null : null,
  });
  if (error) return { error: error.message };

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

  // INTEGRACIÓN (mover): update del evento en Google Calendar; Fireflies sigue al evento.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .update({ scheduled_at: scheduledAt, status: "scheduled", ...(d.meeting_url ? { meeting_url: d.meeting_url } : {}) })
    .eq("id", d.interview_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Entrevista no encontrada" };
  return done(d.application_id);
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

  // INTEGRACIÓN (cancelar): borrar el evento de Google Calendar cuando status = cancelled.
  const supabase = await createClient();
  const notes = d.status === "completed" ? { summary: d.summary || null, score: d.score === "" ? null : d.score } : {};
  const { data, error } = await supabase.from("interviews").update({ status: d.status, ...notes }).eq("id", d.interview_id).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Entrevista no encontrada" };
  return done(d.application_id);
}
