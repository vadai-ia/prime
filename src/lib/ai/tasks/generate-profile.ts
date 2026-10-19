import "server-only";
import type { Tables, TablesInsert } from "@/lib/db/types";
import { clampThreshold, normalizePsychMinimums, normalizeQuestions, normalizeWeights } from "@/lib/domain/scoring";
import { runAi, type AiResult } from "../run";
import { ProfileConfigOutput } from "../schemas";
import { PROMPT_VERSION, SYSTEM } from "../prompts/profile-generation";

type ProfileForAi = Pick<
  Tables<"job_profiles">,
  "id" | "title" | "openings" | "unit" | "work_zone" | "objective" | "reports_to" | "specs" | "requirements" | "activities" | "conditions" | "competencies" | "relations"
> & { client: { name: string; industry: string | null } | null };

export type GeneratedConfig = {
  config: Omit<TablesInsert<"job_profile_ai_configs">, "profile_id" | "version">;
  assumptions: string[];
};

const intOrNull = (n: number | null) => (n === null || !Number.isFinite(n) || n < 0 ? null : Math.round(n));
const textOrNull = (s: string | null) => s?.trim() || null;

/**
 * Del descriptivo de la vacante a su configuración de evaluación (pesos y umbral del CV, reglas y
 * preguntas del prefiltro, mínimos psicométricos). Claude propone; aquí se normaliza: pesos que
 * suman 100, edad siempre como alerta (plan §0.7), rangos válidos.
 */
export async function generateProfileConfig(profile: ProfileForAi): Promise<AiResult<GeneratedConfig>> {
  const descriptivo = {
    puesto: profile.title,
    cliente: profile.client?.name ?? null,
    giro: profile.client?.industry ?? null,
    plazas: profile.openings,
    area: profile.unit,
    reporta_a: profile.reports_to,
    zona_de_trabajo: profile.work_zone,
    objetivo: profile.objective,
    especificaciones: profile.specs,
    requisitos: profile.requirements,
    actividades: profile.activities,
    condiciones: profile.conditions,
    competencias: profile.competencies,
    relaciones: profile.relations,
  };

  const result = await runAi(
    { kind: "profile_generation", promptVersion: PROMPT_VERSION, effort: "high", system: SYSTEM, schema: ProfileConfigOutput },
    {
      entity: { type: "job_profile", id: profile.id },
      content: [{ type: "text", text: `Descriptivo de la vacante:\n\n${JSON.stringify(descriptivo, null, 2)}` }],
    },
  );
  if (!result.ok) return result;

  const out = result.output;
  const weights = normalizeWeights(out.cv_criteria);
  if (weights.length === 0) {
    return { ok: false, runId: result.runId, error: "La IA no propuso criterios para el CV. Completa requisitos y actividades del descriptivo e intenta de nuevo." };
  }
  let ageMin = intOrNull(out.rules.age_min);
  let ageMax = intOrNull(out.rules.age_max);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];

  return {
    ok: true,
    runId: result.runId,
    output: {
      config: {
        cv_weights: weights,
        cv_threshold: clampThreshold(out.cv_threshold),
        age_min: ageMin,
        age_max: ageMax,
        age_is_blocking: false,
        commute_max_min: intOrNull(out.rules.commute_max_min),
        experience_min_months: intOrNull(out.rules.experience_min_months),
        salary_expectation_max: out.rules.salary_expectation_max !== null && out.rules.salary_expectation_max > 0 ? out.rules.salary_expectation_max : null,
        schedule_text: textOrNull(out.rules.schedule_text),
        requires_saturdays: out.rules.requires_saturdays,
        education_min: textOrNull(out.rules.education_min),
        prefilter_questions: normalizeQuestions(out.prefilter_questions),
        psych_minimums: normalizePsychMinimums(out.psych_minimums),
        psych_blocking: normalizePsychMinimums(out.psych_blocking).slice(0, 1),
        generated_by_ai: true,
        generated_at: new Date().toISOString(),
        prompt_version: PROMPT_VERSION,
      },
      assumptions: out.assumptions.map((a) => a.trim()).filter(Boolean),
    },
  };
}
