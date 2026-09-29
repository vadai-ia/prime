/** Plazas cubiertas de una vacante: "2/4 cubiertas" con barra de avance (como en la demo). */
export function Coverage({ hired, openings, compact = false }: { hired: number; openings: number; compact?: boolean }) {
  const pct = openings > 0 ? Math.min(100, (hired / openings) * 100) : 0;
  const done = openings > 0 && hired >= openings;
  return (
    <div className={compact ? "w-24" : "w-full"}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`font-semibold ${done ? "text-leaf" : "text-ink"}`}>
          {hired}/{openings}
        </span>
        <span className="text-ink-faint">cubiertas</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${done ? "bg-leaf" : "bg-forest"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
