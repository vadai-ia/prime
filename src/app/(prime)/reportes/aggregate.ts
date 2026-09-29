// Agregados puros para las pestañas de Reportes. Reciben filas de las vistas v_bi_* (ya filtradas) y devuelven series planas para las gráficas.
import { CHANNEL_LABELS, DISCARD_REASON_LABELS, PIPELINE_STAGES, STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import type { ChannelRow, DiscardReasonRow, FunnelRow, PrefilterFailureRow, SourceChannel, StageDurationRow } from "@/lib/queries/types";

export type FunnelAgg = { key: Stage; label: string; value: number };
export type ChannelAgg = { key: SourceChannel; label: string; applications: number; prefilter_passed: number; hired: number; discarded: number };
export type DurationAgg = { key: Stage; label: string; hours: number; samples: number };
export type DiscardAgg = { key: string; label: string; value: number };
export type DiscardByStage = { stage: Stage | null; stageLabel: string; reasonLabel: string; value: number };
export type PrefilterAgg = { question_key: string; answered: number; failed: number; pct: number };

export function aggregateFunnel(rows: FunnelRow[]): { stages: FunnelAgg[]; discarded: number } {
  const m = new Map<Stage, number>();
  for (const r of rows) if (r.stage) m.set(r.stage, (m.get(r.stage) ?? 0) + (r.applications ?? 0));
  return {
    stages: PIPELINE_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s], value: m.get(s) ?? 0 })),
    discarded: m.get("discarded") ?? 0,
  };
}

export function aggregateChannels(rows: ChannelRow[]): ChannelAgg[] {
  const m = new Map<SourceChannel, ChannelAgg>();
  for (const r of rows) {
    if (!r.source_channel) continue;
    const cur = m.get(r.source_channel) ?? { key: r.source_channel, label: CHANNEL_LABELS[r.source_channel], applications: 0, prefilter_passed: 0, hired: 0, discarded: 0 };
    cur.applications += r.applications ?? 0;
    cur.prefilter_passed += r.prefilter_passed ?? 0;
    cur.hired += r.hired ?? 0;
    cur.discarded += r.discarded ?? 0;
    m.set(r.source_channel, cur);
  }
  return [...m.values()].sort((a, b) => b.applications - a.applications);
}

/** Mediana ponderada por muestras (aproximación suficiente para el tablero). */
export function aggregateDurations(rows: StageDurationRow[]): DurationAgg[] {
  const m = new Map<Stage, { weighted: number; samples: number }>();
  for (const r of rows) {
    if (!r.stage || !r.samples) continue;
    const cur = m.get(r.stage) ?? { weighted: 0, samples: 0 };
    cur.weighted += (r.median_hours ?? 0) * r.samples;
    cur.samples += r.samples;
    m.set(r.stage, cur);
  }
  return STAGES.filter((s) => m.has(s)).map((s) => {
    const { weighted, samples } = m.get(s)!;
    return { key: s, label: STAGE_LABELS[s], hours: Math.round((weighted / samples) * 10) / 10, samples };
  });
}

export function aggregateDiscards(rows: DiscardReasonRow[]): { byReason: DiscardAgg[]; byStage: DiscardByStage[]; total: number } {
  const byReason = new Map<string, DiscardAgg>();
  const byStage: DiscardByStage[] = [];
  let total = 0;
  for (const r of rows) {
    const key = r.discard_reason_key ?? "other";
    const label = r.discard_reason_key ? DISCARD_REASON_LABELS[r.discard_reason_key] : "Sin motivo";
    const cur = byReason.get(key) ?? { key, label, value: 0 };
    cur.value += r.applications ?? 0;
    byReason.set(key, cur);
    total += r.applications ?? 0;
    byStage.push({ stage: r.discarded_from_stage, stageLabel: r.discarded_from_stage ? STAGE_LABELS[r.discarded_from_stage] : "—", reasonLabel: label, value: r.applications ?? 0 });
  }
  return {
    byReason: [...byReason.values()].sort((a, b) => b.value - a.value),
    byStage: byStage.sort((a, b) => b.value - a.value),
    total,
  };
}

export function aggregatePrefilter(rows: PrefilterFailureRow[]): PrefilterAgg[] {
  const m = new Map<string, PrefilterAgg>();
  for (const r of rows) {
    if (!r.question_key) continue;
    const cur = m.get(r.question_key) ?? { question_key: r.question_key, answered: 0, failed: 0, pct: 0 };
    cur.answered += r.answered ?? 0;
    cur.failed += r.failed ?? 0;
    m.set(r.question_key, cur);
  }
  return [...m.values()]
    .map((x) => ({ ...x, pct: x.answered ? Math.round((x.failed / x.answered) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
}

export const QUESTION_LABELS: Record<string, string> = {
  zone: "Zona / traslado",
  experience: "Experiencia",
  saturdays: "Sábados",
  schedule: "Horario",
  salary: "Expectativa de sueldo",
  age: "Edad",
  software: "Software",
};
