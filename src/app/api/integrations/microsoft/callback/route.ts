import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dal";
import { isStaff } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, fetchAccountEmail, integrationColumns, MicrosoftGraphError, microsoftEnabled, OAUTH_COOKIE, redirectUri } from "@/lib/integrations/microsoft-graph";

/**
 * Regreso de Microsoft: valida el state, cambia el código por tokens y los guarda cifrados con la
 * sesión del usuario (RLS: cada quien escribe solo su fila de user_integrations).
 */
export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const response = NextResponse.redirect(new URL(`/mi-cuenta?outlook=${status}`, request.url));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/integrations/microsoft" });
    return response;
  };

  const session = await getSession();
  if (!session || !isStaff(session.role)) return NextResponse.redirect(new URL("/login", request.url));
  if (!microsoftEnabled()) return back("sin-configurar");

  const params = request.nextUrl.searchParams;
  // El usuario canceló, o el tenant de Prime exige consentimiento del admin (AADSTS65001 / consent_required)
  const msError = params.get("error");
  if (msError) return back(msError === "access_denied" || msError === "consent_required" ? "sin-permiso" : "error");

  const [state, verifier, userId] = (request.cookies.get(OAUTH_COOKIE)?.value ?? "").split(".");
  const code = params.get("code");
  if (!code || !state || !verifier || state !== params.get("state") || userId !== session.userId) return back("error");

  try {
    const tokens = await exchangeCode({ code, verifier, redirect: redirectUri(request.nextUrl.origin) });
    const email = await fetchAccountEmail(tokens.access_token);
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_integrations")
      .upsert({ user_id: session.userId, ...integrationColumns(tokens, email) }, { onConflict: "user_id,provider" });
    if (error) return back("error");
  } catch (e) {
    console.error("[microsoft] callback", e instanceof MicrosoftGraphError ? e.message : e);
    return back("error");
  }
  return back("conectado");
}
