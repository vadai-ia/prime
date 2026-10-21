import "server-only";
import { requirePermission } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Tables } from "@/lib/db/types";

// Lista negra (migración 0021). Solo admin: RLS no le devuelve nada a nadie más, y aquí se exige igual.

export type BlacklistEntry = Tables<"candidate_blacklist"> & {
  added_by_name: string | null;
  removed_by_name: string | null;
  /** Postulación más reciente de la persona, para abrir su ficha. */
  last_application_id: string | null;
};

const SELECT = "*, added_by_user:users!candidate_blacklist_added_by_fkey(full_name), removed_by_user:users!candidate_blacklist_removed_by_fkey(full_name)";

async function withApplications(rows: (Tables<"candidate_blacklist"> & { added_by_user: { full_name: string } | null; removed_by_user: { full_name: string } | null })[]): Promise<BlacklistEntry[]> {
  const ids = [...new Set(rows.map((r) => r.candidate_id).filter((id): id is string => !!id))];
  const latest = new Map<string, string>();
  if (ids.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from("applications").select("id, candidate_id, applied_at").in("candidate_id", ids).order("applied_at", { ascending: false });
    for (const a of data ?? []) if (!latest.has(a.candidate_id)) latest.set(a.candidate_id, a.id);
  }
  return rows.map(({ added_by_user, removed_by_user, ...r }) => ({
    ...r,
    added_by_name: added_by_user?.full_name ?? null,
    removed_by_name: removed_by_user?.full_name ?? null,
    last_application_id: r.candidate_id ? (latest.get(r.candidate_id) ?? null) : null,
  }));
}

/** Vigentes primero; con `history` también las que ya se quitaron. */
export async function listBlacklist({ history = false }: { history?: boolean } = {}): Promise<BlacklistEntry[]> {
  await requirePermission("view_blacklist");
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase.from("candidate_blacklist").select(SELECT).order("added_at", { ascending: false }).limit(500);
  if (!history) query = query.is("removed_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return withApplications(data);
}

/** Registro vigente de un candidato, o null. */
export async function getBlacklistEntry(candidateId: string): Promise<BlacklistEntry | null> {
  await requirePermission("view_blacklist");
  if (MOCK) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("candidate_blacklist").select(SELECT).eq("candidate_id", candidateId).is("removed_at", null).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [entry] = await withApplications([data]);
  return entry ?? null;
}
