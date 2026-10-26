import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, Json } from "@/lib/db/types";
import { AI_BETAS, AI_MODEL, aiEnabled, anthropic, costUsd } from "./client";

/** Una tarea de IA: prompt versionado, esquema de salida y cuánto esfuerzo merece. */
export type AiTask<S extends z.ZodType> = {
  kind: Enums<"ai_run_kind">;
  promptVersion: string;
  effort: "low" | "medium" | "high";
  system: string;
  schema: S;
  maxTokens?: number;
};

export type AiResult<T> = { ok: true; output: T; runId: string | null } | { ok: false; error: string; runId: string | null };

/**
 * Única puerta a Claude. Manda la petición con el esquema de salida (zod), el prompt del sistema
 * en caché y `fallbacks: "default"`; valida la respuesta y deja el registro en `ai_runs` (tokens,
 * costo, latencia, error). Nunca lanza: quien la llama decide qué hacer con `ok: false`.
 *
 * `content` va en el mensaje del usuario. Lo que se repite entre llamadas (la vacante) va primero
 * y con `cache_control`; lo que cambia (el CV) al final.
 */
export async function runAi<S extends z.ZodType>(
  task: AiTask<S>,
  input: { content: BetaContentBlockParam[]; entity: { type: string; id: string } },
): Promise<AiResult<z.infer<S>>> {
  if (!aiEnabled()) return { ok: false, error: "La IA no está configurada (falta ANTHROPIC_API_KEY).", runId: null };

  const started = Date.now();
  const base = {
    kind: task.kind,
    entity_type: input.entity.type,
    entity_id: input.entity.id,
    prompt_version: task.promptVersion,
    effort: task.effort,
  };

  try {
    const response = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: task.maxTokens ?? 16000,
      betas: AI_BETAS,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: task.effort, format: betaZodOutputFormat(task.schema) },
      system: [{ type: "text", text: task.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input.content }],
    });

    const usage = {
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_usd: costUsd(response.model, response.usage),
      latency_ms: Date.now() - started,
    };

    if (response.stop_reason === "refusal") {
      const why = response.stop_details?.category ? ` (${response.stop_details.category})` : "";
      const runId = await logRun({ ...base, ...usage, status: "refusal", error: `Claude no quiso procesar la solicitud${why}.` });
      return { ok: false, error: "La IA no procesó esta solicitud. Captúralo a mano.", runId };
    }
    if (response.stop_reason === "max_tokens") {
      const runId = await logRun({ ...base, ...usage, status: "error", error: "Respuesta cortada por max_tokens." });
      return { ok: false, error: "La respuesta de la IA salió incompleta. Intenta de nuevo.", runId };
    }
    if (response.parsed_output === null) {
      const runId = await logRun({ ...base, ...usage, status: "error", error: "La salida no cumple el esquema." });
      return { ok: false, error: "La IA devolvió un formato inesperado. Intenta de nuevo.", runId };
    }

    const output = response.parsed_output as z.infer<S>;
    const runId = await logRun({ ...base, ...usage, status: "ok", output: output as Json });
    return { ok: true, output, runId };
  } catch (e) {
    const error = describeError(e);
    const runId = await logRun({ ...base, model: AI_MODEL, latency_ms: Date.now() - started, status: "error", error: error.log });
    return { ok: false, error: error.user, runId };
  }
}

function describeError(e: unknown): { user: string; log: string } {
  if (e instanceof Anthropic.AuthenticationError) return { user: "La llave de Anthropic no es válida.", log: e.message };
  if (e instanceof Anthropic.RateLimitError) return { user: "La IA está saturada. Intenta en un minuto.", log: e.message };
  if (e instanceof Anthropic.BadRequestError) {
    // Sin crédito también llega como 400
    const user = /credit|billing/i.test(e.message) ? "La cuenta de Anthropic no tiene crédito." : "La IA rechazó la solicitud.";
    return { user, log: e.message };
  }
  if (e instanceof Anthropic.APIError) return { user: "La IA no respondió. Intenta de nuevo.", log: `${e.status ?? "?"} ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { user: "No hubo conexión con la IA. Intenta de nuevo.", log: e.message };
  return { user: "Falló la llamada a la IA.", log: e instanceof Error ? e.message : String(e) };
}

/** ai_runs solo lo escribe el service role (plan §2.3). Si el registro falla no se tumba la tarea. */
async function logRun(row: {
  kind: Enums<"ai_run_kind">;
  entity_type: string;
  entity_id: string;
  prompt_version: string;
  effort: string;
  model: string;
  status: Enums<"ai_run_status">;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cost_usd?: number;
  error?: string;
  output?: Json;
}): Promise<string | null> {
  const { data, error } = await createAdminClient().from("ai_runs").insert(row).select("id").single();
  if (error) {
    console.error("ai_runs", error.message);
    return null;
  }
  return data.id;
}

/**
 * La lectura del CV corre antes de que exista el candidato (entity `cv_upload`, el uuid del archivo).
 * Al dar de alta se pasa a la postulación para que en Logs técnicos se pueda abrir. Si falla, solo se pierde el enlace.
 */
export async function relinkAiRuns(from: { type: string; id: string }, to: { type: string; id: string }): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_runs")
    .update({ entity_type: to.type, entity_id: to.id })
    .eq("entity_type", from.type)
    .eq("entity_id", from.id);
  if (error) console.error("ai_runs relink", error.message);
}
