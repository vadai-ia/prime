import "server-only";
import { verifySession } from "@/lib/dal";
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
