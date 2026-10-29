import "server-only";
import { requirePermission } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { ProfileRecruiters } from "./types";

const HISTORY_LIMIT = 30;

/** Checklist de reclutadores activos de una vacante y el historial de cambios. Solo admin. */
export async function getProfileRecruiters(profileId: string): Promise<ProfileRecruiters> {
  await requirePermission("manage_assignments");

  if (MOCK) {
    const assigned = mock.profileAssignments.filter((a) => a.profile_id === profileId);
    return {
      recruiters: mock.users
        .filter((u) => u.role === "recruiter" && u.is_active)
        .map((u) => {
          const a = assigned.find((x) => x.recruiter_id === u.id);
          return { id: u.id, full_name: u.full_name, email: u.email, avatar_url: u.avatar_url, assigned: !!a, assigned_at: a?.assigned_at ?? null };
        }),
      history: mock.assignmentEvents
        .filter((e) => e.profile_id === profileId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((e) => ({ ...e, recruiter_name: mock.usersById(e.recruiter_id)?.full_name ?? "", actor_name: mock.usersById(e.actor_user_id)?.full_name ?? null })),
    };
  }

  const supabase = await createClient();
  const [recruiters, assigned, history] = await Promise.all([
    supabase.from("users").select("id, full_name, email, avatar_url").eq("role", "recruiter").eq("is_active", true).order("full_name"),
    supabase.from("job_profile_assignments").select("recruiter_id, assigned_at").eq("profile_id", profileId),
    supabase
      .from("job_profile_assignment_events")
      .select("*, recruiter:users!job_profile_assignment_events_recruiter_id_fkey(full_name), actor:users!job_profile_assignment_events_actor_user_id_fkey(full_name)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (recruiters.error) throw recruiters.error;
  if (assigned.error) throw assigned.error;
  if (history.error) throw history.error;

  return {
    recruiters: recruiters.data.map((u) => {
      const a = assigned.data.find((x) => x.recruiter_id === u.id);
      return { ...u, assigned: !!a, assigned_at: a?.assigned_at ?? null };
    }),
    history: history.data.map(({ recruiter, actor, ...e }) => ({ ...e, recruiter_name: recruiter?.full_name ?? "", actor_name: actor?.full_name ?? null })),
  };
}

export type RecruiterOption = { id: string; full_name: string | null; email: string };

/** Reclutadores activos para marcar al crear una vacante (levantamiento). Solo admin. */
export async function listActiveRecruiters(): Promise<RecruiterOption[]> {
  await requirePermission("manage_assignments");
  if (MOCK) return mock.users.filter((u) => u.role === "recruiter" && u.is_active).map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("id, full_name, email").eq("role", "recruiter").eq("is_active", true).order("full_name");
  if (error) throw error;
  return data;
}

/**
 * Qué vacantes trabaja cada reclutador (id del reclutador → ids de vacantes), para el filtro por
 * reclutador y la carga del Tablero y Entrevistas: desde 0029 el reclutador ve a todos los candidatos
 * de sus vacantes. Solo admin.
 */
export async function listRecruiterProfiles(): Promise<Map<string, Set<string>>> {
  await requirePermission("manage_assignments");
  let rows: { recruiter_id: string; profile_id: string }[] = mock.profileAssignments;
  if (!MOCK) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("job_profile_assignments").select("recruiter_id, profile_id");
    if (error) throw error;
    rows = data;
  }
  const m = new Map<string, Set<string>>();
  for (const r of rows) m.set(r.recruiter_id, (m.get(r.recruiter_id) ?? new Set<string>()).add(r.profile_id));
  return m;
}

/** ¿La vacante entra en el filtro de reclutador? "sin-asignar" = vacantes que nadie trabaja. */
export function inRecruiterScope(profileId: string | null, recruiterParam: string, byRecruiter: Map<string, Set<string>>): boolean {
  if (!profileId) return false;
  if (recruiterParam === "sin-asignar") return ![...byRecruiter.values()].some((s) => s.has(profileId));
  return byRecruiter.get(recruiterParam)?.has(profileId) ?? false;
}
