"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { STAGES } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";
import { triggerWhatsApp } from "@/lib/whatsapp/trigger";
import { enqueueDiscardNotice, enqueueDocsRequest } from "@/lib/whatsapp/candidate-flows";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const DISCARD_KEYS = ["age", "commute", "salary", "schedule", "experience", "education", "no_response", "invalid_phone", "cv_score", "interview", "psychometric", "documents", "client_rejected", "withdrew", "other"] as const;

const schema = z.object({
  applicationId: z.string().min(1),
  stage: z.enum(STAGES as [Enums<"application_stage">, ...Enums<"application_stage">[]]),
  reason: z.string().trim().max(500).optional(),
  discardKey: z.enum(DISCARD_KEYS).optional(),
  notifyWhatsApp: z.boolean(),
});

/** Mover de etapa (avanzar, descartar, reabrir). Va por la RPC para que quede motivo y actor en la línea de tiempo. */
export async function setStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const parsed = schema.safeParse({
    applicationId: formData.get("applicationId"),
    stage: formData.get("stage"),
    reason: formData.get("reason") || undefined,
    discardKey: formData.get("discardKey") || undefined,
    notifyWhatsApp: formData.get("notify_whatsapp") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_application_stage", {
    p_application_id: parsed.data.applicationId,
    p_to_stage: parsed.data.stage,
    p_reason: parsed.data.reason,
    p_discard_reason_key: parsed.data.stage === "discarded" ? parsed.data.discardKey ?? "other" : undefined,
  });
  if (error) return { error: error.message };

  // WhatsApp automático (plan §12.22): al llegar a Documentos se le pide lo que falta; al descartar,
  // el agradecimiento si el reclutador dejó la casilla marcada.
  const id = parsed.data.applicationId;
  if (parsed.data.stage === "documents") await triggerWhatsApp("solicitud de documentos", (admin) => enqueueDocsRequest(admin, id));
  if (parsed.data.stage === "discarded" && parsed.data.notifyWhatsApp) {
    const { data: app } = await supabase.from("applications").select("stage_changed_at").eq("id", id).maybeSingle();
    const at = app?.stage_changed_at ?? new Date().toISOString();
    await triggerWhatsApp("aviso de descarte", (admin) => enqueueDiscardNotice(admin, id, at));
  }

  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${parsed.data.applicationId}`);
  revalidatePath("/tablero");
  return { ok: true };
}
