// Formas de las columnas jsonb. Son `type` (no interface) para que sean
// asignables a Json. `asJson` lee con valor por defecto sin lanzar.
import type { Json } from "@/lib/db/types";

export type ProfileSpecs = { age?: string; sex?: string; marital_status?: string; children?: string; residence?: string };
export type ProfileRequirements = { education?: string; experience?: string; knowledge?: string[]; languages?: string; systems?: string[] };
export type ProfileConditions = {
  salary?: string;
  benefits?: string[];
  schedule?: string;
  modality?: string;
  travel?: string;
  staff_in_charge?: string;
  tools?: string[];
};
export type ProfileRelation = { with: string; purpose: string };
export type CompetencyLevel = { name: string; level: string };
export type ProfileCompetencies = { functional?: CompetencyLevel[]; leadership?: CompetencyLevel[]; labor?: string[] };

// `hint`: qué cuenta para el criterio; lo escribe la generación de la evaluación y lo usa la IA al calificar.
export type CvWeight = { key: string; label: string; weight: number; hint?: string };
export type CvBreakdownItem = { key: string; label: string; weight: number; score: number; note?: string; evidence?: string };
export type PrefilterQuestion = { order: number; key: string; text: string; rule_key: string; answer_type: string };
export type PrefilterResultItem = { criterion: string; answer: string; ok: boolean; required: boolean };
export type PsychMinimum = { scale: string; min: number };
export type PsychFitRow = { scale: string; min: number; score: number; ok: boolean; blocking: boolean };
export type PsychParsed = {
  iq?: number;
  iq_level?: string;
  coleibor?: { scale: string; score: number }[];
  cibain_high?: string[];
  cibain_low?: string[];
  inceval?: { trust: number; honesty: number; ethics: number };
  cacter?: string;
  ciesman_low?: string[];
};
export type InterviewFinding = { criterion: string; ok: boolean; evidence: string; quote?: string; at?: string };
export type DocAiCheck = { legible: boolean; name_matches: boolean; extracted?: Record<string, string>; issues?: string[] };
export type InsightItem = { title: string; detail: string; metric?: string; severity: "good" | "warning" | "info" };
export type WaFlowState = { question_index?: number; awaiting?: string; retries?: number };
export type WaTemplateVariable = { position: number; key: string; example?: string };

export type IntakeForm = {
  company?: { name?: string; industry?: string; city?: string; contact_name?: string; contact_title?: string; contact_email?: string; contact_phone?: string };
  position?: { title?: string; unit?: string; reports_to?: string; openings?: number; work_zone?: string; objective?: string };
  specs?: ProfileSpecs;
  requirements?: ProfileRequirements;
  activities?: string[];
  conditions?: ProfileConditions;
  competencies?: ProfileCompetencies;
  notes?: string;
};

export function asJson<T>(value: Json | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as unknown as T;
}

export function asArray<T>(value: Json | null | undefined): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}
