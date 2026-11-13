import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled } from "@/lib/ai/client";
import { scoreApplicationCv } from "@/lib/ai/tasks/score-cv";
import { downloadMedia, WhaapyError } from "@/lib/integrations/whaapy";

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
