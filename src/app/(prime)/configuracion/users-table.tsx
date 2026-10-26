"use client";

import { useState, type ReactNode } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";

/** Color de fila por rol; la leyenda de arriba usa el mismo y filtra al darle clic. */
const ROLE_ROW: Record<Role, string> = {
  admin: "bg-info-soft/60",
  recruiter: "bg-mint/60",
  client: "bg-amber-soft/60",
};
// la franja de la izquierda mantiene el color visible aunque la fila tenga pills del mismo tono
const ROLE_EDGE: Record<Role, string> = {
  admin: "border-l-info",
  recruiter: "border-l-forest",
  client: "border-l-amber",
};
const ROLE_DOT: Record<Role, string> = {
  admin: "bg-info",
  recruiter: "bg-forest",
  client: "bg-amber",
};

export type UserTableItem = { id: string; role: Role; search: string; cells: ReactNode[] };

/** Tabla de usuarios de Configuración con filtro por rol (leyenda de colores) y búsqueda por nombre o correo. */
export function UsersTable({ headers, items }: { headers: string[]; items: UserTableItem[] }) {
  const [role, setRole] = useState<Role | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => (!role || i.role === role) && (!q || i.search.includes(q)));
  const count = (r: Role) => items.filter((i) => i.role === r).length;

  const chip = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      active ? "border-forest bg-surface text-ink shadow-sm" : "border-line bg-surface text-ink-muted hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRole(null)} aria-pressed={role === null} className={chip(role === null)}>
          Todos <span className="text-ink-faint">{items.length}</span>
        </button>
        {ROLES.map((r) => (
          <button key={r} type="button" onClick={() => setRole(role === r ? null : r)} aria-pressed={role === r} className={chip(role === r)}>
            <span aria-hidden className={`size-2.5 rounded-full ${ROLE_DOT[r]}`} />
            {ROLE_LABELS[r]} <span className="text-ink-faint">{count(r)}</span>
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar usuario"
          className="ml-auto w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25 sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60">
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-muted ${i === headers.length - 1 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-6 text-center text-sm text-ink-muted">
                  Nadie coincide con el filtro.
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.id} className={ROLE_ROW[item.role]}>
                  {item.cells.map((c, i) => (
                    <td key={i} className={`px-4 py-2.5 text-ink ${i === item.cells.length - 1 ? "text-right" : "text-left"} ${i === 0 ? `border-l-4 ${ROLE_EDGE[item.role]}` : ""}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
