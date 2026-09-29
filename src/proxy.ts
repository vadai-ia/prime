import type { NextRequest } from "next/server";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";
import { homeFor, isStaff } from "@/lib/auth/roles";

// Rutas que no requieren sesión. Los webhooks y el cron validan firma/secret por su cuenta.
const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/webhooks/", "/api/cron/"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

/**
 * Redirecciones optimistas por sesión y rol (plan §1). No autoriza nada:
 * cada página, layout y action verifica con dal.ts.
 */
export async function proxy(request: NextRequest) {
  const { response, session } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!session) {
    if (isPublic(pathname)) return response;
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(request, response, `/login${next}`);
  }

  // Con sesión pero sin rol válido (usuario creado sin app_metadata): fuera.
  if (!session.role) {
    if (pathname.startsWith("/auth/")) return response;
    return redirectWithCookies(request, response, "/auth/signout?reason=no-role");
  }

  const home = homeFor(session.role);

  if (pathname === "/" || pathname === "/login") {
    return redirectWithCookies(request, response, home);
  }

  const inPortal = pathname === "/portal" || pathname.startsWith("/portal/");
  const inAccount = pathname === "/cuenta" || pathname.startsWith("/cuenta/");

  if (session.role === "client" && !inPortal && !inAccount && !isPublic(pathname)) {
    return redirectWithCookies(request, response, home);
  }

  if (isStaff(session.role) && inPortal) {
    return redirectWithCookies(request, response, home);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes. Server Actions viajan como POST a su ruta, así que quedan cubiertos.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
