"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClient, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

export type DecisionState = { error?: string; ok?: boolean; decision?: "approve" | "reject" } | undefined;

const schema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().max(500).optional(),
});

/** Vo.Bo. o "no continuar" del cliente. La RPC valida rol, empresa y etapa. */
export async function decide(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  try {
    await assertClient();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const parsed = schema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("client_decide_application", {
    p_application_id: parsed.data.applicationId,
    p_decision: parsed.data.decision,
    p_comment: parsed.data.comment,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal");
  revalidatePath(`/portal/candidatos/${parsed.data.applicationId}`);
  return { ok: true, decision: parsed.data.decision };
}
