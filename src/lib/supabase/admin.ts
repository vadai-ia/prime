import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Cliente con service role: hace bypass de RLS. Solo para webhooks, cron,
 * jobs y auth.admin (invitaciones, app_metadata). Nunca lo uses en una
 * lectura que dependa del usuario en sesión.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
