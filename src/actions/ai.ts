"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE, MOCK_PIPELINE, MOCK_WRITE_ERROR } from "@/lib/mock";
import { aiEnabled } from "@/lib/ai/client";
import { generateProfileConfig } from "@/lib/ai/tasks/generate-profile";
import { scoreApplicationCv } from "@/lib/ai/tasks/score-cv";
import { clampThreshold, normalizeWeights, weightsTotal } from "@/lib/domain/scoring";
import type { TablesInsert } from "@/lib/db/types";

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

/**
 * Escribe la configuración de evaluación de la vacante con la sesión del usuario (admin o reclutador
 * asignado: lo decide RLS) y sube la versión. Las postulaciones calificadas con una versión anterior
 * quedan marcadas para recalificar.
 */
async function saveConfig(supabase: Supabase, profileId: string, patch: ConfigPatch): Promise<{ version: number } | { error: string }> {
  const { data: current, error: findError } = await supabase.from("job_profile_ai_configs").select("version").eq("profile_id", profileId).maybeSingle();
  if (findError) return { error: findError.message };

  const version = (current?.version ?? 0) + 1;
  const { error } = current
    ? await supabase.from("job_profile_ai_configs").update({ ...patch, version }).eq("profile_id", profileId)
    : await supabase.from("job_profile_ai_configs").insert({ ...patch, profile_id: profileId, version });
  if (error) return { error: error.code === "42501" ? "No tienes asignada esta vacante." : error.message };
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

  const saved = await saveConfig(supabase, profileId.data, result.output.config);
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
  const saved = await saveConfig(supabase, parsed.data.profile_id, {
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
