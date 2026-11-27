import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { scoreCvAgainstProfile } from "./score-cv";

type Admin = ReturnType<typeof createAdminClient>;

/** Cuántos candidatos de otras vacantes califica la IA en cada búsqueda (los más parecidos por texto). */
export const SUGGESTION_BATCH = 12;

export type SuggestionSearch = { ok: true; created: number; toScore: string[] } | { ok: false; error: string; permanent?: boolean };

/**
 * Candidatos sugeridos de otras vacantes (plan §12.25). Corre en la cola con service role: la
 * búsqueda ve a todas las personas, sin RLS, y por eso las filas solo las lee un admin
 * (`profile_candidate_suggestions`, permiso suggest_candidates). Quién entra (y quién no: lista negra,
 * en proceso, trabajando por Prime, ya sugerido) lo decide `suggestion_pool` en SQL.
 *
 * Devuelve las sugerencias por calificar: las nuevas y las que se quedaron pendientes o fallaron.
 */
export async function searchSuggestions(admin: Admin, profileId: string): Promise<SuggestionSearch> {
  const { data: profile, error } = await admin
    .from("job_profiles")
    .select("id, status, job_profile_ai_configs(cv_weights)")
    .eq("id", profileId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!profile) return { ok: false, error: "La vacante ya no existe", permanent: true };
  if (profile.status === "closed") return { ok: false, error: "La vacante está cerrada", permanent: true };
  if (!profile.job_profile_ai_configs) {
    return { ok: false, error: "La vacante no tiene evaluación de IA: genera los criterios del CV antes de buscar.", permanent: true };
  }

  const { data: pool, error: poolError } = await admin.rpc("suggestion_pool", { p_profile_id: profileId, p_limit: SUGGESTION_BATCH });
  if (poolError) return { ok: false, error: poolError.message };

  let created = 0;
  if (pool && pool.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from("profile_candidate_suggestions")
      .upsert(
        pool.map((p) => ({ profile_id: profileId, candidate_id: p.candidate_id, source_application_id: p.source_application_id, match_rank: p.match_rank })),
        { onConflict: "profile_id,candidate_id", ignoreDuplicates: true },
      )
      .select("id");
    if (insertError) return { ok: false, error: insertError.message };
    created = inserted?.length ?? 0;
  }

  const { data: toScore, error: listError } = await admin
    .from("profile_candidate_suggestions")
    .select("id")
    .eq("profile_id", profileId)
    .in("status", ["pending", "failed"]);
  if (listError) return { ok: false, error: listError.message };
  return { ok: true, created, toScore: (toScore ?? []).map((r) => r.id) };
}

export type SuggestionScore = { ok: true; score: number | null } | { ok: false; error: string; permanent?: boolean };

/** Califica una sugerencia con los criterios del CV de la vacante (el mismo prompt que una postulación). */
export async function scoreSuggestion(admin: Admin, suggestionId: string): Promise<SuggestionScore> {
  const { data: s, error } = await admin
    .from("profile_candidate_suggestions")
    .select("id, status, candidates(full_name, cv_file_path, cv_text), job_profiles(title, requirements, activities, job_profile_ai_configs(cv_version, cv_weights))")
    .eq("id", suggestionId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!s) return { ok: true, score: null }; // se borró la vacante o el candidato
  if (s.status !== "pending" && s.status !== "failed") return { ok: true, score: null }; // ya calificada o ya decidida
  if (!s.candidates || !s.job_profiles) return { ok: false, error: "Sugerencia incompleta", permanent: true };

  const scored = await scoreCvAgainstProfile(s.candidates, s.job_profiles, { type: "profile_suggestion", id: s.id });
  if (!scored.ok) {
    await admin.from("profile_candidate_suggestions").update({ status: "failed", error: scored.error }).eq("id", s.id).in("status", ["pending", "failed"]);
    return scored;
  }

  const { error: saveError } = await admin
    .from("profile_candidate_suggestions")
    .update({
      status: "scored",
      cv_score: scored.score,
      cv_score_breakdown: scored.breakdown,
      cv_score_version: scored.version,
      rationale: scored.summary,
      flags: scored.flags.length > 0 ? scored.flags.join(" · ") : null,
      error: null,
      scored_at: new Date().toISOString(),
    })
    .eq("id", s.id)
    .in("status", ["pending", "failed"]);
  if (saveError) return { ok: false, error: saveError.message };
  return { ok: true, score: scored.score };
}
