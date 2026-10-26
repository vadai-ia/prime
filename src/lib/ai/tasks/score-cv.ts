import "server-only";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asArray, type CvWeight } from "@/lib/domain/json";
import { buildCvScore, weightsTotal } from "@/lib/domain/scoring";
import { runAi } from "../run";
import { CvScoreOutput } from "../schemas";
import { EFFORT, PROMPT_VERSION, SYSTEM } from "../prompts/cv-score";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** `permanent`: reintentar no sirve (falta el CV o los pesos); la cola no lo vuelve a intentar. */
export type CvScoreResult = { ok: true; score: number } | { ok: false; error: string; permanent?: boolean };

/**
 * Califica el CV de una postulación contra los pesos de su vacante y guarda el resultado.
 *
 * Desde la ficha, `supabase` es el cliente con la sesión del usuario: si RLS no le deja leer la
 * postulación, no se califica (plan §2.3). Desde la cola (tarea cv_score, encolada en el alta ya
 * autorizada) es el service role. El PDF siempre se baja de Storage con service role.
 * Nada aquí mueve de etapa ni descarta: abajo del umbral, la postulación cae en
 * "Requiere tu atención" cuando llega a revisión de CV (`lib/attention.ts`).
 */
export async function scoreApplicationCv(supabase: Supabase, applicationId: string): Promise<CvScoreResult> {
  const { data: app, error } = await supabase
    .from("applications")
    .select("id, profile_id, candidates(full_name, cv_file_path, cv_text), job_profiles(title, requirements, activities, job_profile_ai_configs(cv_version, cv_weights))")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!app) return { ok: false, error: "Postulación no encontrada o no la tienes asignada", permanent: true };

  const candidate = app.candidates;
  const profile = app.job_profiles;
  const config = profile?.job_profile_ai_configs ?? null;
  const weights = asArray<CvWeight>(config?.cv_weights);
  if (!candidate || !profile) return { ok: false, error: "Postulación incompleta", permanent: true };
  if (!config || weights.length === 0 || weightsTotal(weights) !== 100) {
    return { ok: false, error: "La vacante no tiene pesos del CV que sumen 100. Genera o captura la evaluación en la vacante.", permanent: true };
  }

  const cv = await cvBlock(candidate.cv_file_path, candidate.cv_text);
  if (!cv) return { ok: false, error: "El candidato no tiene CV adjunto.", permanent: true };

  const vacante = {
    puesto: profile.title,
    requisitos: profile.requirements,
    actividades: profile.activities,
    criterios: weights.map((w) => ({ key: w.key, criterio: w.label, maximo: w.weight, guia: w.hint ?? null })),
  };

  const result = await runAi(
    { kind: "cv_score", promptVersion: PROMPT_VERSION, effort: EFFORT, system: SYSTEM, schema: CvScoreOutput },
    {
      entity: { type: "application", id: app.id },
      content: [
        // La vacante se repite en cada CV de la misma vacante: va primero y en caché
        { type: "text", text: `Vacante y criterios:\n\n${JSON.stringify(vacante, null, 2)}`, cache_control: { type: "ephemeral" } },
        cv,
        { type: "text", text: `CV de ${candidate.full_name}. Califícalo contra cada criterio.` },
      ],
    },
  );
  if (!result.ok) return result;

  const { score, breakdown, missing } = buildCvScore(weights, result.output.criteria);
  const flags = result.output.flags.map((f) => f.trim()).filter(Boolean);
  if (missing.length > 0) flags.push(`Sin evaluar: ${missing.join(", ")}`);

  const { error: saveError } = await supabase
    .from("applications")
    .update({
      cv_score: score,
      cv_score_breakdown: breakdown,
      // la versión de los pesos, no la de toda la evaluación: editar preguntas o reglas no pide recalificar
      cv_score_version: config.cv_version,
      cv_scored_at: new Date().toISOString(),
      cv_ai_rationale: result.output.summary.trim() || null,
      ai_note: flags.length > 0 ? `Revisar: ${flags.join(" · ")}` : null,
    })
    .eq("id", app.id);
  if (saveError) return { ok: false, error: saveError.message };
  return { ok: true, score };
}

/** El PDF va como documento (Claude lee tablas y columnas); si no se puede bajar, el texto extraído en el alta. */
async function cvBlock(path: string | null, text: string | null): Promise<BetaContentBlockParam | null> {
  if (path) {
    const { data } = await createAdminClient().storage.from("cvs").download(path);
    if (data) {
      const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }, title: "CV" };
    }
  }
  if (text?.trim()) return { type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: "CV" };
  return null;
}
