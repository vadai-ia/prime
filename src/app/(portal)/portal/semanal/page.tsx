import type { Metadata } from "next";
import Link from "next/link";
import { getWeeklyReport, listPortalReports } from "@/lib/queries/portal";
import { CHANNEL_LABELS, STAGE_LABELS, type Stage } from "@/lib/labels";
import { fmtDate, fmtDateLong, fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Bar } from "@/components/ui/bar";
import { StagePill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Reporte semanal · Portal Prime HR" };

export default async function WeeklyReportPage() {
  const [report, previous] = await Promise.all([getWeeklyReport(), listPortalReports("weekly_client")]);

  const pending = report.advanced.filter((a) => a.stage === "client_interview").length;

  const funnel = new Map<Stage, { order: number; total: number }>();
  for (const r of report.funnel) {
    if (!r.stage) continue;
    const prev = funnel.get(r.stage);
    funnel.set(r.stage, { order: r.stage_order ?? 0, total: (prev?.total ?? 0) + (r.applications ?? 0) });
  }
  const funnelRows = Array.from(funnel.entries()).sort((a, b) => a[1].order - b[1].order);
  const funnelMax = Math.max(1, ...funnelRows.map(([, v]) => v.total));

  const channels = new Map<string, { applications: number; hired: number }>();
  for (const r of report.channel) {
    if (!r.source_channel) continue;
    const prev = channels.get(r.source_channel);
    channels.set(r.source_channel, { applications: (prev?.applications ?? 0) + (r.applications ?? 0), hired: (prev?.hired ?? 0) + (r.hired ?? 0) });
  }
  const channelRows = Array.from(channels.entries()).sort((a, b) => b[1].applications - a[1].applications);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reporte semanal · {report.client_name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Del {fmtDate(report.period_start)} al {fmtDateLong(report.period_end)}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Nuevos avances" value={report.advanced.length} tone="forest" hint="Candidatos que cambiaron de etapa esta semana" />
        <Stat label="Contrataciones" value={report.hired.length} tone="leaf" />
        <Stat label="Pendientes de tu decisión" value={pending} tone={pending ? "amber" : "ink"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Embudo" subtitle="Cuántos candidatos han llegado a cada etapa.">
          {funnelRows.length === 0 ? (
            <p className="text-sm text-ink-muted">Aún no hay movimientos que mostrar.</p>
          ) : (
            <div className="space-y-3">
              {funnelRows.map(([stage, v]) => (
                <Bar key={stage} value={v.total} max={funnelMax} tone={stage === "hired" ? "forest" : stage === "discarded" ? "neutral" : "leaf"} label={STAGE_LABELS[stage]} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Canales" subtitle="De dónde llegan los candidatos.">
          {channelRows.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin información de canales todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="pb-2 font-medium">Canal</th>
                  <th className="pb-2 text-right font-medium">Postulaciones</th>
                  <th className="pb-2 text-right font-medium">Contratados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {channelRows.map(([channel, v]) => (
                  <tr key={channel}>
                    <td className="py-2 text-ink">{CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS] ?? channel}</td>
                    <td className="py-2 text-right text-ink">{v.applications}</td>
                    <td className="py-2 text-right font-medium text-forest">{v.hired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Avances de la semana" padded={false}>
          {report.advanced.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">Sin avances esta semana.</div>
          ) : (
            <ul className="divide-y divide-line">
              {report.advanced.map((a) => (
                <li key={a.application_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/portal/candidatos/${a.application_id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink hover:text-forest">{a.full_name}</p>
                    <p className="text-xs text-ink-muted">{a.profile_title}</p>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-faint">{fmtDate(a.stage_changed_at)}</span>
                    <StagePill stage={a.stage} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Contratados" padded={false}>
          {report.hired.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">Aún no hay contrataciones en este periodo.</div>
          ) : (
            <ul className="divide-y divide-line">
              {report.hired.map((a) => (
                <li key={a.application_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/portal/candidatos/${a.application_id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink hover:text-forest">{a.full_name}</p>
                    <p className="text-xs text-ink-muted">{a.profile_title}</p>
                  </Link>
                  <span className="text-xs text-ink-muted">Desde el {fmtDate(a.hired_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Siguientes pasos">
        {report.next_steps.length === 0 ? (
          <p className="text-sm text-ink-muted">Nada pendiente de tu lado por ahora.</p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            {report.next_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        )}
      </Card>

      {report.report && (
        <Card title="Último correo enviado" subtitle={fmtDateTime(report.report.sent_at)}>
          <p className="text-sm text-ink">{report.report.subject}</p>
          <p className="mt-2 text-xs text-ink-faint">El PDF de este reporte está disponible a solicitud con tu contacto en Prime.</p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Reportes anteriores</h2>
        {previous.length === 0 ? (
          <EmptyState title="Todavía no hay reportes enviados" hint="Cada semana recibirás este resumen por correo." />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {previous.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="text-ink">{r.subject ?? "Reporte semanal"}</p>
                  <p className="text-xs text-ink-muted">
                    Del {fmtDate(r.period_start)} al {fmtDate(r.period_end)}
                  </p>
                </div>
                <span className="text-xs text-ink-faint">Enviado {fmtDateTime(r.sent_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
