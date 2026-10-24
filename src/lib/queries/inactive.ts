import "server-only";
import { requirePermission } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import type { Tables } from "@/lib/db/types";

// Base de inactivos (v_inactive_candidates, migración 0024). Solo admin: la vista no le devuelve
// nada a nadie más y aquí se exige igual. Inactivo = sin postulación en proceso y sin trabajar
// por Prime; el corte de tiempo lo elige la pantalla (Prime todavía no fija uno).

export type InactiveRow = Tables<"v_inactive_candidates">;

/** Meses sin movimiento que ofrece la pantalla; 0 = todos. */
export const INACTIVE_MONTHS = [0, 1, 3, 6, 12] as const;
export type InactiveMonths = (typeof INACTIVE_MONTHS)[number];

export async function listInactive({ months, search }: { months: InactiveMonths; search?: string }): Promise<InactiveRow[]> {
  await requirePermission("view_inactive_candidates");
  if (MOCK) return [];
  const supabase = await createClient();
  let query = supabase.from("v_inactive_candidates").select("*").order("last_activity_at", { ascending: false });
  if (months > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    query = query.lt("last_activity_at", cutoff.toISOString());
  }
  if (search) {
    // con 4 dígitos o más se busca por teléfono; si no, por nombre
    const digits = search.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("phone_e164", `%${digits}%`) : query.ilike("full_name", `%${search}%`);
  }
  const { data, error } = await query.limit(2000);
  if (error) throw error;
  return data;
}
