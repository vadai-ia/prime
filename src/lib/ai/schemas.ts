// Esquemas de salida de cada tarea de IA. Van sin rangos numéricos ni enums (el SDK los manda como
// texto libre y un valor fuera de lista tumbaría toda la respuesta): Claude devuelve la forma y
// `lib/domain/scoring.ts` acota y normaliza (el código decide). Los valores válidos van en el prompt.
import { z } from "zod";

const scaleMin = z.object({ scale: z.string(), min: z.number() });

export const ProfileConfigOutput = z.object({
  cv_criteria: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number(), hint: z.string() })),
  cv_threshold: z.number(),
  rules: z.object({
    age_min: z.number().nullable(),
    age_max: z.number().nullable(),
    commute_max_min: z.number().nullable(),
    experience_min_months: z.number().nullable(),
    salary_expectation_max: z.number().nullable(),
    schedule_text: z.string().nullable(),
    requires_saturdays: z.boolean(),
    education_min: z.string().nullable(),
  }),
  prefilter_questions: z.array(z.object({ key: z.string(), text: z.string(), rule_key: z.string(), answer_type: z.string() })),
  psych_minimums: z.array(scaleMin),
  psych_blocking: z.array(scaleMin),
  assumptions: z.array(z.string()),
});
export type ProfileConfigOutput = z.infer<typeof ProfileConfigOutput>;

export const CvScoreOutput = z.object({
  criteria: z.array(z.object({ key: z.string(), points: z.number(), evidence: z.string(), note: z.string() })),
  summary: z.string(),
  flags: z.array(z.string()),
});
export type CvScoreOutput = z.infer<typeof CvScoreOutput>;
