import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled } from "@/lib/ai/client";
import { scoreApplicationCv } from "@/lib/ai/tasks/score-cv";
import { downloadMedia, WhaapyError } from "@/lib/integrations/whaapy";
import { sendInterviewReminder, sweepTomorrowInterviews } from "@/lib/whatsapp/interview-reminder";
import {
  sendDiscardNotice,
  sendDocsReminder,
  sendDocsRequest,
  sendFirstContact,
  sendPsychLink,
  sendPsychReminder,
  sweepWhatsAppReminders,
} from "@/lib/whatsapp/candidate-flows";
import { runDailyClient, runDailyInternal, runWeeklyClient } from "@/lib/email/reports";

const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function extensionFor(mime: string): string {
  return MEDIA_EXT[mime.split(";")[0]!.trim()] ?? "bin";
}

// Qué hace cada tipo de tarea de la cola (scheduled_tasks.type, tasks.md §3). Cada handler recibe el
// payload ya validado y el cliente con service role (aquí no hay sesión: corre desde el cron).
// Un tipo que no esté aquí falla sin reintentar: las integraciones pendientes (Whaapy, Resend,
// Fireflies) se agregan cuando existan, con el mismo patrón.

type Admin = ReturnType<typeof createAdminClient>;

/** ok: terminó. retry: false cuando volver a intentar no sirve (falta un dato, no un error de red). */
export type TaskOutcome = { ok: true; detail?: string } | { ok: false; error: string; retry: boolean };

type Handler<S extends z.ZodType> = {
  label: string;
  payload: S;
  /** Intentos antes de darla por fallida (con espera de 2^intentos minutos entre uno y otro). */
  maxAttempts?: number;
  run: (payload: z.infer<S>, admin: Admin) => Promise<TaskOutcome>;
};

function handler<S extends z.ZodType>(h: Handler<S>) {
  return h;
}

export const HANDLERS = {
  /** Score del CV al dar de alta un candidato (tasks.md §2). Lo encola createCandidate. */
  cv_score: handler({
    label: "Score del CV",
    payload: z.object({ application_id: z.string().uuid() }),
    maxAttempts: 3,
    async run({ application_id }, admin) {
      if (!aiEnabled()) return { ok: false, error: "La IA no está configurada (falta ANTHROPIC_API_KEY).", retry: false };
      const result = await scoreApplicationCv(admin, application_id);
      if (result.ok) return { ok: true, detail: `score ${result.score}` };
      return { ok: false, error: result.error, retry: !result.permanent };
    },
  }),

  /**
   * Archivo que mandó un candidato por WhatsApp: se baja de Whaapy (la URL dura 24 h) al bucket
   * wa-media y se guarda el path, nunca la URL. Lo encola el webhook y lo corre en el momento.
   */
  wa_media_fetch: handler({
    label: "Archivo de WhatsApp",
    payload: z.object({ message_id: z.string().uuid(), url: z.string().url() }),
    maxAttempts: 4,
    async run({ message_id, url }, admin) {
      const { data: message } = await admin.from("wa_messages").select("id, media_path, media_mime, conversation_id").eq("id", message_id).maybeSingle();
      if (!message) return { ok: false, error: "El mensaje ya no existe", retry: false };
      if (message.media_path) return { ok: true, detail: "ya estaba guardado" };
      const { data: conv } = await admin.from("wa_conversations").select("candidate_id").eq("id", message.conversation_id).single();
      if (!conv) return { ok: false, error: "La conversación ya no existe", retry: false };

      let file: Awaited<ReturnType<typeof downloadMedia>>;
      try {
        file = await downloadMedia(url);
      } catch (e) {
        // 4xx: el token venció o el archivo ya no está; reintentar no sirve.
        const permanent = e instanceof WhaapyError && e.status >= 400 && e.status < 500;
        return { ok: false, error: e instanceof Error ? e.message : String(e), retry: !permanent };
      }
      const mime = message.media_mime ?? file.mime;
      const path = `${conv.candidate_id}/whatsapp/${message.id}.${extensionFor(mime)}`;
      const { error: uploadError } = await admin.storage.from("wa-media").upload(path, file.bytes, { contentType: mime, upsert: true });
      if (uploadError) return { ok: false, error: uploadError.message, retry: true };
      const { error } = await admin.from("wa_messages").update({ media_path: path, media_mime: mime }).eq("id", message.id);
      if (error) return { ok: false, error: error.message, retry: true };
      return { ok: true, detail: path };
    },
  }),

  /** Barrido diario (8:00): encola un recordatorio por cada entrevista de mañana. */
  interview_reminders: handler({
    label: "Recordatorios de entrevista",
    payload: z.object({}).passthrough(),
    async run(_payload, admin) {
      return sweepTomorrowInterviews(admin);
    },
  }),

  /**
   * Recordatorio por WhatsApp de una entrevista (plantilla con fecha, hora y enlace de Teams). Lo
   * encolan el barrido diario y, si el barrido ya pasó, scheduleInterview / rescheduleInterview.
   */
  interview_confirm: handler({
    label: "Recordatorio de entrevista",
    payload: z.object({ interview_id: z.string().uuid(), scheduled_at: z.string() }),
    maxAttempts: 3,
    async run({ interview_id, scheduled_at }, admin) {
      return sendInterviewReminder(admin, interview_id, scheduled_at);
    },
  }),

  /** Primer contacto con aviso de privacidad. Lo encola el alta del candidato (individual o masiva). */
  wa_first_contact: handler({
    label: "WhatsApp: primer contacto",
    payload: z.object({ application_id: z.string().uuid() }),
    maxAttempts: 3,
    run: ({ application_id }, admin) => sendFirstContact(admin, application_id),
  }),

  /** Enlace del psicométrico. Lo encola savePsychSent cuando el reclutador deja la casilla marcada. */
  wa_psych_link: handler({
    label: "WhatsApp: enlace del psicométrico",
    payload: z.object({ test_id: z.string().uuid(), link: z.string().url() }),
    maxAttempts: 3,
    run: ({ test_id, link }, admin) => sendPsychLink(admin, test_id, link),
  }),

  wa_psych_reminder: handler({
    label: "WhatsApp: recordatorio del psicométrico",
    payload: z.object({ test_id: z.string().uuid(), link: z.string().url(), n: z.number().int() }),
    maxAttempts: 3,
    run: ({ test_id, link, n }, admin) => sendPsychReminder(admin, test_id, link, n),
  }),

  /** Lista de documentos que faltan. Lo encola el cambio a la etapa Documentos. */
  wa_docs_request: handler({
    label: "WhatsApp: solicitud de documentos",
    payload: z.object({ application_id: z.string().uuid() }),
    maxAttempts: 3,
    run: ({ application_id }, admin) => sendDocsRequest(admin, application_id),
  }),

  wa_docs_reminder: handler({
    label: "WhatsApp: recordatorio de documentos",
    payload: z.object({ application_id: z.string().uuid(), n: z.number().int() }),
    maxAttempts: 3,
    run: ({ application_id }, admin) => sendDocsReminder(admin, application_id),
  }),

  /** Agradecimiento al descartar. Lo encola setStage cuando "Avisar por WhatsApp" queda marcada. */
  wa_discard: handler({
    label: "WhatsApp: aviso de descarte",
    payload: z.object({ application_id: z.string().uuid() }),
    maxAttempts: 3,
    run: ({ application_id }, admin) => sendDiscardNotice(admin, application_id),
  }),

  /** Barrido diario (8:00): recordatorios del psicométrico y de documentos que ya tocan. */
  wa_reminders: handler({
    label: "WhatsApp: recordatorios del día",
    payload: z.object({}).passthrough(),
    run: (_payload, admin) => sweepWhatsAppReminders(admin),
  }),

  /** Resumen diario interno (8:00, del día anterior): admins todo, cada reclutador sus vacantes. */
  report_daily_internal: handler({
    label: "Correo: resumen diario interno",
    payload: z.object({}).passthrough(),
    maxAttempts: 3,
    run: (_payload, admin) => runDailyInternal(admin),
  }),

  /** Correo diario a cada cliente con candidatos desde Psicométrico (8:00, del día anterior). */
  report_daily_client: handler({
    label: "Correo: diario a clientes",
    payload: z.object({}).passthrough(),
    maxAttempts: 3,
    run: (_payload, admin) => runDailyClient(admin),
  }),

  /** Reporte semanal con PDF, a cada cliente en su día (clients.weekly_report_dow), a las 8:00. */
  report_weekly_client: handler({
    label: "Correo: reporte semanal a clientes",
    payload: z.object({}).passthrough(),
    maxAttempts: 3,
    run: (_payload, admin) => runWeeklyClient(admin),
  }),

  /** Avisos de permanencia: cortes de 30, 90 y 180 días que vencieron (una vez al día). */
  followups_due: handler({
    label: "Avisos de permanencia",
    payload: z.object({}).passthrough(),
    async run(_payload, admin) {
      const { data, error } = await admin.rpc("notify_followups_due");
      if (error) return { ok: false, error: error.message, retry: true };
      return { ok: true, detail: `${data} avisos` };
    },
  }),
} as const;

export type TaskType = keyof typeof HANDLERS;

export function isTaskType(type: string): type is TaskType {
  return Object.hasOwn(HANDLERS, type);
}

export function taskLabel(type: string): string {
  return isTaskType(type) ? HANDLERS[type].label : type;
}
