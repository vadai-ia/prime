// Prueba mínima de la llave y de la forma de petición de src/lib/ai/run.ts. Uso: npm run ai:smoke
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY (.env o .env.local).");
  process.exit(1);
}

const schema = z.object({ ok: z.boolean(), saludo: z.string() });
const started = Date.now();
try {
  const r = await new Anthropic().beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: "Responde en español.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: "Devuelve ok=true y un saludo corto." }],
  });
  console.log("modelo:", r.model, "| stop:", r.stop_reason, "| ms:", Date.now() - started);
  console.log("tokens:", r.usage.input_tokens, "in /", r.usage.output_tokens, "out");
  console.log("salida:", r.parsed_output);
} catch (e) {
  console.error("FALLÓ:", e?.status ?? "", e?.message ?? e);
  process.exit(1);
}
