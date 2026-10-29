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

// Datos de contacto del CV para la carga masiva. Vacío = el CV no lo dice; el código normaliza teléfono y fechas.
export const CvExtractOutput = z.object({
  full_name: z.string(),
  phone: z.string(),
  email: z.string(),
  municipality: z.string(),
  education_level: z.string(),
  birth_date: z.string(),
  age: z.number().nullable(),
  is_cv: z.boolean(),
});
export type CvExtractOutput = z.infer<typeof CvExtractOutput>;

// Levantamiento a partir del descriptivo de puesto (PDF o Word). Vacío = el documento no lo dice.
const leveled = z.array(z.object({ name: z.string(), level: z.string() }));
export const IntakeExtractOutput = z.object({
  position: z.object({ title: z.string(), unit: z.string(), reports_to: z.string(), openings: z.number().nullable(), work_zone: z.string(), objective: z.string() }),
  specs: z.object({ age: z.string(), sex: z.string(), marital_status: z.string(), children: z.string(), residence: z.string() }),
  requirements: z.object({ education: z.string(), experience: z.string(), knowledge: z.array(z.string()), languages: z.string(), systems: z.array(z.string()) }),
  activities: z.array(z.string()),
  conditions: z.object({
    salary: z.string(),
    benefits: z.array(z.string()),
    schedule: z.string(),
    modality: z.string(),
    travel: z.string(),
    staff_in_charge: z.string(),
    tools: z.array(z.string()),
  }),
  competencies: z.object({ functional: leveled, leadership: leveled, labor: z.array(z.string()) }),
  notes: z.string(),
  is_job_description: z.boolean(),
});
export type IntakeExtractOutput = z.infer<typeof IntakeExtractOutput>;
