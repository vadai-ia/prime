import "server-only";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import { todayLocal } from "@/lib/format";
import type { Enums, Tables } from "@/lib/db/types";

// Permanencia a 30, 90 y 180 días (placement_followups, migraciones 0013 y 0024). RLS decide: el
// reclutador ve los de sus candidatos y el admin todos.

export type FollowupRow = Tables<"placement_followups"> & {
  full_name: string;
  phone_e164: string | null;
  profile_title: string;
  client_name: string;
  stage: Enums<"application_stage">;
  start_date: string | null;
  hired_at: string | null;
  recruiter_name: string | null;
  recorded_by_name: string | null;
};

export type FollowupView = "vencidos" | "proximos" | "capturados";

const SELECT = `*,
  recorder:users!placement_followups_recorded_by_fkey(full_name),
  applications!inner(stage, start_date, hired_at,
    candidates(full_name, phone_e164),
    job_profiles(title, clients(name)),
    recruiter:users!applications_assigned_recruiter_id_fkey(full_name))`;

type Raw = Tables<"placement_followups"> & {
  recorder: { full_name: string } | null;
  applications: {
    stage: Enums<"application_stage">;
    start_date: string | null;
    hired_at: string | null;
    candidates: { full_name: string; phone_e164: string | null } | null;
    job_profiles: { title: string; clients: { name: string } | null } | null;
    recruiter: { full_name: string } | null;
  };
};

function flatten({ recorder, applications: a, ...f }: Raw): FollowupRow {
  return {
    ...f,
    full_name: a.candidates?.full_name ?? "—",
    phone_e164: a.candidates?.phone_e164 ?? null,
    profile_title: a.job_profiles?.title ?? "—",
    client_name: a.job_profiles?.clients?.name ?? "—",
    stage: a.stage,
    start_date: a.start_date,
    hired_at: a.hired_at,
    recruiter_name: a.recruiter?.full_name ?? null,
    recorded_by_name: recorder?.full_name ?? null,
  };
}

/** Días que se miran hacia adelante en "Próximos". */
export const UPCOMING_DAYS = 30;

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Vencidos sin capturar, próximos a vencer o ya capturados (los más recientes). */
export async function listFollowups(view: FollowupView): Promise<FollowupRow[]> {
  await requireStaff();
  if (MOCK) return [];
  const supabase = await createClient();
  const today = todayLocal();
  let query = supabase.from("placement_followups").select(SELECT);
  if (view === "vencidos") query = query.eq("outcome", "pending").lte("due_at", today).order("due_at");
  else if (view === "proximos") query = query.eq("outcome", "pending").gt("due_at", today).lte("due_at", addDays(today, UPCOMING_DAYS)).order("due_at");
  else query = query.neq("outcome", "pending").order("recorded_at", { ascending: false, nullsFirst: false });
  const { data, error } = await query.limit(300);
  if (error) throw error;
  return (data as unknown as Raw[]).map(flatten);
}

/** Todos los cortes, para exportar (solo admin; quien llama ya verificó el permiso). */
export async function listAllFollowups(): Promise<FollowupRow[]> {
  await requireStaff();
  if (MOCK) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("placement_followups").select(SELECT).order("due_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return (data as unknown as Raw[]).map(flatten);
}

/** Cuántos cortes vencidos y próximos hay, para las pestañas y el tablero. */
export async function countFollowups(): Promise<{ vencidos: number; proximos: number }> {
  await requireStaff();
  if (MOCK) return { vencidos: 0, proximos: 0 };
  const supabase = await createClient();
  const today = todayLocal();
  const [due, next] = await Promise.all([
    supabase.from("placement_followups").select("id", { count: "exact", head: true }).eq("outcome", "pending").lte("due_at", today),
    supabase.from("placement_followups").select("id", { count: "exact", head: true }).eq("outcome", "pending").gt("due_at", today).lte("due_at", addDays(today, UPCOMING_DAYS)),
  ]);
  return { vencidos: due.count ?? 0, proximos: next.count ?? 0 };
}

/** Los tres cortes de una postulación contratada, para la ficha. */
export async function listApplicationFollowups(applicationId: string): Promise<Tables<"placement_followups">[]> {
  await requireStaff();
  if (MOCK) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("placement_followups").select("*").eq("application_id", applicationId).order("checkpoint_days");
  if (error) throw error;
  return data;
}
