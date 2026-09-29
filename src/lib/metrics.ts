// Piezas comunes de métricas: días calendario en la zona de la app, etapas en proceso y estancados.
// Las usan el Tablero y los correos; sin imports de servidor.
import { STAGES, type Stage } from "@/lib/labels";
import type { PipelineRow, StageCounts } from "@/lib/queries/types";

const TZ = process.env.APP_TIMEZONE ?? "America/Mexico_City";
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const IN_PROCESS: Stage[] = ["new", "prefilter", "cv_review", "prime_interview", "psychometric", "documents", "client_interview"];

/** Días en una etapa a partir de los cuales un candidato cuenta como estancado. */
export const STALE_DAYS: Partial<Record<Stage, number>> = {
  new: 2,
  prefilter: 3,
  cv_review: 3,
  prime_interview: 5,
  psychometric: 4,
  documents: 7,
  client_interview: 7,
};

/** Estados de una entrevista que ya se hizo. */
export const DONE_INTERVIEW = new Set(["completed", "recorded", "transcribed", "analyzed"]);

/** Día calendario en la zona de la app, como entero (días desde 1970). Compara fechas sin líos de hora. */
export function dayIndex(iso: string | Date): number {
  const [y, m, d] = DAY_KEY.format(typeof iso === "string" ? new Date(iso) : iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
}

/** Mediodía UTC del día: cae en el mismo día calendario en México, sirve para formatear etiquetas. */
export const dayToIso = (idx: number) => new Date(idx * 864e5 + 12 * 36e5).toISOString();

export const isActive = (r: PipelineRow) => !!r.stage && IN_PROCESS.includes(r.stage);

export function isStale(r: PipelineRow): boolean {
  const limit = r.stage ? STALE_DAYS[r.stage] : undefined;
  return limit !== undefined && (r.days_in_stage ?? 0) >= limit;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}


export const STAGE_ORDER = new Map(STAGES.map((s, i) => [s, i]));

/** Hasta qué etapa llegó cada postulación: la actual, o de la que salió si la descartaron. */
export function reachedOrder(r: PipelineRow): number {
  const s = r.stage === "discarded" ? r.discarded_from_stage : r.stage;
  return s ? (STAGE_ORDER.get(s) ?? -1) : -1;
}

export function countStages(rows: PipelineRow[]): StageCounts {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as StageCounts;
  for (const r of rows) if (r.stage) counts[r.stage] += 1;
  return counts;
}
