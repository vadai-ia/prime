import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/auth/roles";
import { isRole } from "@/lib/auth/roles";

export type ProxySession = { userId: string; role: Role | null } | null;

/**
 * Refresca la sesión (cookies) y devuelve los claims verificados del JWT.
 * Solo lectura optimista para redirigir: la autorización real vive en dal.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No pongas lógica entre createServerClient y getClaims: el refresh de tokens
  // ocurre aquí y las cookies nuevas tienen que viajar en `response`.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  let session: ProxySession = null;
  if (claims?.sub) {
    const meta = (claims.app_metadata ?? {}) as { role?: unknown };
    session = { userId: claims.sub, role: isRole(meta.role) ? meta.role : null };
  }

  return { response, session };
}

/** Redirige conservando las cookies refrescadas. */
export function redirectWithCookies(request: NextRequest, from: NextResponse, to: string) {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
