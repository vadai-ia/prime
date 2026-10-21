import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listBlacklist } from "@/lib/queries/blacklist";
import { BLACKLIST_REASON_LABELS } from "@/lib/labels";
import { fmtDate, fmtPhone } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { SimpleTable } from "../../reportes/simple-table";
import { RemoveButton } from "./remove-button";

export const metadata: Metadata = { title: "Lista negra · Prime HR Innovation" };

/** Solo admin (plan §2.3). Se agrega desde la ficha del candidato; aquí se consulta y se quita. */
export default async function ListaNegraPage({ searchParams }: PageProps<"/candidatos/lista-negra">) {
  await requirePermission("view_blacklist");
  const history = (await searchParams).historial === "1";
  const rows = await listBlacklist({ history });
  const active = rows.filter((r) => !r.removed_at).length;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/candidatos" className="text-xs text-ink-muted hover:text-forest">
        ← Candidatos
      </Link>
      <PageHeader
        title="Lista negra"
        subtitle={`${active} ${active === 1 ? "persona" : "personas"} sin poder postularse · solo la ven los admins`}
        actions={
          <Link href={history ? "/candidatos/lista-negra" : "/candidatos/lista-negra?historial=1"} className="text-sm font-medium text-forest hover:underline">
            {history ? "Solo vigentes" : "Ver también las que se quitaron"}
          </Link>
        }
      />
      <SimpleTable
        headers={["Persona", "Motivo", "Agregada", history ? "Estado" : "", ""]}
        align={["left", "left", "left", "left", "right"]}
        empty="Nadie en la lista negra. Se agrega desde la ficha del candidato."
        rows={rows.map((r) => [
          <div key={`${r.id}-p`} className="min-w-0">
            {r.last_application_id ? (
              <Link href={`/candidatos/${r.last_application_id}`} className="font-medium text-ink hover:text-forest hover:underline">
                {r.full_name}
              </Link>
            ) : (
              <span className="font-medium">{r.full_name}</span>
            )}
            <p className="text-xs text-ink-muted">{[r.phone_e164 && fmtPhone(r.phone_e164), r.email, r.curp].filter(Boolean).join(" · ")}</p>
          </div>,
          <div key={`${r.id}-m`}>
            <p>{BLACKLIST_REASON_LABELS[r.reason_key]}</p>
            {r.reason_note && <p className="max-w-sm text-xs text-ink-muted">{r.reason_note}</p>}
          </div>,
          <span key={`${r.id}-a`} className="text-xs text-ink-muted">
            {fmtDate(r.added_at, { day: "numeric", month: "short", year: "numeric" })} · {r.added_by_name ?? "—"}
          </span>,
          history ? (
            r.removed_at ? (
              <span key={`${r.id}-s`} className="text-xs text-ink-muted">
                Quitada el {fmtDate(r.removed_at, { day: "numeric", month: "short", year: "numeric" })} por {r.removed_by_name ?? "—"}
                {r.removed_note ? `: ${r.removed_note}` : ""}
              </span>
            ) : (
              <Pill key={`${r.id}-s`} tone="danger">
                Vigente
              </Pill>
            )
          ) : (
            ""
          ),
          r.removed_at ? "" : <RemoveButton key={`${r.id}-x`} entryId={r.id} name={r.full_name} />,
        ])}
      />
    </div>
  );
}
