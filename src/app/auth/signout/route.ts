import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierre de sesión por GET: lo usa proxy.ts cuando la sesión no tiene rol o el usuario está inactivo. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason");
  redirect(reason ? `/login?error=${encodeURIComponent(reason)}` : "/login");
}
