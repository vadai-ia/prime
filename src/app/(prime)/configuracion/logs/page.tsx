import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getAiSummary, listAiRuns, listAuditLog, listTaskLog, listWebhookLog } from "@/lib/queries/logs";
import { taskLabel } from "@/lib/queue/handlers";
import { AI_RUN_KIND_LABELS, AI_RUN_STATUS_LABELS, AI_RUN_STATUS_TONES, AUDIT_ACTION_LABELS, CANDIDATE_FIELD_LABELS, PROFILE_EDIT_SECTION_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { SimpleTable } from "../../reportes/simple-table";

export const metadata: Metadata = { title: "Logs técnicos · Prime HR Innovation" };

type Tab = "ia" | "tareas" | "webhooks" | "auditoria";
const TABS: { key: Tab; label: string }[] = [
  { key: "ia", label: "IA" },
  { key: "tareas", label: "Tareas automáticas" },
  { key: "webhooks", label: "Webhooks" },
  { key: "auditoria", label: "Accesos y cambios" },
];

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)} USD`;
const ms = (n: number | null) => (n === null ? "—" : n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`);

/** Enlace a lo que tocó cada registro, cuando se puede abrir. */
function entityHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "application") return `/candidatos/${id}`;
  if (type === "job_profile") return `/perfiles/${id}`;
  return null;
}

function EntityLink({ type, id }: { type: string | null; id: string | null }) {
  const href = entityHref(type, id);
  // CV leído que todavía no se da de alta (o se descartó en la carga): no hay ficha que abrir
  if (type === "cv_upload") return <span className="text-ink-faint">CV sin alta</span>;
  if (!href) return <span className="text-ink-faint">{type ?? "—"}</span>;
  return (
    <Link href={href} className="text-forest hover:underline">
      {type === "application" ? "Candidato" : "Vacante"}
    </Link>
  );
}

/** Solo admin. Lo que pasa por detrás: llamadas a la IA (costo y errores), la cola, los webhooks y quién abrió o exportó datos. */
export default async function LogsPage({ searchParams }: PageProps<"/configuracion/logs">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "ia";
  const onlyErrors = sp.errores === "1";
  const summary = await getAiSummary();

  const href = (next: { tab?: Tab; errores?: boolean }) => {
    const p = new URLSearchParams({ tab: next.tab ?? tab });
    if (next.errores ?? onlyErrors) p.set("errores", "1");
    return `/configuracion/logs?${p.toString()}`;
  };

  let table: React.ReactNode;
  if (tab === "ia") {
    const rows = await listAiRuns({ onlyErrors });
    table = (
      <SimpleTable
        headers={["Cuándo", "Tarea", "Estado", "Sobre", "Costo", "Tokens (entrada / salida / caché)", "Tiempo", "Resultado o error"]}
        align={["left", "left", "left", "left", "right", "right", "right", "left"]}
        empty={onlyErrors ? "Sin errores de la IA." : "Todavía no hay llamadas a la IA."}
        rows={rows.map((r) => [
          <span key="w" className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(r.created_at)}</span>,
          <div key="k">
            <p>{AI_RUN_KIND_LABELS[r.kind]}</p>
            <p className="text-xs text-ink-faint">{[r.model, r.effort, r.prompt_version].filter(Boolean).join(" · ")}</p>
          </div>,
          <Pill key="s" tone={AI_RUN_STATUS_TONES[r.status]}>{AI_RUN_STATUS_LABELS[r.status]}</Pill>,
          <EntityLink key="e" type={r.entity_type} id={r.entity_id} />,
          <span key="c" className="tabular-nums">{r.cost_usd === null ? "—" : `$${Number(r.cost_usd).toFixed(4)}`}</span>,
          <span key="t" className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
            {r.input_tokens ?? "—"} / {r.output_tokens ?? "—"} / {r.cache_read_tokens ?? 0}
          </span>,
          <span key="l" className="tabular-nums">{ms(r.latency_ms)}</span>,
          <div key="x" className="max-w-sm text-xs">
            {r.detail && <p className="text-ink-muted">{r.detail}</p>}
            {r.error && <p className="line-clamp-3 text-danger">{r.error}</p>}
          </div>,
        ])}
      />
    );
  } else if (tab === "tareas") {
    const rows = await listTaskLog({ onlyErrors });
    table = (
      <SimpleTable
        headers={["Creada", "Tarea", "Estado", "Intentos", "Terminó", "Último error"]}
        align={["left", "left", "left", "center", "left", "left"]}
        empty={onlyErrors ? "Ninguna tarea con error." : "La cola está vacía."}
        rows={rows.map((t) => [
          <span key="w" className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(t.created_at)}</span>,
          taskLabel(t.type),
          <Pill key="s" tone={TASK_STATUS_TONES[t.status]}>{TASK_STATUS_LABELS[t.status]}</Pill>,
          `${t.attempts}/${t.max_attempts}`,
          <span key="f" className="whitespace-nowrap text-xs text-ink-muted">{t.finished_at ? fmtDateTime(t.finished_at) : t.status === "pending" ? `Corre ${fmtDateTime(t.run_at)}` : "—"}</span>,
          <span key="x" className="line-clamp-3 max-w-md text-xs text-danger">{t.last_error ?? ""}</span>,
        ])}
      />
    );
  } else if (tab === "webhooks") {
    const rows = await listWebhookLog({ onlyErrors });
    table = (
      <SimpleTable
        headers={["Llegó", "Origen", "Evento", "Procesado", "Intentos", "Error"]}
        align={["left", "left", "left", "left", "center", "left"]}
        empty="Todavía no llega ningún webhook (WhatsApp y Fireflies los mandan cuando se conecten)."
        rows={rows.map((w) => [
          <span key="w" className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(w.received_at)}</span>,
          w.source,
          <span key="e" className="text-xs">{w.event_type}</span>,
          <span key="p" className="whitespace-nowrap text-xs text-ink-muted">{w.processed_at ? fmtDateTime(w.processed_at) : "Pendiente"}</span>,
          w.attempts,
          <span key="x" className="line-clamp-3 max-w-md text-xs text-danger">{w.error ?? ""}</span>,
        ])}
      />
    );
  } else {
    const rows = await listAuditLog();
    table = (
      <SimpleTable
        headers={["Cuándo", "Quién", "Qué", "Detalle", "IP"]}
        align={["left", "left", "left", "left", "left"]}
        empty="Nadie ha abierto CVs, documentos o psicométricos ni editado vacantes o candidatos todavía."
        rows={rows.map((r) => {
          const meta = (r.metadata ?? {}) as { tipo?: string; filas?: number; section?: string; version?: number; fields?: string[] };
          return [
            <span key="w" className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(r.created_at)}</span>,
            r.user_name ?? "—",
            AUDIT_ACTION_LABELS[r.action],
            <span key="d" className="text-xs text-ink-muted">
              {r.action === "export" ? (
                `${meta.tipo ?? r.entity_type}${meta.filas !== undefined ? ` · ${meta.filas} filas` : ""}`
              ) : r.action === "edit_profile" ? (
                <>
                  <EntityLink type={r.entity_type} id={r.entity_id} /> · {PROFILE_EDIT_SECTION_LABELS[meta.section ?? ""] ?? meta.section ?? "—"}
                  {meta.version !== undefined && ` (v${meta.version})`}
                </>
              ) : r.action === "edit_candidate" ? (
                <>
                  <EntityLink type={r.entity_type} id={r.entity_id} /> · {(meta.fields ?? []).map((f) => CANDIDATE_FIELD_LABELS[f] ?? f).join(", ") || "—"}
                </>
              ) : (
                r.entity_type
              )}
            </span>,
            <span key="i" className="text-xs text-ink-faint">{r.ip ? String(r.ip) : "—"}</span>,
          ];
        })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/configuracion" className="text-xs text-ink-muted hover:text-forest">
        ← Configuración
      </Link>
      <PageHeader title="Logs técnicos" subtitle="Lo que pasa por detrás: IA, tareas automáticas, webhooks y accesos a datos sensibles. Solo admin." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="IA · últimas 24 h" value={usd(summary.costToday)} hint="Gasto en Anthropic" />
        <Stat label="IA · 7 días" value={usd(summary.cost7d)} hint={`${summary.errors7d} con error`} tone={summary.errors7d ? "amber" : "ink"} />
        <Stat label="IA · 30 días" value={usd(summary.cost30d)} hint={`${summary.runs30d} llamadas`} />
        <Stat label="Costo promedio" value={summary.runs30d ? usd(summary.cost30d / summary.runs30d) : "—"} hint="Por llamada, 30 días" />
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key })}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${t.key === tab ? "border-forest font-medium text-forest" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {tab !== "auditoria" && (
          <Link href={href({ errores: !onlyErrors })} className="mb-2 text-sm font-medium text-forest hover:underline">
            {onlyErrors ? "Ver todo" : "Solo errores"}
          </Link>
        )}
      </div>
      {table}
      <p className="mt-3 text-xs text-ink-faint">Se muestran los últimos 150 registros de cada tipo.</p>
    </div>
  );
}
