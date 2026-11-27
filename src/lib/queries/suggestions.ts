import "server-only";
import { requirePermission } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Enums } from "@/lib/db/types";

export type SuggestionHistoryItem = {
  application_id: string;
  profile_title: string;
  client_name: string;
  stage: Enums<"application_stage">;
  discard_reason_key: Enums<"discard_reason_key"> | null;
  applied_at: string;
};

export type ProfileSuggestion = {
  id: string;
  status: Enums<"suggestion_status">;
  candidate_id: string;
  full_name: string;
  municipality: string | null;
  cv_score: number | null;
  rationale: string | null;
  flags: string | null;
  error: string | null;
  /** Todas sus postulaciones en Prime (cualquier cliente), de la más reciente a la más vieja. */
  history: SuggestionHistoryItem[];
  added_application_id: string | null;
};

/** Sugeridos de otras vacantes para una vacante (plan §12.25). Solo admin; RLS lo exige igual. */
export async function listProfileSuggestions(profileId: string): Promise<ProfileSuggestion[]> {
  await requirePermission("suggest_candidates");
  if (MOCK) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_candidate_suggestions")
    .select(
      "id, status, candidate_id, cv_score, rationale, flags, error, match_rank, added_application_id, candidates(full_name, municipality)",
    )
    .eq("profile_id", profileId)
    .neq("status", "dismissed")
    .order("cv_score", { ascending: false, nullsFirst: false })
    .order("match_rank", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];

  // Historial de cada persona: en qué vacantes (y de qué cliente) se ha postulado y cómo le fue.
  const candidateIds = [...new Set(rows.map((r) => r.candidate_id))];
  const byCandidate = new Map<string, SuggestionHistoryItem[]>();
  if (candidateIds.length > 0) {
    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select("id, candidate_id, stage, discard_reason_key, applied_at, job_profiles(title, clients(name))")
      .in("candidate_id", candidateIds)
      .order("applied_at", { ascending: false });
    if (appsError) throw appsError;
    for (const a of apps ?? []) {
      const list = byCandidate.get(a.candidate_id) ?? [];
      list.push({
        application_id: a.id,
        profile_title: a.job_profiles?.title ?? "",
        client_name: a.job_profiles?.clients?.name ?? "",
        stage: a.stage,
        discard_reason_key: a.discard_reason_key,
        applied_at: a.applied_at,
      });
      byCandidate.set(a.candidate_id, list);
    }
  }

  return rows.map((s) => ({
    id: s.id,
    status: s.status,
    candidate_id: s.candidate_id,
    full_name: s.candidates?.full_name ?? "Sin nombre",
    municipality: s.candidates?.municipality ?? null,
    cv_score: s.cv_score,
    rationale: s.rationale,
    flags: s.flags,
    error: s.error,
    added_application_id: s.added_application_id,
    history: (byCandidate.get(s.candidate_id) ?? []).filter((h) => h.application_id !== s.added_application_id),
  }));
}
