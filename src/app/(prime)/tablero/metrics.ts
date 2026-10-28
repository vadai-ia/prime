// Métricas puras del Tablero. Reciben filas de v_pipeline y entrevistas ya filtradas por RLS
// (y por reclutador, si un admin lo eligió) y devuelven números y series planas para la vista.
// Dos tipos de número: lo que hay ahora (en prefiltro, expedientes, estancados) y lo que pasó en el
// periodo elegido (postulaciones, entrevistas realizadas, contrataciones, indicadores, conversión).
import { PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import type { InterviewRow, PipelineRow } from "@/lib/queries/types";
import type { TrendPoint, TrendUnit } from "@/components/charts/trend-chart";
import { DONE_INTERVIEW, STAGE_ORDER, dayIndex, isActive, isStale, median, reachedOrder } from "@/lib/metrics";
import { fmtDay, monthOf, monthShort, monthStart, rangeDays, type DayRange } from "@/lib/date-range";

export { IN_PROCESS, STALE_DAYS, dayIndex } from "@/lib/metrics";

const inRange = (iso: string | null, r: { from: number; to: number }) => {
  if (!iso) return false;
  const d = dayIndex(iso);
  return d >= r.from && d <= r.to;
};

/** Postulaciones recibidas en el periodo: la base de conversión e indicadores. */
export const appliedIn = (rows: PipelineRow[], r: DayRange) => rows.filter((row) => inRange(row.applied_at, r));

export type Snapshot = {
  inPrefilter: number;
  psychPending: number;
  docsInProgress: number;
  docsMissing: number;
  active: number;
};

/** Lo que hay ahora, sin importar el periodo. */
export function snapshot(rows: PipelineRow[]): Snapshot {
  const inDocs = rows.filter((r) => r.stage === "documents");
  return {
    inPrefilter: rows.filter((r) => r.stage === "prefilter").length,
    psychPending: rows.filter((r) => r.stage === "psychometric" && (r.psych_status === "pending" || r.psych_status === "sent")).length,
    docsInProgress: inDocs.length,
    docsMissing: inDocs.reduce((s, r) => s + Math.max(0, (r.docs_required ?? 0) - (r.docs_validated ?? 0)), 0),
    active: rows.filter(isActive).length,
  };
}

export type PeriodTotals = { applications: number; interviews: number; hired: number };

/** Postulaciones recibidas, entrevistas realizadas y contrataciones dentro del periodo. */
export function periodTotals(rows: PipelineRow[], interviews: InterviewRow[], r: { from: number; to: number }): PeriodTotals {
  return {
    applications: rows.filter((row) => inRange(row.applied_at, r)).length,
    interviews: interviews.filter((i) => DONE_INTERVIEW.has(i.status) && inRange(i.scheduled_at, r)).length,
    hired: rows.filter((row) => row.stage === "hired" && inRange(row.hired_at, r)).length,
  };
}

export type Indicators = {
  /** Mediana de días de postulación a contratación de quienes se contrataron en el periodo. */
  daysToHire: number | null;
  hiresInWindow: number;
  /** Porcentaje de las postulaciones del periodo que ya llegaron a contratado. */
  hireRate: number | null;
  applicationsInWindow: number;
  stale: number;
};

export function indicators(rows: PipelineRow[], r: DayRange): Indicators {
  const hires = rows.filter((row) => row.stage === "hired" && row.applied_at && inRange(row.hired_at, r));
  const recent = appliedIn(rows, r);
  const recentHired = recent.filter((row) => row.stage === "hired").length;
  return {
    daysToHire: median(hires.map((row) => dayIndex(row.hired_at!) - dayIndex(row.applied_at!))),
    hiresInWindow: hires.length,
    hireRate: recent.length ? (recentHired / recent.length) * 100 : null,
    applicationsInWindow: recent.length,
    stale: rows.filter((row) => isActive(row) && isStale(row)).length,
  };
}

/** Por día hasta un mes, por semana hasta seis meses y por mes arriba de eso. */
export function trendUnit(r: DayRange): TrendUnit {
  const n = rangeDays(r);
  return n <= 31 ? "day" : n <= 183 ? "week" : "month";
}

type Bucket = { from: number; to: number; label: string };

function buckets(r: DayRange, unit: TrendUnit): Bucket[] {
  if (unit === "day") return Array.from({ length: rangeDays(r) }, (_, i) => ({ from: r.from + i, to: r.from + i, label: fmtDay(r.from + i, false) }));
  if (unit === "week") {
    // Semanas que terminan el último día del rango; la primera puede quedar corta.
    const out: Bucket[] = [];
    for (let end = r.to; end >= r.from; end -= 7) {
      const start = Math.max(r.from, end - 6);
      out.unshift({ from: start, to: end, label: fmtDay(start, false) });
    }
    return out;
  }
  const out: Bucket[] = [];
  for (let m = monthOf(r.from); m <= monthOf(r.to); m++) {
    out.push({ from: Math.max(r.from, monthStart(m)), to: Math.min(r.to, monthStart(m + 1) - 1), label: monthShort(m) });
  }
  return out;
}

/** Serie del periodo: postulaciones, entrevistas realizadas y contrataciones por día, semana o mes. */
export function trend(rows: PipelineRow[], interviews: InterviewRow[], r: DayRange): TrendPoint[] {
  const bs = buckets(r, trendUnit(r));
  const points: TrendPoint[] = bs.map((b) => ({ label: b.label, applications: 0, interviews: 0, hired: 0 }));
  const at = (iso: string | null) => {
    if (!iso) return -1;
    const d = dayIndex(iso);
    return bs.findIndex((b) => d >= b.from && d <= b.to);
  };
  for (const row of rows) {
    const a = at(row.applied_at);
    if (a >= 0) points[a].applications += 1;
    const h = row.stage === "hired" ? at(row.hired_at) : -1;
    if (h >= 0) points[h].hired += 1;
  }
  for (const i of interviews) {
    const b = DONE_INTERVIEW.has(i.status) ? at(i.scheduled_at) : -1;
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

export type RecruiterLoad = { id: string | null; name: string; inProcess: number; stale: number; hired: number };

/**
 * Carga por reclutador (solo admin): candidatos en proceso y estancados hoy, y contrataciones del
 * periodo, de las vacantes que trabaja cada uno (0029: la vacante es la unidad, no el candidato).
 * Dos reclutadores de la misma vacante cuentan los mismos candidatos. id null = vacantes sin reclutador.
 */
export function recruiterLoad(rows: PipelineRow[], r: DayRange, team: { id: string; name: string; profiles: Set<string> }[]): RecruiterLoad[] {
  const covered = new Set(team.flatMap((t) => [...t.profiles]));
  const groups = [...team, { id: null, name: "Vacantes sin reclutador", profiles: null }];
  return groups
    .map((g) => {
      const mine = rows.filter((row) => (g.profiles ? g.profiles.has(row.profile_id ?? "") : !covered.has(row.profile_id ?? "")));
      const active = mine.filter(isActive);
      return {
        id: g.id,
        name: g.name,
        inProcess: active.length,
        stale: active.filter(isStale).length,
        hired: mine.filter((row) => row.stage === "hired" && inRange(row.hired_at, r)).length,
      };
    })
    .filter((l) => l.inProcess || l.hired)
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.inProcess - a.inProcess));
}

/** Estancados, del que más días lleva al que menos. */
export function staleRows(rows: PipelineRow[]): PipelineRow[] {
  return rows.filter((r) => isActive(r) && isStale(r)).sort((a, b) => (b.days_in_stage ?? 0) - (a.days_in_stage ?? 0));
}
