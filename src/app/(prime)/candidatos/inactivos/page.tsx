import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { INACTIVE_MONTHS, listInactive, type InactiveMonths } from "@/lib/queries/inactive";
import { DISCARD_REASON_LABELS, STAGE_LABELS } from "@/lib/labels";
import { fmtDate, fmtPhone, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { SimpleTable } from "../../reportes/simple-table";

export const metadata: Metadata = { title: "Candidatos inactivos · Prime HR Innovation" };

const MONTH_LABELS: Record<InactiveMonths, string> = { 0: "Todos", 1: "1 mes", 3: "3 meses", 6: "6 meses", 12: "1 año" };

/** Solo admin (plan §2.3). Personas sin postulación en proceso y que no están trabajando por Prime: la base para volver a contactar. */
export default async function InactivosPage({ searchParams }: PageProps<"/candidatos/inactivos">) {
  const session = await requirePermission("view_inactive_candidates");
  const sp = await searchParams;
  const m = Number(sp.meses ?? 3);
  const months: InactiveMonths = (INACTIVE_MONTHS as readonly number[]).includes(m) ? (m as InactiveMonths) : 3;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const rows = await listInactive({ months, search });

  const href = (next: { meses?: InactiveMonths; q?: string }) => {
    const p = new URLSearchParams();
    p.set("meses", String(next.meses ?? months));
    const q = "q" in next ? next.q : search;
    if (q) p.set("q", q);
    return `?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/candidatos" className="text-xs text-ink-muted hover:text-forest">
        ← Candidatos
      </Link>
      <PageHeader
        title="Candidatos inactivos"
        subtitle={`${rows.length} ${rows.length === 1 ? "persona" : "personas"} sin proceso abierto${months ? ` y sin movimiento en ${MONTH_LABELS[months]}` : ""} · solo la ven los admins`}
        actions={
          can(session.role, "export") && (
            <ButtonLink href={`/candidatos/exportar${href({}).replace("?", "?tipo=inactivos&")}`} variant="ghost">
              Exportar a Excel
            </ButtonLink>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-medium text-ink-muted">Sin movimiento desde hace</p>
          <div className="mt-1 flex rounded-lg bg-canvas p-1">
            {INACTIVE_MONTHS.map((n) => (
              <Link
                key={n}
                href={href({ meses: n })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${n === months ? "bg-surface text-forest shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {MONTH_LABELS[n]}
              </Link>
            ))}
          </div>
        </div>
        <form className="flex items-end gap-2">
          <input type="hidden" name="meses" value={months} />
          <label className="text-xs font-medium text-ink-muted">
            Buscar
            <input name="q" defaultValue={search ?? ""} placeholder="Nombre o teléfono" className={`${inputClass} w-64`} />
          </label>
          <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-canvas">
            Buscar
          </button>
        </form>
      </div>

      <SimpleTable
        headers={["Persona", "Última vacante", "Cómo terminó", "Score CV", "Último movimiento", "Postulaciones"]}
        align={["left", "left", "left", "right", "left", "right"]}
        empty={search ? "Nadie coincide con la búsqueda." : "Nadie en este rango. Prueba con un periodo más corto."}
        rows={rows.map((r) => [
          <div key="p" className="min-w-0">
            {r.last_application_id ? (
              <Link href={`/candidatos/${r.last_application_id}`} className="font-medium text-ink hover:text-forest hover:underline">
                {r.full_name}
              </Link>
            ) : (
              <span className="font-medium">{r.full_name}</span>
            )}
            <p className="text-xs text-ink-muted">{[r.phone_e164 && fmtPhone(r.phone_e164), r.municipality, r.education_level].filter(Boolean).join(" · ")}</p>
          </div>,
          <div key="v">
            <p>{r.last_profile_title}</p>
            <p className="text-xs text-ink-muted">{r.last_client_name}</p>
          </div>,
          <div key="t">
            {r.last_stage === "hired" ? (
              <Pill tone="info">Trabajó y se fue</Pill>
            ) : (
              <>
                <p>{r.last_discard_reason_key ? DISCARD_REASON_LABELS[r.last_discard_reason_key] : "Descartado"}</p>
                {r.last_discarded_from_stage && <p className="text-xs text-ink-muted">en {STAGE_LABELS[r.last_discarded_from_stage]}</p>}
              </>
            )}
            {r.was_hired && r.last_stage !== "hired" && <p className="text-xs text-ink-muted">Ya trabajó por Prime antes</p>}
          </div>,
          <span key="s" className="tabular-nums">{r.best_cv_score ?? "—"}</span>,
          <span key="a" className="text-xs text-ink-muted" title={fmtDate(r.last_activity_at, { year: "numeric" })}>
            {timeAgo(r.last_activity_at)}
          </span>,
          <span key="n" className="tabular-nums">{r.applications_count}</span>,
        ])}
      />
      <p className="mt-3 text-xs text-ink-faint">
        Para volver a postular a alguien: Nuevo candidato con su teléfono; el sistema lo reconoce y le agrega la postulación. La lista negra no aparece aquí.
      </p>
    </div>
  );
}
