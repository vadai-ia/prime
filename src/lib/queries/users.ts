import "server-only";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { UserRow } from "./types";

/** Directorio de usuarios (admin, para Configuración). */
export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  if (MOCK) return mock.users.map((u) => ({ ...u, client_name: u.client_id ? mock.clientById(u.client_id).name : null }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*, clients(name)").order("role").order("full_name");
  if (error) throw error;
  return data.map(({ clients, ...u }) => ({ ...u, client_name: clients?.name ?? null }));
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
