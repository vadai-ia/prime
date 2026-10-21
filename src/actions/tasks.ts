"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

export type TaskActionState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({ task_id: z.string().uuid(), op: z.enum(["retry", "cancel"]) });

/** Reintentar una tarea fallida o cancelar una pendiente (Configuración → Tareas automáticas). */
export async function updateTask(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = schema.safeParse({ task_id: formData.get("task_id"), op: formData.get("op") });
  if (!parsed.success) return { error: "Tarea no válida" };

  const supabase = await createClient();
  const { error } = await supabase.rpc(parsed.data.op === "retry" ? "retry_scheduled_task" : "cancel_scheduled_task", { p_task_id: parsed.data.task_id });
  if (error) return { error: error.message };
  revalidatePath("/configuracion");
  return { ok: true };
}
