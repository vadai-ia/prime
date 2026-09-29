import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { ChannelChart } from "@/components/charts/channel-chart";
import { StageDurationChart } from "@/components/charts/stage-duration-chart";
import { DiscardChart } from "@/components/charts/discard-chart";
import { REPORT_TYPE_LABELS, type Tone } from "@/lib/labels";
import { fmtDate, fmtDateLong, fmtPct, hoursLabel, timeAgo } from "@/lib/format";
import { asArray, type InsightItem } from "@/lib/domain/json";
import type { AiInsight, ReportRun } from "@/lib/queries/types";
import { SimpleTable } from "./simple-table";
import { QUESTION_LABELS, type ChannelAgg, type DiscardAgg, type DiscardByStage, type DurationAgg, type FunnelAgg, type PrefilterAgg } from "./aggregate";

export function EmbudoSection({ stages, discarded }: { stages: FunnelAgg[]; discarded: number }) {
  const first = stages[0]?.value ?? 0;
  const hired = stages.find((s) => s.key === "hired")?.value ?? 0;
  if (!first) return <EmptyState title="Sin postulaciones en el filtro" hint="Cambia el cliente o la vacante." />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Postulantes" value={first} />
        <Stat label="Pasaron prefiltro" value={stages.find((s) => s.key === "cv_review")?.value ?? 0} hint={fmtPct(first ? ((stages.find((s) => s.key === "cv_review")?.value ?? 0) / first) * 100 : 0)} />
        <Stat label="Llegaron a expediente" value={stages.find((s) => s.key === "documents")?.value ?? 0} />
        <Stat label="Contratados" value={hired} tone="forest" hint={`${discarded} descartados`} />
      </div>
      <Card title="Embudo" subtitle="Postulaciones que tocaron cada etapa">
        <FunnelChart data={stages.map((s) => ({ label: s.label, value: s.value }))} />
      </Card>
      <SimpleTable
        headers={["Etapa", "Postulaciones", "% del total", "Conversión vs. anterior"]}
        align={["left", "right", "right", "right"]}
        rows={[
          ...stages.map((s, i) => [s.label, s.value, fmtPct(first ? (s.value / first) * 100 : 0), i === 0 ? "—" : fmtPct(stages[i - 1]!.value ? (s.value / stages[i - 1]!.value) * 100 : 0)]),
          [<span key="d" className="text-danger">Descartados</span>, discarded, fmtPct(first ? (discarded / first) * 100 : 0), "—"],
        ]}
      />
    </div>
  );
}

export function CanalesSection({ channels }: { channels: ChannelAgg[] }) {
  if (!channels.length) return <EmptyState title="Sin datos de canal" />;
  return (
    <div className="space-y-5">
      <Card title="Canales de origen" subtitle="Postulantes, quiénes pasaron el prefiltro y contratados por canal">
        <ChannelChart data={channels.map((c) => ({ label: c.label, applications: c.applications, prefilter_passed: c.prefilter_passed, hired: c.hired }))} />
      </Card>
      <SimpleTable
        headers={["Canal", "Postulantes", "Pasaron prefiltro", "Contratados", "Descartados", "Tasa de contratación"]}
        align={["left", "right", "right", "right", "right", "right"]}
        rows={channels.map((c) => [c.label, c.applications, c.prefilter_passed, c.hired, c.discarded, fmtPct(c.applications ? (c.hired / c.applications) * 100 : 0)])}
      />
    </div>
  );
}

export function TiemposSection({ durations }: { durations: DurationAgg[] }) {
  if (!durations.length) return <EmptyState title="Aún no hay tiempos por etapa" hint="Se calculan cuando una postulación sale de una etapa." />;
  const slowest = durations.slice().sort((a, b) => b.hours - a.hours)[0]!;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Etapa más lenta" value={slowest.label} hint={`Mediana ${hoursLabel(slowest.hours)}`} tone="amber" />
        <Stat label="Tiempo total mediano" value={hoursLabel(durations.reduce((s, d) => s + d.hours, 0))} hint="Suma de medianas por etapa" />
      </div>
      <Card title="Tiempo en cada etapa" subtitle="Mediana de horas entre entrar y salir de la etapa">
        <StageDurationChart data={durations.map((d) => ({ label: d.label, hours: d.hours, samples: d.samples }))} />
      </Card>
      <SimpleTable headers={["Etapa", "Mediana", "Muestras"]} align={["left", "right", "right"]} rows={durations.map((d) => [d.label, hoursLabel(d.hours), d.samples])} />
    </div>
  );
}

export function DescartesSection({ byReason, byStage, total }: { byReason: DiscardAgg[]; byStage: DiscardByStage[]; total: number }) {
  if (!total) return <EmptyState title="Sin descartes en el filtro" />;
  return (
    <div className="space-y-5">
      <Card title="Motivos de descarte" subtitle={`${total} descartes en el periodo`}>
        <DiscardChart data={byReason.map((r) => ({ label: r.label, value: r.value }))} />
      </Card>
      <SimpleTable
        headers={["Etapa de origen", "Motivo", "Descartes", "% del total"]}
        align={["left", "left", "right", "right"]}
        rows={byStage.map((r) => [r.stageLabel, r.reasonLabel, r.value, fmtPct(total ? (r.value / total) * 100 : 0)])}
      />
    </div>
  );
}

export function PrefiltroSection({ rows }: { rows: PrefilterAgg[] }) {
  if (!rows.length) return <EmptyState title="Sin respuestas de prefiltro" />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">Preguntas del agente ordenadas por la proporción de candidatos que no cumplen. Sirve para ajustar reglas o el texto de la vacante.</p>
      <SimpleTable
        headers={["Pregunta", "Respondieron", "No cumplen", "% falla"]}
        align={["left", "right", "right", "right"]}
        rows={rows.map((r) => [
          QUESTION_LABELS[r.question_key] ?? r.question_key,
          r.answered,
          r.failed,
          <Pill key={r.question_key} tone={r.pct >= 40 ? "danger" : r.pct >= 20 ? "amber" : "mint"}>
            {r.pct}%
          </Pill>,
        ])}
      />
    </div>
  );
}

const RUN_TONE: Record<ReportRun["status"], Tone> = { sent: "mint", failed: "danger", pending: "amber", rendered: "info" };
const RUN_LABEL: Record<ReportRun["status"], string> = { sent: "Enviado", failed: "Falló", pending: "Pendiente", rendered: "Generado" };

export function CorreosSection({ runs }: { runs: (ReportRun & { client_name: string | null })[] }) {
  return (
    <SimpleTable
      headers={["Correo", "Cliente", "Periodo", "Destinatarios", "Estado", "Enviado"]}
      align={["left", "left", "left", "right", "left", "left"]}
      empty="Todavía no se ha enviado ningún correo"
      rows={runs.map((r) => [
        <div key={r.id}>
          <p className="font-medium">{REPORT_TYPE_LABELS[r.type]}</p>
          {r.subject && <p className="text-xs text-ink-muted">{r.subject}</p>}
          {r.error && <p className="text-xs text-danger">{r.error}</p>}
        </div>,
        r.client_name ?? <span className="text-ink-muted">Interno</span>,
        `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`,
        r.recipients.length,
        <Pill key={`${r.id}-s`} tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Pill>,
        r.sent_at ? timeAgo(r.sent_at) : "—",
      ])}
    />
  );
}

const SEVERITY_TONE: Record<InsightItem["severity"], Tone> = { good: "mint", warning: "amber", info: "info" };
const SEVERITY_LABEL: Record<InsightItem["severity"], string> = { good: "Va bien", warning: "Atención", info: "Dato" };

export function InsightsSection({ insights }: { insights: (AiInsight & { client_name: string | null })[] }) {
  if (!insights.length) return <EmptyState title="Aún no hay inteligencia interna" hint="Se genera cada lunes a las 7:00 con Claude a partir de los reportes." />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {insights.map((ins) => (
        <Card key={ins.id} title={ins.client_name ?? "Global (todas las vacantes)"} subtitle={`Semana del ${fmtDateLong(ins.week_start)}`} padded={false}>
          <ul className="divide-y divide-line">
            {asArray<InsightItem>(ins.items).map((item, i) => (
              <li key={i} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Pill>
                  {item.metric && <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-forest">{item.metric}</span>}
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
