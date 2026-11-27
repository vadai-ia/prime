import { inputClass } from "@/components/ui/form";

type Option = { id: string; name: string };
export type Period = { desde?: string; hasta?: string };

/** Atajos de periodo, contados desde hoy (fechas locales YYYY-MM-DD). */
function presets(today: string): { label: string; desde: string; hasta: string }[] {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const day = (offset: number) => iso(new Date(Date.UTC(y, m - 1, d + offset)));
  return [
    { label: "Últimos 7 días", desde: day(-6), hasta: today },
    { label: "Últimos 30 días", desde: day(-29), hasta: today },
    { label: "Este mes", desde: iso(new Date(Date.UTC(y, m - 1, 1))), hasta: today },
    { label: "Mes pasado", desde: iso(new Date(Date.UTC(y, m - 2, 1))), hasta: iso(new Date(Date.UTC(y, m - 1, 0))) },
  ];
}

/** Filtros por GET: sin JS, el Server Component vuelve a renderizar con los searchParams. */
export function ReportFilters({
  clients,
  profiles,
  clientId,
  profileId,
  period,
  today,
}: {
  clients: Option[];
  profiles: Option[];
  clientId?: string;
  profileId?: string;
  period: Period;
  /** Hoy en la zona de México (YYYY-MM-DD), para los atajos. */
  today: string;
}) {
  const href = (p: Period) => {
    const q = new URLSearchParams();
    if (clientId) q.set("client", clientId);
    if (profileId) q.set("profile", profileId);
    if (p.desde) q.set("desde", p.desde);
    if (p.hasta) q.set("hasta", p.hasta);
    const s = q.toString();
    return s ? `/reportes?${s}` : "/reportes";
  };
  const filtered = clientId || profileId || period.desde || period.hasta;

  return (
    <div className="space-y-3">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-muted">
          Cliente
          <select name="client" defaultValue={clientId ?? ""} className={`${inputClass} min-w-48`}>
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Vacante
          <select name="profile" defaultValue={profileId ?? ""} className={`${inputClass} min-w-56`}>
            <option value="">Todas</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Desde
          <input type="date" name="desde" defaultValue={period.desde ?? ""} max={today} className={inputClass} />
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Hasta
          <input type="date" name="hasta" defaultValue={period.hasta ?? ""} max={today} className={inputClass} />
        </label>
        <button type="submit" className="rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep">
          Aplicar
        </button>
        {filtered && (
          <a href="/reportes" className="text-sm text-ink-muted hover:text-forest">
            Limpiar
          </a>
        )}
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-muted">Periodo:</span>
        {[{ label: "Todo", desde: undefined, hasta: undefined }, ...presets(today)].map((p) => {
          const active = (p.desde ?? "") === (period.desde ?? "") && (p.hasta ?? "") === (period.hasta ?? "");
          return (
            <a
              key={p.label}
              href={href({ desde: p.desde, hasta: p.hasta })}
              className={`rounded-full border px-2.5 py-1 font-medium transition ${active ? "border-forest bg-mint text-forest" : "border-line text-ink-muted hover:text-forest"}`}
            >
              {p.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
