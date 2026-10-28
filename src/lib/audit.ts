import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Qué parte de la vacante cambió. Se ve en Configuración → Logs técnicos → Accesos y cambios. */
export type ProfileEditSection = "description" | "generated" | "cv_weights" | "prefilter_rules" | "prefilter_questions" | "psych_minimums";

/**
 * Registro técnico de una edición de la vacante (audit_log 'edit_profile', migración 0026), con la
 * sesión de quien la hizo. Si falla, el cambio ya quedó guardado igual.
 */
export async function logProfileEdit(supabase: Supabase, profileId: string, metadata: { section: ProfileEditSection; version?: number }): Promise<void> {
  const { error } = await supabase.rpc("log_audit", { p_action: "edit_profile", p_entity_type: "job_profile", p_entity_id: profileId, p_metadata: metadata });
  if (error) console.error("log_audit edit_profile", error.message);
}

/**
 * Registro técnico de una edición de los datos del candidato (audit_log 'edit_candidate', migración 0028):
 * qué campos cambiaron, nunca sus valores. Va contra la postulación desde la que se editó, para enlazar a la ficha.
 */
export async function logCandidateEdit(supabase: Supabase, applicationId: string, metadata: { candidate_id: string; fields: string[] }): Promise<void> {
  const { error } = await supabase.rpc("log_audit", { p_action: "edit_candidate", p_entity_type: "application", p_entity_id: applicationId, p_metadata: metadata });
  if (error) console.error("log_audit edit_candidate", error.message);
}
