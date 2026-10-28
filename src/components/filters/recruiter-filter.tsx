"use client";

/** Filtro por reclutador (solo admin) de Tablero y Entrevistas. Formulario GET: cambia la URL y el servidor recalcula. `keep` conserva otros filtros (el periodo). */
export function RecruiterFilter({ action, recruiters, value, keep = {} }: { action: string; recruiters: { id: string; full_name: string }[]; value: string; keep?: Record<string, string> }) {
  return (
    <form action={action} method="get">
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name="reclutador"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Reclutador"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
      >
        <option value="">Todo el equipo</option>
        {recruiters.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name}
          </option>
        ))}
        <option value="sin-asignar">Vacantes sin reclutador</option>
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm text-forest">
          Filtrar
        </button>
      </noscript>
    </form>
  );
}
