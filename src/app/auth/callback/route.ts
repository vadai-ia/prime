import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, isRole } from "@/lib/auth/roles";

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Intercambio de código (PKCE) por sesión.
 * Los enlaces con token_hash (templates de correo) no se canjean aquí: un GET lo puede hacer el
 * escáner del correo y gastaría el token. Se mandan a /auth/confirmar, donde lo canjea el botón (POST).
 * Esta ruta los sigue aceptando para que los correos ya enviados con /auth/callback funcionen.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  if (!code && params.get("token_hash")) {
    redirect(`/auth/confirmar?${params.toString()}`);
  }

  const next = safeNext(params.get("next"));
  const supabase = await createClient();

  const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : { error: true };
  if (error) redirect("/login?error=enlace");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;

  if (!isRole(role)) {
    await supabase.auth.signOut();
    redirect("/login?error=sin-rol");
  }

  redirect(next ?? homeFor(role));
}
