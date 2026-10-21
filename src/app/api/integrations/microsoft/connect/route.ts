import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dal";
import { isStaff } from "@/lib/auth/roles";
import { authorizeUrl, microsoftEnabled, OAUTH_COOKIE, redirectUri } from "@/lib/integrations/microsoft-graph";

/** "Conectar Outlook" en Mi cuenta: manda al reclutador a iniciar sesión en Microsoft (OAuth con PKCE). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) return NextResponse.redirect(new URL("/login", request.url));
  if (!microsoftEnabled()) return NextResponse.redirect(new URL("/mi-cuenta?outlook=sin-configurar", request.url));

  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");

  const response = NextResponse.redirect(authorizeUrl({ state, codeChallenge, redirect: redirectUri(request.nextUrl.origin) }));
  response.cookies.set(OAUTH_COOKIE, `${state}.${verifier}.${session.userId}`, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/integrations/microsoft",
    maxAge: 600,
  });
  return response;
}
