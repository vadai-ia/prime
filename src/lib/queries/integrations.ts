import "server-only";
import { requireAdmin, verifySession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";

/** La conexión con Outlook del usuario en sesión (RLS: cada quien ve solo la suya), o null. */
export async function getMyOutlook(): Promise<{ account_email: string | null; created_at: string } | null> {
  const session = await verifySession();
  if (MOCK) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("user_integrations").select("account_email, created_at").eq("user_id", session.userId).eq("provider", "microsoft").maybeSingle();
  return data;
}

/** Solo admin: quién conectó su Outlook (sin tokens; RPC list_user_integrations, 0024). */
export async function listOutlookConnections(): Promise<Map<string, { account_email: string; connected_at: string }>> {
  await requireAdmin();
  if (MOCK) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_user_integrations");
  if (error) throw error;
  return new Map(data.filter((i) => i.provider === "microsoft").map((i) => [i.user_id, { account_email: i.account_email, connected_at: i.connected_at }]));
}
