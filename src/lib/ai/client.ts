import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Modelo de todas las tareas de IA (plan §4.2). El costo se baja con `effort`, no cambiando de modelo. */
export const AI_MODEL = "claude-opus-5-5";

/** Reintento del lado del servidor en otro modelo si Claude rechaza por política (`fallbacks: "default"`). */
export const AI_BETAS = ["server-side-fallback-2026-07-01"];

// USD por millón de tokens. Si un fallback contesta con otro modelo se cobra a su tarifa.
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

export function costUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null },
): number {
  const p = PRICES[model] ?? PRICES[AI_MODEL];
  const usd =
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite;
  return Math.round(usd) / 1_000_000;
}

/** Sin `ANTHROPIC_API_KEY` la IA está apagada: los botones lo dicen y el alta de candidatos no califica. */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
