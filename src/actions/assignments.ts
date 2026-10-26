"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE, MOCK_PIPELINE, MOCK_WRITE_ERROR } from "@/lib/mock";

export type AssignmentFormState = { error?: string; ok?: boolean; message?: string } | undefined;

const recruitersSchema = z.object({
  profile_id: z.string().uuid("Vacante no válida"),
  recruiter_ids: z.array(z.string().uuid("Reclutador no válido")),
});

/**
 * Checklist de reclutadores de una vacante (plan §2.3). Solo admin: el reclutador nunca se asigna solo.
 * La RPC deja exactamente los marcados; la base reparte por turno los candidatos del que sale y escribe el historial.
 */
export async function setProfileRecruiters(_prev: AssignmentFormState, formData: FormData): Promise<AssignmentFormState> {
  try {
    await assertPermission("manage_assignments");
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const parsed = recruitersSchema.safeParse({ profile_id: formData.get("profile_id"), recruiter_ids: formData.getAll("recruiter_ids") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("set_profile_recruiters", {
    p_profile_id: parsed.data.profile_id,
    p_recruiter_ids: parsed.data.recruiter_ids,
  });
  if (error) return { error: error.message };

  revalidatePath("/perfiles");
  revalidatePath(`/perfiles/${parsed.data.profile_id}`);
  revalidatePath("/candidatos");
  revalidatePath("/tablero");
  return { ok: true, message: count === 0 ? "La vacante quedó sin reclutadores: los candidatos nuevos solo los verá un administrador." : `Guardado. ${count} ${count === 1 ? "reclutador trabaja" : "reclutadores trabajan"} esta vacante.` };
}

const recruiterProfilesSchema = z.object({
  recruiter_id: z.string().uuid("Reclutador no válido"),
  profile_ids: z.array(z.string().uuid("Vacante no válida")),
});

/**
 * La misma asignación, vista desde el reclutador (Configuración → Ver → Vacantes asignadas): deja
 * exactamente las vacantes marcadas. Primero altas y luego bajas, como `set_profile_recruiters`; los
 * triggers validan que sea reclutador activo, escriben el historial y reparten los candidatos del que sale.
 */
export async function setRecruiterProfiles(recruiterId: string, profileIds: string[]): Promise<AssignmentFormState> {
  try {
    await assertPermission("manage_assignments");
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const parsed = recruiterProfilesSchema.safeParse({ recruiter_id: recruiterId, profile_ids: [...new Set(profileIds)] });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const { recruiter_id, profile_ids } = parsed.data;

  const supabase = await createClient();
  if (profile_ids.length) {
    const { error } = await supabase
      .from("job_profile_assignments")
      .upsert(profile_ids.map((profile_id) => ({ profile_id, recruiter_id })), { onConflict: "profile_id,recruiter_id", ignoreDuplicates: true });
    if (error) return { error: error.message };
  }
  let remove = supabase.from("job_profile_assignments").delete().eq("recruiter_id", recruiter_id);
  if (profile_ids.length) remove = remove.not("profile_id", "in", `(${profile_ids.join(",")})`);
  const { error } = await remove;
  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  revalidatePath("/perfiles");
  revalidatePath("/candidatos");
  revalidatePath("/tablero");
  return { ok: true, message: profile_ids.length ? `Guardado: ${profile_ids.length} ${profile_ids.length === 1 ? "vacante" : "vacantes"}.` : "Quedó sin vacantes." };
}

const reassignSchema = z.object({
  application_id: z.string().uuid("Postulación no válida"),
  recruiter_id: z.string().uuid("Reclutador no válido").nullable(),
});

/** Reasignar un candidato a otro reclutador de la misma vacante (o dejarlo sin asignar). Solo admin. */
export async function assignApplicationRecruiter(_prev: AssignmentFormState, formData: FormData): Promise<AssignmentFormState> {
  try {
    await assertPermission("manage_assignments");
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK_PIPELINE) return { error: MOCK_WRITE_ERROR };

  const parsed = reassignSchema.safeParse({ application_id: formData.get("application_id"), recruiter_id: formData.get("recruiter_id") || null });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ assigned_recruiter_id: parsed.data.recruiter_id })
    .eq("id", parsed.data.application_id)
    .select("id")
    .maybeSingle();
  // 23514: el trigger rechaza a quien no trabaja la vacante
  if (error) return { error: error.code === "23514" ? "Ese reclutador no trabaja esta vacante. Agrégalo primero en el perfil." : error.message };
  if (!data) return { error: "Postulación no encontrada" };

  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${parsed.data.application_id}`);
  revalidatePath("/tablero");
  return { ok: true, message: "Candidato reasignado." };
}
