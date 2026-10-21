import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled } from "@/lib/ai/client";
import { scoreApplicationCv } from "@/lib/ai/tasks/score-cv";

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
