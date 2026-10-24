"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

export type FollowupActionState = { error?: string; ok?: boolean } | undefined;

const schema = z
  .object({
    followup_id: z.string().uuid(),
    application_id: z.string().uuid(),
    outcome: z.enum(["active", "left", "unknown"], { message: "Elige Sigue, Se fue o No se sabe" }),
    left_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    left_reason: z.string().trim().max(300),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => v.outcome !== "left" || v.left_at, { message: "Con \"Se fue\" indica la fecha de salida", path: ["left_at"] });

/** Captura un corte de permanencia. "Se fue" cierra también los cortes siguientes (lo hace la base). */
export async function recordFollowup(_prev: FollowupActionState, formData: FormData): Promise<FollowupActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = schema.safeParse({
    followup_id: formData.get("followup_id"),
    application_id: formData.get("application_id"),
    outcome: formData.get("outcome"),
    left_at: formData.get("left_at") ?? "",
    left_reason: formData.get("left_reason") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_placement_followup", {
    p_followup_id: d.followup_id,
    p_outcome: d.outcome,
    p_left_at: d.outcome === "left" ? d.left_at : undefined,
    p_left_reason: d.outcome === "left" && d.left_reason ? d.left_reason : undefined,
    p_notes: d.notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/candidatos/permanencia");
  revalidatePath(`/candidatos/${d.application_id}`);
  revalidatePath("/tablero");
  return { ok: true };
}
