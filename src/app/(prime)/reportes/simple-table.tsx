import type { ReactNode } from "react";

/** Tabla compacta para números debajo de las gráficas y listados de configuración. */
export function SimpleTable({ headers, rows, align = [], empty = "Sin datos" }: { headers: ReactNode[]; rows: ReactNode[][]; align?: ("left" | "right" | "center")[]; empty?: string }) {
  const alignClass = (i: number) => (align[i] === "right" ? "text-right" : align[i] === "center" ? "text-center" : "text-left");
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-muted ${alignClass(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-sm text-ink-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, r) => (
              <tr key={r} className="hover:bg-canvas/50">
                {cells.map((c, i) => (
                  <td key={i} className={`px-4 py-2.5 text-ink ${alignClass(i)}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
