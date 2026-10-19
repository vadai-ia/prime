// Reglas de la evaluación del CV y de la configuración de la vacante. Funciones puras:
// la IA propone (pesos, puntos por criterio) y aquí el código decide qué se guarda.
// Sin imports de valores para que `npm run test:domain` las corra con Node directo.
import type { CvBreakdownItem, CvWeight, PrefilterQuestion, PsychMinimum } from "./json";

export const DEFAULT_CV_THRESHOLD = 70;

export const ANSWER_TYPES = ["text", "months", "yes_no", "money", "number"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

/** Regla de la vacante que evalúa cada pregunta del prefiltro. `other` = sin regla automática, la lee el reclutador. */
export const RULE_KEYS = ["age_range", "commute", "experience_min", "salary_max", "requires_saturdays", "schedule", "education_min", "systems", "other"] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

/** Clave estable en snake_case a partir de una etiqueta ("Experiencia en cobranza" → "experiencia_en_cobranza"). */
export function slugKey(text: string, fallback: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
  used.add(key);
  return key;
}

export function weightsTotal(weights: { weight: number }[]): number {
  return weights.reduce((s, w) => s + w.weight, 0);
}

/**
 * Deja los pesos como enteros que suman exactamente 100 (reparto por mayor residuo),
 * sin criterios vacíos ni claves repetidas. Si no queda ningún criterio válido devuelve [].
 */
export function normalizeWeights(raw: { key?: string; label: string; weight: number; hint?: string }[]): CvWeight[] {
  const valid = raw
    .map((w) => ({ ...w, label: w.label.trim(), hint: w.hint?.trim() || undefined }))
    .filter((w) => w.label && Number.isFinite(w.weight) && w.weight > 0);
  const total = weightsTotal(valid);
  if (total <= 0) return [];

  const exact = valid.map((w) => (w.weight * 100) / total);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((s, n) => s + n, 0);
  const byFraction = exact.map((n, i) => ({ i, frac: n - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }

  const used = new Set<string>();
  return valid
    .map((w, i) => ({
      key: uniqueKey(slugKey(w.key ?? w.label, `criterio_${i + 1}`), used),
      label: w.label,
      weight: floors[i],
      ...(w.hint ? { hint: w.hint } : {}),
    }))
    .filter((w) => w.weight > 0);
}

export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CV_THRESHOLD;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Preguntas del prefiltro numeradas desde 1, con clave única y tipo de respuesta y regla conocidos. */
export function normalizeQuestions(raw: { key?: string; text: string; rule_key: string; answer_type: string }[]): PrefilterQuestion[] {
  const used = new Set<string>();
  return raw
    .map((q) => ({ ...q, text: q.text.trim() }))
    .filter((q) => q.text)
    .map((q, i) => ({
      order: i + 1,
      key: uniqueKey(slugKey(q.key ?? q.text, `pregunta_${i + 1}`), used),
      text: q.text,
      rule_key: (RULE_KEYS as readonly string[]).includes(q.rule_key) ? q.rule_key : "other",
      answer_type: (ANSWER_TYPES as readonly string[]).includes(q.answer_type) ? q.answer_type : "text",
    }));
}

/** Mínimos psicométricos entre 0 y 100, una fila por escala. */
export function normalizePsychMinimums(raw: { scale: string; min: number }[]): PsychMinimum[] {
  const seen = new Set<string>();
  const out: PsychMinimum[] = [];
  for (const m of raw) {
    const scale = m.scale.trim();
    if (!scale || !Number.isFinite(m.min) || seen.has(scale.toLowerCase())) continue;
    seen.add(scale.toLowerCase());
    out.push({ scale, min: Math.min(100, Math.max(0, Math.round(m.min))) });
  }
  return out;
}

/** Lo que devuelve la IA por criterio. `points` va de 0 al peso del criterio. */
export type CvCriterionScore = { key: string; points: number; evidence: string; note: string };

/**
 * Score del CV: por cada peso de la vacante toma los puntos de la IA (acotados a 0..peso y redondeados)
 * y los suma. Un criterio que la IA no devolvió vale 0 y queda en `missing`; los que no existen en la
 * vacante se ignoran. Nada aquí descarta: comparar contra el umbral es cosa de quien lo muestra.
 */
export function buildCvScore(weights: CvWeight[], criteria: CvCriterionScore[]): { score: number; breakdown: CvBreakdownItem[]; missing: string[] } {
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  const missing: string[] = [];
  const breakdown = weights.map((w): CvBreakdownItem => {
    const c = byKey.get(w.key);
    if (!c) {
      missing.push(w.label);
      return { key: w.key, label: w.label, weight: w.weight, score: 0, note: "La IA no evaluó este criterio." };
    }
    const points = Number.isFinite(c.points) ? Math.min(w.weight, Math.max(0, Math.round(c.points))) : 0;
    return {
      key: w.key,
      label: w.label,
      weight: w.weight,
      score: points,
      ...(c.note.trim() ? { note: c.note.trim() } : {}),
      ...(c.evidence.trim() ? { evidence: c.evidence.trim() } : {}),
    };
  });
  const score = Math.min(100, Math.max(0, breakdown.reduce((s, b) => s + b.score, 0)));
  return { score, breakdown, missing };
}
