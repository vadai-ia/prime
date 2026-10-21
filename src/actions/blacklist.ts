"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

export type BlacklistActionState = { error?: string; ok?: boolean } | undefined;

async function adminOrError(): Promise<string | null> {
  try {
    await assertPermission("view_blacklist");
    return null;
  } catch (e) {
    return e instanceof UnauthorizedError ? e.message : "No autorizado";
  }
}

function done(applicationId?: string): BlacklistActionState {
  revalidatePath("/candidatos/lista-negra");
  revalidatePath("/candidatos");
  revalidatePath("/tablero");
  if (applicationId) revalidatePath(`/candidatos/${applicationId}`);
  return { ok: true };
}

const addSchema = z.object({
  candidate_id: z.string().uuid(),
  application_id: z.string().uuid().or(z.literal("")),
  reason_key: z.enum(["theft", "abandonment", "fake_documents", "misconduct", "other"], { message: "Elige un motivo" }),
  note: z.string().trim().max(1000),
});

/** Marca a la persona en la lista negra. La base descarta sus postulaciones abiertas y bloquea las nuevas. */
export async function addToBlacklist(_prev: BlacklistActionState, formData: FormData): Promise<BlacklistActionState> {
  const denied = await adminOrError();
  if (denied) return { error: denied };
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = addSchema.safeParse({
    candidate_id: formData.get("candidate_id"),
    application_id: formData.get("application_id") ?? "",
    reason_key: formData.get("reason_key"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;
  if (d.reason_key === "other" && !d.note) return { error: "Con el motivo \"Otro\" escribe una nota." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("blacklist_candidate", { p_candidate_id: d.candidate_id, p_reason_key: d.reason_key, p_note: d.note || undefined });
  if (error) return { error: error.message };
  return done(d.application_id || undefined);
}

const removeSchema = z.object({ entry_id: z.string().uuid(), application_id: z.string().uuid().or(z.literal("")), note: z.string().trim().max(1000) });

/** Quita a la persona de la lista negra. Queda el historial; sus postulaciones descartadas no se reabren. */
export async function removeFromBlacklist(_prev: BlacklistActionState, formData: FormData): Promise<BlacklistActionState> {
  const denied = await adminOrError();
  if (denied) return { error: denied };
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = removeSchema.safeParse({ entry_id: formData.get("entry_id"), application_id: formData.get("application_id") ?? "", note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: "Registro no válido" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("unblacklist_candidate", { p_entry_id: d.entry_id, p_note: d.note || undefined });
  if (error) return { error: error.message };
  return done(d.application_id || undefined);
}
