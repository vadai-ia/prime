"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE, MOCK_PIPELINE, MOCK_WRITE_ERROR } from "@/lib/mock";
import { aiEnabled } from "@/lib/ai/client";
import { generateProfileConfig } from "@/lib/ai/tasks/generate-profile";
import { scoreApplicationCv } from "@/lib/ai/tasks/score-cv";
import { clampThreshold, normalizePsychMinimums, normalizeQuestions, normalizeWeights, weightsTotal } from "@/lib/domain/scoring";
import type { TablesInsert } from "@/lib/db/types";
import { logProfileEdit, type ProfileEditSection } from "@/lib/audit";

export type AiActionState = { ok?: boolean; error?: string; message?: string; notes?: string[] } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ConfigPatch = Omit<TablesInsert<"job_profile_ai_configs">, "profile_id" | "version">;

const NO_AI = "La IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.";

async function staffOrError(): Promise<string | null> {
  try {
    await assertStaff();
    return null;
  } catch (e) {
    return e instanceof UnauthorizedError ? e.message : "No autorizado";
  }
}

type ConfigSection = Exclude<ProfileEditSection, "description">;

/**
 * Escribe la configuración de evaluación de la vacante con la sesión del usuario (admin o reclutador
 * asignado: lo decide RLS) y sube la versión. Solo un cambio de pesos (`generated` o `cv_weights`)
 * mueve `cv_version`, que es con lo que la ficha decide si un CV calificado antes hay que recalificarlo.
 */
async function saveConfig(supabase: Supabase, profileId: string, section: ConfigSection, patch: ConfigPatch): Promise<{ version: number } | { error: string }> {
  const { data: current, error: findError } = await supabase.from("job_profile_ai_configs").select("version").eq("profile_id", profileId).maybeSingle();
  if (findError) return { error: findError.message };

  const version = (current?.version ?? 0) + 1;
  const cvChanged = !current || section === "generated" || section === "cv_weights";
  const row = { ...patch, version, ...(cvChanged ? { cv_version: version } : {}) };
  const { error } = current
    ? await supabase.from("job_profile_ai_configs").update(row).eq("profile_id", profileId)
    : await supabase.from("job_profile_ai_configs").insert({ ...row, profile_id: profileId });
  if (error) return { error: error.code === "42501" ? "No tienes asignada esta vacante." : error.message };
  await logProfileEdit(supabase, profileId, { section, version });
  return { version };
}

const profileIdSchema = z.string().uuid("Vacante no válida");

/** Botón "Generar con IA" de la pestaña Evaluación IA: propone pesos, umbral, reglas, preguntas y mínimos. */
export async function generateEvaluation(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };
  if (!aiEnabled()) return { error: NO_AI };

  const profileId = profileIdSchema.safeParse(formData.get("profile_id"));
  if (!profileId.success) return { error: "Vacante no válida" };

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("job_profiles")
    .select("id, title, openings, unit, work_zone, objective, reports_to, specs, requirements, activities, conditions, competencies, relations, clients(name, industry)")
    .eq("id", profileId.data)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!profile) return { error: "Vacante no encontrada o no la tienes asignada" };

  const { clients, ...rest } = profile;
  const result = await generateProfileConfig({ ...rest, client: clients });
  if (!result.ok) return { error: result.error };

  const saved = await saveConfig(supabase, profileId.data, "generated", result.output.config);
  if ("error" in saved) return { error: saved.error };

  revalidatePath(`/perfiles/${profileId.data}`);
  return {
    ok: true,
    message: `Evaluación generada (v${saved.version}). Revísala y ajusta lo que haga falta.`,
    notes: result.output.assumptions,
  };
}

const weightsSchema = z.object({
  profile_id: profileIdSchema,
  cv_threshold: z.coerce.number().int("El umbral debe ser un número entero").min(0).max(100, "El umbral va de 0 a 100"),
});

/** Edición a mano de los pesos del CV y del umbral. Los pesos deben sumar exactamente 100. */
export async function saveCvWeights(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const parsed = weightsSchema.safeParse({ profile_id: formData.get("profile_id"), cv_threshold: formData.get("cv_threshold") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const keys = formData.getAll("key").map(String);
  const labels = formData.getAll("label").map(String);
  const hints = formData.getAll("hint").map(String);
  const raw = formData.getAll("weight").map((w, i) => ({ key: keys[i] || undefined, label: labels[i] ?? "", hint: hints[i] ?? "", weight: Number(w) }));
  const rows = raw.filter((r) => r.label.trim() || r.weight);

  if (rows.length === 0) return { error: "Agrega al menos un criterio." };
  if (rows.some((r) => !r.label.trim())) return { error: "Cada criterio necesita un nombre." };
  if (rows.some((r) => !Number.isInteger(r.weight) || r.weight < 1)) return { error: "Los pesos son números enteros de 1 en adelante." };
  const total = weightsTotal(rows);
  if (total !== 100) return { error: `Los pesos suman ${total}; deben sumar 100.` };

  const supabase = await createClient();
  const saved = await saveConfig(supabase, parsed.data.profile_id, "cv_weights", {
    cv_weights: normalizeWeights(rows),
    cv_threshold: clampThreshold(parsed.data.cv_threshold),
    generated_by_ai: false,
  });
  if ("error" in saved) return { error: saved.error };

  revalidatePath(`/perfiles/${parsed.data.profile_id}`);
  return { ok: true, message: `Pesos guardados (v${saved.version}). Los CV calificados antes se pueden recalificar desde su ficha.` };
}

/** Botón "Calificar CV" / "Recalificar" de la ficha del candidato. */
export async function scoreCv(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_PIPELINE) return { error: MOCK_WRITE_ERROR };
  if (!aiEnabled()) return { error: NO_AI };

  const applicationId = z.string().uuid().safeParse(formData.get("application_id"));
  if (!applicationId.success) return { error: "Postulación no válida" };

  const supabase = await createClient();
  const result = await scoreApplicationCv(supabase, applicationId.data);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/candidatos/${applicationId.data}`);
  revalidatePath("/candidatos");
  return { ok: true, message: `CV calificado: ${result.score} de 100.` };
}

/** Número entero opcional de un campo del formulario: vacío = sin regla. */
function optionalInt(formData: FormData, name: string, label: string, min: number, max: number): number | null | { error: string } {
  const raw = String(formData.get(name) ?? "").trim().replace(/[$,\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${label}: escribe un número entero de ${min} a ${max}, o déjalo vacío.` };
  return n;
}

const isError = (v: unknown): v is { error: string } => typeof v === "object" && v !== null && "error" in v;

/**
 * Reglas del prefiltro a mano. La edad siempre es alerta (plan §0.7): aquí no se puede volver bloqueo.
 * El sueldo máximo puede ser bloqueo o solo alerta (`salary_is_blocking`, migración 0026).
 */
export async function savePrefilterRules(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const profileId = profileIdSchema.safeParse(formData.get("profile_id"));
  if (!profileId.success) return { error: "Vacante no válida" };

  const ageMin = optionalInt(formData, "age_min", "Edad mínima", 14, 99);
  const ageMax = optionalInt(formData, "age_max", "Edad máxima", 14, 99);
  const commute = optionalInt(formData, "commute_max_min", "Traslado máximo", 1, 600);
  const experience = optionalInt(formData, "experience_min_months", "Experiencia mínima", 0, 600);
  const salary = optionalInt(formData, "salary_expectation_max", "Sueldo máximo", 1, 10_000_000);
  if (isError(ageMin)) return ageMin;
  if (isError(ageMax)) return ageMax;
  if (isError(commute)) return commute;
  if (isError(experience)) return experience;
  if (isError(salary)) return salary;
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) return { error: "La edad mínima no puede ser mayor que la máxima." };

  const text = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const supabase = await createClient();
  const saved = await saveConfig(supabase, profileId.data, "prefilter_rules", {
    age_min: ageMin,
    age_max: ageMax,
    commute_max_min: commute,
    experience_min_months: experience,
    salary_expectation_max: salary,
    salary_is_blocking: formData.get("salary_is_blocking") === "on",
    schedule_text: text("schedule_text"),
    requires_saturdays: formData.get("requires_saturdays") === "on",
    education_min: text("education_min"),
    generated_by_ai: false,
  });
  if ("error" in saved) return { error: saved.error };

  revalidatePath(`/perfiles/${profileId.data}`);
  return { ok: true, message: `Reglas guardadas (v${saved.version}).` };
}

/** Preguntas del prefiltro a mano, en el orden en que llegan del formulario. Pueden quedar cero. */
export async function savePrefilterQuestions(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const profileId = profileIdSchema.safeParse(formData.get("profile_id"));
  if (!profileId.success) return { error: "Vacante no válida" };

  const keys = formData.getAll("key").map(String);
  const ruleKeys = formData.getAll("rule_key").map(String);
  const answerTypes = formData.getAll("answer_type").map(String);
  const texts = formData.getAll("text").map(String);
  if (texts.some((t) => t.trim().length > 300)) return { error: "Cada pregunta puede tener hasta 300 caracteres." };
  const questions = normalizeQuestions(texts.map((text, i) => ({ key: keys[i] || undefined, text, rule_key: ruleKeys[i] ?? "other", answer_type: answerTypes[i] ?? "text" })));

  const supabase = await createClient();
  const saved = await saveConfig(supabase, profileId.data, "prefilter_questions", { prefilter_questions: questions, generated_by_ai: false });
  if ("error" in saved) return { error: saved.error };

  revalidatePath(`/perfiles/${profileId.data}`);
  return { ok: true, message: `${questions.length === 1 ? "1 pregunta guardada" : `${questions.length} preguntas guardadas`} (v${saved.version}).` };
}

/**
 * Mínimos psicométricos a mano. Cada escala tiene su mínimo y, si es crítica, un mínimo bloqueante
 * (más bajo): por debajo de él el veredicto es "No recomendado" aunque el resto cumpla.
 */
export async function savePsychMinimums(_prev: AiActionState, formData: FormData): Promise<AiActionState> {
  const denied = await staffOrError();
  if (denied) return { error: denied };
  if (MOCK_CORE) return { error: MOCK_WRITE_ERROR };

  const profileId = profileIdSchema.safeParse(formData.get("profile_id"));
  if (!profileId.success) return { error: "Vacante no válida" };

  const scales = formData.getAll("scale").map((s) => String(s).trim());
  const mins = formData.getAll("min").map((s) => String(s).trim());
  const blocks = formData.getAll("block").map((s) => String(s).trim());
  const rows = scales.map((scale, i) => ({ scale, min: mins[i] ?? "", block: blocks[i] ?? "" })).filter((r) => r.scale || r.min || r.block);

  const valid = (v: string) => /^\d{1,3}$/.test(v) && Number(v) <= 100;
  for (const r of rows) {
    if (!r.scale) return { error: "Cada mínimo necesita el nombre de la escala." };
    if (!valid(r.min)) return { error: `${r.scale}: el mínimo va de 0 a 100.` };
    if (r.block && !valid(r.block)) return { error: `${r.scale}: el mínimo bloqueante va de 0 a 100, o vacío.` };
    if (r.block && Number(r.block) > Number(r.min)) return { error: `${r.scale}: el bloqueante no puede ser mayor que el mínimo.` };
  }

  const supabase = await createClient();
  const saved = await saveConfig(supabase, profileId.data, "psych_minimums", {
    psych_minimums: normalizePsychMinimums(rows.map((r) => ({ scale: r.scale, min: Number(r.min) }))),
    psych_blocking: normalizePsychMinimums(rows.filter((r) => r.block).map((r) => ({ scale: r.scale, min: Number(r.block) }))),
    generated_by_ai: false,
  });
  if ("error" in saved) return { error: saved.error };

  revalidatePath(`/perfiles/${profileId.data}`);
  return { ok: true, message: `Mínimos guardados (v${saved.version}).` };
}
