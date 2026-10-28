import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { listPromptUsage } from "@/lib/queries/logs";
import { AI_MODEL } from "@/lib/ai/client";
import * as profileGeneration from "@/lib/ai/prompts/profile-generation";
import * as cvScore from "@/lib/ai/prompts/cv-score";
import * as cvExtract from "@/lib/ai/prompts/cv-extract";
import { AI_RUN_KIND_LABELS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import type { Enums } from "@/lib/db/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { SimpleTable } from "../../reportes/simple-table";

export const metadata: Metadata = { title: "Prompts de IA · Prime HR Innovation" };

// Los prompts viven en el código (src/lib/ai/prompts/), no en la base: cambiarlos es editar el archivo, subir
// PROMPT_VERSION y desplegar. Esta pantalla solo los muestra junto con lo que ha costado cada versión.
const PROMPTS: { kind: Enums<"ai_run_kind">; file: string; when: string; version: string; effort: string; system: string }[] = [
  {
    kind: "profile_generation",
    file: "src/lib/ai/prompts/profile-generation.ts",
    when: "Vacante → Evaluación IA → Generar con IA. Lee el descriptivo de la vacante y propone criterios y pesos del CV, umbral, reglas y preguntas del prefiltro y mínimos psicométricos.",
    version: profileGeneration.PROMPT_VERSION,
    effort: profileGeneration.EFFORT,
    system: profileGeneration.SYSTEM,
  },
  {
    kind: "cv_score",
    file: "src/lib/ai/prompts/cv-score.ts",
    when: "Al agregar un candidato con CV y con Calificar CV / Recalificar en su ficha. Califica el CV contra los criterios de la vacante con evidencia, resumen y alertas.",
    version: cvScore.PROMPT_VERSION,
    effort: cvScore.EFFORT,
    system: cvScore.SYSTEM,
  },
  {
    kind: "cv_extract",
    file: "src/lib/ai/prompts/cv-extract.ts",
    when: "Candidatos → Carga masiva. Copia del PDF nombre, teléfono, correo, municipio, escolaridad y edad (solo si el CV la dice) para revisarlos antes del alta. No evalúa.",
    version: cvExtract.PROMPT_VERSION,
    effort: cvExtract.EFFORT,
    system: cvExtract.SYSTEM,
  },
];

const EFFORT_LABELS: Record<string, string> = { low: "bajo", medium: "medio", high: "alto" };
const usd = (n: number) => `$${n.toFixed(3)} USD`;
const secs = (n: number | null) => (n === null ? "—" : `${(n / 1000).toFixed(1)} s`);

/** Solo admin. Qué le pide el sistema a la IA en cada tarea y cuánto ha costado cada versión del prompt. */
export default async function PromptsPage() {
  await requireAdmin();
  const usage = await listPromptUsage();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        backHref="/configuracion"
        title="Prompts de IA"
        subtitle="Las instrucciones que recibe la IA en cada tarea. La IA lee y propone; el código y el reclutador deciden."
      />

      <p className="mb-6 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        Los prompts viven en el código, no en la base de datos. Para cambiar uno se edita su archivo, se sube la versión y se despliega; las
        llamadas nuevas quedan con la versión nueva y aquí abajo se comparan con las anteriores. Modelo de todas las tareas: <span className="font-mono text-ink">{AI_MODEL}</span>.
      </p>

      <div className="space-y-6">
        {PROMPTS.map((p) => {
          const rows = usage.filter((u) => u.kind === p.kind);
          return (
            <Card key={p.kind} title={AI_RUN_KIND_LABELS[p.kind]} subtitle={p.when}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Pill tone="mint">{p.version}</Pill>
                <span>Esfuerzo {EFFORT_LABELS[p.effort] ?? p.effort}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">{p.file}</span>
              </div>

              <details className="group mt-4 rounded-lg border border-line bg-canvas">
                <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-ink">Ver prompt completo</summary>
                <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-xs leading-relaxed text-ink">{p.system}</pre>
              </details>

              <h3 className="mt-5 text-sm font-medium text-ink">Uso por versión (90 días)</h3>
              {rows.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">Sin llamadas todavía.</p>
              ) : (
                <div className="mt-2">
                  <SimpleTable
                    headers={["Versión", "Llamadas", "Errores", "Costo total", "Costo promedio", "Tiempo promedio", "Última"]}
                    rows={rows.map((u) => [
                      <span key="v" className={`font-mono text-xs ${u.prompt_version === p.version ? "font-semibold text-forest" : ""}`}>
                        {u.prompt_version}
                        {u.prompt_version === p.version ? " (actual)" : ""}
                      </span>,
                      String(u.runs),
                      u.errors ? <span key="e" className="text-danger">{u.errors}</span> : "0",
                      usd(u.cost),
                      usd(u.runs ? u.cost / u.runs : 0),
                      secs(u.avgLatencyMs),
                      fmtDateTime(u.lastAt),
                    ])}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Por programar, con su propio prompt: respuesta del prefiltro por WhatsApp, lectura del psicométrico, análisis de entrevista, revisión de documentos e insights semanales.
      </p>
    </div>
  );
}
