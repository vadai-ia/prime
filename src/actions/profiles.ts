"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { positionFromFormData } from "@/lib/domain/intake-form-data";
import { logProfileEdit } from "@/lib/audit";
import { CHANNEL_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";

const CHANNELS = Object.keys(CHANNEL_LABELS) as Enums<"source_channel">[];

const lines = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : []);

/** Sección VIII de la edición (Relaciones, proceso y publicación). No está en el levantamiento. */
function publishingFromFormData(formData: FormData) {
  return {
    // "Gerente de crédito: reporta resultados" por línea
    relations: lines(formData.get("relations")).map((line) => {
      const i = line.indexOf(":");
      return i < 0 ? { with: line, purpose: "" } : { with: line.slice(0, i).trim(), purpose: line.slice(i + 1).trim() };
    }),
    selection_process: lines(formData.get("selection_process")),
    published_channels: formData.getAll("published_channels").map(String).filter((c): c is Enums<"source_channel"> => (CHANNELS as string[]).includes(c)),
    posting_text: typeof formData.get("posting_text") === "string" ? String(formData.get("posting_text")).trim() || null : null,
  };
}

export type ProfileFormState = { error?: string } | undefined;

const schema = z.object({
  profile_id: z.string().uuid("Vacante no válida"),
  title: z.string().trim().min(2, "Nombre del puesto requerido"),
  status: z.enum(["intake", "active", "paused", "closed"], "Estado no válido"),
});

/**
 * Edición del descriptivo de la vacante y de su estado (activa, pausada, cerrada).
 * Admin, o reclutador que la tenga asignada: lo decide RLS (plan §2.3).
 */
export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const parsed = schema.safeParse({ profile_id: formData.get("profile_id"), title: formData.get("title"), status: formData.get("status") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const { profile_id, title, status } = parsed.data;
  const form = positionFromFormData(formData, title);

  const supabase = await createClient();
  const { data: current, error: findError } = await supabase.from("job_profiles").select("id").eq("id", profile_id).maybeSingle();
  if (findError) return { error: findError.message };
  if (!current) return { error: "Vacante no encontrada o no la tienes asignada" };

  const { error } = await supabase
    .from("job_profiles")
    .update({
      title,
      status,
      openings: form.position?.openings ?? 1,
      unit: form.position?.unit ?? null,
      work_zone: form.position?.work_zone ?? null,
      objective: form.position?.objective ?? null,
      reports_to: form.position?.reports_to ?? null,
      specs: form.specs ?? {},
      requirements: form.requirements ?? {},
      activities: form.activities ?? [],
      conditions: form.conditions ?? {},
      competencies: form.competencies ?? {},
      ...publishingFromFormData(formData),
    })
    .eq("id", profile_id);
  if (error) return { error: error.message };
  await logProfileEdit(supabase, profile_id, { section: "description" });

  revalidatePath("/perfiles");
  revalidatePath(`/perfiles/${profile_id}`);
  revalidatePath("/candidatos");
  redirect(`/perfiles/${profile_id}`);
}
