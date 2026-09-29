import { inputClass } from "@/components/ui/form";

type Option = { id: string; name: string };

/** Filtros por GET: sin JS, el Server Component vuelve a renderizar con los searchParams. */
export function ReportFilters({ clients, profiles, clientId, profileId }: { clients: Option[]; profiles: Option[]; clientId?: string; profileId?: string }) {
  return (
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
      <button type="submit" className="rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-white transition hover:bg-forest-deep">
        Aplicar
      </button>
      {(clientId || profileId) && (
        <a href="/reportes" className="text-sm text-ink-muted hover:text-forest">
          Limpiar
        </a>
      )}
    </form>
  );
}
