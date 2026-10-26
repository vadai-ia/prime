import "server-only";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { UserRow } from "./types";
import type { Enums } from "@/lib/db/types";

/** Directorio de usuarios (admin, para Configuración). */
export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  if (MOCK) return mock.users.map((u) => ({ ...u, client_name: u.client_id ? mock.clientById(u.client_id).name : null }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*, clients(name)").order("role").order("full_name");
  if (error) throw error;
  return data.map(({ clients, ...u }) => ({ ...u, client_name: clients?.name ?? null }));
}

export type UserVacancy = { id: string; title: string; client_name: string };

/** Vacantes asignadas a cada reclutador (admin, para la ficha del usuario en Configuración). */
export async function listUserVacancies(): Promise<Record<string, UserVacancy[]>> {
  await requireAdmin();
  const byUser: Record<string, UserVacancy[]> = {};
  const push = (userId: string, v: UserVacancy) => (byUser[userId] ??= []).push(v);
  if (MOCK) {
    for (const a of mock.profileAssignments) {
      const p = mock.profiles.find((x) => x.id === a.profile_id);
      if (p) push(a.recruiter_id, { id: p.id, title: p.title, client_name: mock.clients.find((c) => c.id === p.client_id)?.name ?? "" });
    }
    return byUser;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_profile_assignments").select("recruiter_id, job_profiles(id, title, clients(name))");
  if (error) throw error;
  for (const row of data) {
    const p = row.job_profiles;
    if (p) push(row.recruiter_id, { id: p.id, title: p.title, client_name: p.clients?.name ?? "" });
  }
  for (const list of Object.values(byUser)) list.sort((a, b) => a.client_name.localeCompare(b.client_name) || a.title.localeCompare(b.title));
  return byUser;
}

export type AssignableProfile = UserVacancy & { status: Enums<"profile_status"> };

/** Vacantes que se pueden asignar desde la ficha del reclutador: todas menos las cerradas. */
export async function listAssignableProfiles(): Promise<AssignableProfile[]> {
  await requireAdmin();
  if (MOCK) {
    return mock.profiles
      .filter((p) => p.status !== "closed")
      .map((p) => ({ id: p.id, title: p.title, status: p.status, client_name: mock.clients.find((c) => c.id === p.client_id)?.name ?? "" }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_profiles").select("id, title, status, clients(name)").neq("status", "closed");
  if (error) throw error;
  return data
    .map((p) => ({ id: p.id, title: p.title, status: p.status, client_name: p.clients?.name ?? "" }))
    .sort((a, b) => a.client_name.localeCompare(b.client_name) || a.title.localeCompare(b.title));
}

/** Reclutadores y admins activos, para asignar entrevistas. */
export async function listStaff(): Promise<Pick<UserRow, "id" | "full_name" | "email" | "role" | "avatar_url">[]> {
  await requireStaff();
  if (MOCK) return mock.users.filter((u) => u.role !== "client" && u.is_active);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, avatar_url")
    .in("role", ["admin", "recruiter"])
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data;
}
