import "server-only";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import { countStages, listPipeline } from "./pipeline";
import type { Enums } from "@/lib/db/types";
import type { Intake, ProfileDetail, ProfileSummary } from "./types";

/** Reclutadores de la vacante. Con RLS, el admin los recibe todos y el reclutador solo su propia fila. */
export const RECRUITERS_EMBED = "job_profile_assignments(users!job_profile_assignments_recruiter_id_fkey(full_name))" as const;

export function recruiterNames(rows: { users: { full_name: string } | null }[] | null): string[] {
  return (rows ?? []).map((r) => r.users?.full_name ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

export async function listProfiles(filters: { clientId?: string; status?: Enums<"profile_status"> } = {}): Promise<ProfileSummary[]> {
  await requireStaff();
  const rows = await listPipeline({ includeDiscarded: true });

  if (MOCK) {
    return mock.profiles
      .filter((p) => (!filters.clientId || p.client_id === filters.clientId) && (!filters.status || p.status === filters.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({
        id: p.id, client_id: p.client_id, title: p.title, status: p.status, openings: p.openings, work_zone: p.work_zone, created_at: p.created_at,
        client_name: mock.clientById(p.client_id).name, counts: countStages(rows.filter((r) => r.profile_id === p.id)), cv_threshold: mock.aiConfigByProfile(p.id)?.cv_threshold ?? null,
        recruiters: mock.recruiterNames(p.id),
      }));
  }

  const supabase = await createClient();
  let query = supabase
    .from("job_profiles")
    .select(`id, client_id, title, status, openings, work_zone, created_at, clients(name), job_profile_ai_configs(cv_threshold), ${RECRUITERS_EMBED}`)
    .order("created_at", { ascending: false });
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((p) => ({
    id: p.id, client_id: p.client_id, title: p.title, status: p.status, openings: p.openings, work_zone: p.work_zone, created_at: p.created_at,
    client_name: p.clients?.name ?? "", counts: countStages(rows.filter((r) => r.profile_id === p.id)), cv_threshold: p.job_profile_ai_configs?.cv_threshold ?? null,
    recruiters: recruiterNames(p.job_profile_assignments),
  }));
}

/** Perfil con su config de IA y el levantamiento de origen (las tres pestañas). */
export async function getProfile(profileId: string): Promise<ProfileDetail | null> {
  await requireStaff();
  const rows = await listPipeline({ profileId, includeDiscarded: true });

  if (MOCK) {
    const p = mock.profiles.find((x) => x.id === profileId);
    if (!p) return null;
    const intake = mock.intakes.find((i) => i.id === p.intake_id) ?? null;
    return {
      ...p,
      client_name: mock.clientById(p.client_id).name,
      ai_config: mock.aiConfigByProfile(p.id),
      intake: intake ? { id: intake.id, form: intake.form, status: intake.status, created_at: intake.created_at } : null,
      counts: countStages(rows),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_profiles")
    .select("*, clients(name), job_profile_ai_configs(*), job_intakes!job_profiles_intake_id_fkey(id, form, status, created_at)")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { clients, job_profile_ai_configs, job_intakes, ...profile } = data;
  return { ...profile, client_name: clients?.name ?? "", ai_config: job_profile_ai_configs ?? null, intake: job_intakes ?? null, counts: countStages(rows) };
}

export async function listIntakes(): Promise<(Intake & { client_name: string | null; profile_title: string | null })[]> {
  await requireStaff();
  if (MOCK) {
    return mock.intakes.map((i) => ({
      ...i,
      client_name: i.client_id ? mock.clientById(i.client_id).name : null,
      profile_title: i.profile_id ? mock.profileById(i.profile_id).title : null,
    }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_intakes").select("*, clients(name), job_profiles!job_intakes_profile_id_fkey(title)").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(({ clients, job_profiles, ...i }) => ({ ...i, client_name: clients?.name ?? null, profile_title: job_profiles?.title ?? null }));
}
