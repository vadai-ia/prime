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
