// Permisos que no dependen de qué vacantes trabaja cada quien (plan §2.3).
// Espejo de app.has_permission() en SQL (migración 0014): si cambias uno, cambia el otro.
// Sin imports de servidor: lo usan el DAL, los actions y la UI.
import type { Role } from "./roles";

export const PERMISSIONS = {
  /** Marcar qué reclutadores trabajan una vacante y reasignar candidatos. */
  manage_assignments: ["admin"],
  /** Exportar o descargar bases (Excel, PDF). */
  export: ["admin"],
  /** Ver la base de candidatos inactivos. */
  view_inactive_candidates: ["admin"],
  /** Ver la lista negra y sus motivos. */
  view_blacklist: ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
