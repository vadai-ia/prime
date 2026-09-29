import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, isRole, isStaff, type Role } from "@/lib/auth/roles";
import { can, type Permission } from "@/lib/auth/permissions";

export type Session = {
  userId: string;
  email: string | null;
  role: Role;
  clientId: string | null;
};

export class UnauthorizedError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Sesión verificada contra el servidor de Auth (no solo la cookie).
 * Cacheada por request con React.cache: llamarla en layout, página y
 * componentes hoja cuesta una sola llamada.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.app_metadata ?? {}) as { role?: unknown; client_id?: unknown };
  if (!isRole(meta.role)) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: meta.role,
    clientId: typeof meta.client_id === "string" ? meta.client_id : null,
  };
});

/** Para páginas y layouts: redirige a /login si no hay sesión. */
export const verifySession = cache(async (): Promise<Session> => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

/** Para páginas y layouts: redirige al home del rol si no está permitido. */
export async function requireRole(roles: readonly Role[]): Promise<Session> {
  const session = await verifySession();
  if (!roles.includes(session.role)) redirect(homeFor(session.role));
  return session;
}

/** Para páginas: permisos admin-only que heredan los módulos nuevos (exportar, inactivos, lista negra, asignaciones). */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await verifySession();
  if (!can(session.role, permission)) redirect(homeFor(session.role));
  return session;
}

export const requireStaff = () => requireRole(["admin", "recruiter"]);
export const requireAdmin = () => requireRole(["admin"]);
export const requireClient = () => requireRole(["client"]);

/**
 * Para Server Actions y Route Handlers: lanza en lugar de redirigir, para que
 * el action pueda devolver un error al formulario o el handler un 401/403.
 */
export async function assertRole(roles: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError("Sesión no válida");
  if (!roles.includes(session.role)) throw new UnauthorizedError("Sin permiso para esta acción");
  return session;
}

/** Igual que requirePermission, para Server Actions y Route Handlers. */
export async function assertPermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError("Sesión no válida");
  if (!can(session.role, permission)) throw new UnauthorizedError("Sin permiso para esta acción");
  return session;
}

export const assertStaff = () => assertRole(["admin", "recruiter"]);
export const assertAdmin = () => assertRole(["admin"]);
export const assertClient = () => assertRole(["client"]);

/** Fila de public.users del usuario en sesión (nombre, avatar, is_active). */
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, email, full_name, role, client_id, avatar_url, is_active, last_seen_at")
    .eq("id", session.userId)
    .maybeSingle();

  // Sin espejo (usuario sin rol) o desactivado: fuera.
  if (!data || !data.is_active) redirect("/auth/signout?reason=inactive");
  return data;
});

/**
 * "Última vez" en Configuración: la actualizan los layouts, como máximo cada 5 minutos y después de
 * responder (after), para no frenar la página. La política users_update_self permite tocar la propia fila.
 */
export async function touchLastSeen(user: { id: string; last_seen_at: string | null }) {
  const stale = !user.last_seen_at || Date.now() - new Date(user.last_seen_at).getTime() > 5 * 60_000;
  if (!stale) return;
  const supabase = await createClient();
  after(async () => {
    await supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  });
}

export { isStaff };
