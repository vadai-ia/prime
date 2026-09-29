// Métricas puras del Tablero. Reciben filas de v_pipeline y entrevistas ya filtradas por RLS
// (y por reclutador, si un admin lo eligió) y devuelven números y series planas para la vista.
import { PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import type { InterviewRow, PipelineRow } from "@/lib/queries/types";
import type { TrendPoint } from "@/components/charts/trend-chart";
import { DONE_INTERVIEW, STAGE_ORDER, dayIndex, dayToIso, isActive, isStale, median, reachedOrder } from "@/lib/metrics";

export { IN_PROCESS, STALE_DAYS, dayIndex } from "@/lib/metrics";

const TREND_WEEKS = 8;
const WINDOW_DAYS = 90;

export type Kpis = {
  newToday: number;
  inPrefilter: number;
  interviewsToday: number;
  psychPending: number;
  docsInProgress: number;
  docsMissing: number;
  hiredThisWeek: number;
  active: number;
};

export function kpis(rows: PipelineRow[], interviews: InterviewRow[], now: Date): Kpis {
  const today = dayIndex(now);
  const inDocs = rows.filter((r) => r.stage === "documents");
  return {
    newToday: rows.filter((r) => r.applied_at && dayIndex(r.applied_at) === today).length,
    inPrefilter: rows.filter((r) => r.stage === "prefilter").length,
    interviewsToday: interviews.filter((i) => i.status !== "cancelled" && i.scheduled_at && dayIndex(i.scheduled_at) === today).length,
    psychPending: rows.filter((r) => r.stage === "psychometric" && (r.psych_status === "pending" || r.psych_status === "sent")).length,
    docsInProgress: inDocs.length,
    docsMissing: inDocs.reduce((s, r) => s + Math.max(0, (r.docs_required ?? 0) - (r.docs_validated ?? 0)), 0),
    hiredThisWeek: rows.filter((r) => r.stage === "hired" && r.hired_at && today - dayIndex(r.hired_at) < 7).length,
    active: rows.filter(isActive).length,
  };
}

export type Indicators = {
  /** Mediana de días de postulación a contratación, contratados en los últimos 90 días. */
  daysToHire: number | null;
  hiresInWindow: number;
  /** Porcentaje de postulaciones de los últimos 90 días que ya llegaron a contratado. */
  hireRate: number | null;
  applicationsInWindow: number;
  stale: number;
};

export function indicators(rows: PipelineRow[], now: Date): Indicators {
  const today = dayIndex(now);
  const hires = rows.filter((r) => r.stage === "hired" && r.hired_at && r.applied_at && today - dayIndex(r.hired_at) < WINDOW_DAYS);
  const recent = rows.filter((r) => r.applied_at && today - dayIndex(r.applied_at) < WINDOW_DAYS);
  const recentHired = recent.filter((r) => r.stage === "hired").length;
  return {
    daysToHire: median(hires.map((r) => dayIndex(r.hired_at!) - dayIndex(r.applied_at!))),
    hiresInWindow: hires.length,
    hireRate: recent.length ? (recentHired / recent.length) * 100 : null,
    applicationsInWindow: recent.length,
    stale: rows.filter((r) => isActive(r) && isStale(r)).length,
  };
}

/** Últimas 8 semanas móviles (la última termina hoy): postulaciones, entrevistas realizadas y contrataciones. */
export function weeklyTrend(rows: PipelineRow[], interviews: InterviewRow[], now: Date): TrendPoint[] {
  const today = dayIndex(now);
  const points: TrendPoint[] = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const start = today - 7 * (TREND_WEEKS - 1 - i) - 6;
    const label = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(dayToIso(start)));
    return { label, applications: 0, interviews: 0, hired: 0 };
  });
  const bucket = (iso: string | null) => {
    if (!iso) return -1;
    const weeksAgo = Math.floor((today - dayIndex(iso)) / 7);
    return weeksAgo >= 0 && weeksAgo < TREND_WEEKS ? TREND_WEEKS - 1 - weeksAgo : -1;
  };
  for (const r of rows) {
    const a = bucket(r.applied_at);
    if (a >= 0) points[a].applications += 1;
    const h = r.stage === "hired" ? bucket(r.hired_at) : -1;
    if (h >= 0) points[h].hired += 1;
  }
  for (const i of interviews) {
    const b = DONE_INTERVIEW.has(i.status) ? bucket(i.scheduled_at) : -1;
    if (b >= 0) points[b].interviews += 1;
  }
  return points;
}

export type ConversionStep = { key: Stage; label: string; reached: number; fromPrev: number | null; fromStart: number | null };

/** Cuántas postulaciones llegaron a cada etapa y qué porcentaje pasó desde la anterior. */
export function stageConversion(rows: PipelineRow[]): ConversionStep[] {
  const reached = rows.map(reachedOrder);
  const steps: ConversionStep[] = [];
  for (const s of PIPELINE_STAGES) {
    const order = STAGE_ORDER.get(s)!;
    const n = reached.filter((o) => o >= order).length;
    const prev = steps.at(-1);
    const first = steps[0];
    steps.push({
      key: s,
      label: STAGE_LABELS[s],
      reached: n,
      fromPrev: prev ? (prev.reached ? (n / prev.reached) * 100 : null) : null,
      fromStart: first ? (first.reached ? (n / first.reached) * 100 : null) : null,
    });
  }
  return steps;
}

export type RecruiterLoad = { id: string | null; name: string; inProcess: number; stale: number; hired30: number };

/** Carga por reclutador (solo admin): candidatos en proceso, estancados y contrataciones de los últimos 30 días. */
export function recruiterLoad(rows: PipelineRow[], now: Date): RecruiterLoad[] {
  const today = dayIndex(now);
  const m = new Map<string, RecruiterLoad>();
  for (const r of rows) {
    const key = r.assigned_recruiter_id ?? "none";
    const cur = m.get(key) ?? { id: r.assigned_recruiter_id, name: r.assigned_recruiter_name ?? "Sin asignar", inProcess: 0, stale: 0, hired30: 0 };
    if (isActive(r)) {
      cur.inProcess += 1;
      if (isStale(r)) cur.stale += 1;
    }
    if (r.stage === "hired" && r.hired_at && today - dayIndex(r.hired_at) < 30) cur.hired30 += 1;
    m.set(key, cur);
  }
  return [...m.values()].filter((l) => l.inProcess || l.hired30).sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.inProcess - a.inProcess));
}

/** Estancados, del que más días lleva al que menos. */
export function staleRows(rows: PipelineRow[]): PipelineRow[] {
  return rows.filter((r) => isActive(r) && isStale(r)).sort((a, b) => (b.days_in_stage ?? 0) - (a.days_in_stage ?? 0));
}
