// Compartido entre proxy, DAL y UI. Sin imports de servidor.

export const ROLES = ["admin", "recruiter", "client"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: readonly Role[] = ["admin", "recruiter"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaff(role: Role | null | undefined) {
  return role === "admin" || role === "recruiter";
}

/** A dónde va cada rol después de entrar. */
export function homeFor(role: Role | null | undefined) {
  return role === "client" ? "/portal" : "/tablero";
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  recruiter: "Reclutador",
  client: "Cliente",
};
