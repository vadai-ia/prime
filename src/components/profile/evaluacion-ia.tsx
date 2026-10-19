import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Bar } from "@/components/ui/bar";
import { fmtDate, fmtMoney, fmtMonths } from "@/lib/format";
import { asArray, type CvWeight, type PrefilterQuestion, type PsychMinimum } from "@/lib/domain/json";
import type { AiConfig } from "@/lib/queries/types";
import { DEFAULT_CV_THRESHOLD } from "@/lib/domain/scoring";
import { CvWeightsForm, GenerateEvaluationForm } from "./evaluacion-ia-forms";

const ANSWER_TYPES: Record<string, string> = {
  text: "Texto libre",
  months: "Meses de experiencia",
  yes_no: "Sí / No",
  money: "Monto",
  number: "Número",
};

/** Pestaña "Evaluación IA": reglas de prefiltro, pesos del CV, preguntas y mínimos psicométricos. */
export function EvaluacionIA({ config, profileId, aiOn }: { config: AiConfig | null; profileId: string; aiOn: boolean }) {
  const generate = (
    <Card title="Evaluación automática" subtitle="Pesos y umbral del CV, reglas y preguntas del prefiltro y mínimos psicométricos" className="lg:col-span-2">
      <GenerateEvaluationForm profileId={profileId} hasConfig={config !== null} aiOn={aiOn} />
    </Card>
  );

  if (!config) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {generate}
        <Card title="Pesos del CV" subtitle="O captúralos a mano: criterios que suman 100 y el umbral para avanzar">
          <CvWeightsForm profileId={profileId} weights={[]} threshold={DEFAULT_CV_THRESHOLD} />
        </Card>
      </div>
    );
  }

  const weights = asArray<CvWeight>(config.cv_weights);
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  const questions = asArray<PrefilterQuestion>(config.prefilter_questions).slice().sort((a, b) => a.order - b.order);
  const minimums = asArray<PsychMinimum>(config.psych_minimums);
  const blocking = asArray<PsychMinimum>(config.psych_blocking);

  const rules: { label: string; value: string; mode: "Bloqueo" | "Alerta" | null; note?: string }[] = [
    {
      label: "Edad",
      value: config.age_min !== null || config.age_max !== null ? `${config.age_min ?? "—"} a ${config.age_max ?? "—"} años` : "Sin regla",
      mode: config.age_min !== null || config.age_max !== null ? (config.age_is_blocking ? "Bloqueo" : "Alerta") : null,
      note: config.age_is_blocking ? "Descarta en automático. Revisar riesgo legal (LFT art. 3 y 133)." : "No descarta: el candidato cae en Requiere tu atención.",
    },
    { label: "Traslado máximo", value: config.commute_max_min !== null ? `${config.commute_max_min} min` : "Sin regla", mode: config.commute_max_min !== null ? "Bloqueo" : null },
    { label: "Experiencia mínima", value: config.experience_min_months !== null ? fmtMonths(config.experience_min_months) : "Sin regla", mode: config.experience_min_months !== null ? "Bloqueo" : null },
    { label: "Expectativa de sueldo máxima", value: config.salary_expectation_max !== null ? fmtMoney(config.salary_expectation_max) : "Sin regla", mode: config.salary_expectation_max !== null ? "Bloqueo" : null },
    { label: "Horario", value: config.schedule_text ?? "Sin regla", mode: config.requires_saturdays ? "Bloqueo" : null, note: config.requires_saturdays ? "Requiere disponibilidad en sábado." : undefined },
    { label: "Escolaridad mínima", value: config.education_min ?? "Sin regla", mode: config.education_min ? "Alerta" : null },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {generate}
      <Card
        title="Reglas de prefiltro"
        subtitle="Lo que Vale valida en WhatsApp antes de pasar al CV"
        action={
          <Pill tone="neutral">
            v{config.version}
            {config.generated_by_ai ? " · generada por IA" : " · manual"}
          </Pill>
        }
      >
        <ul className="divide-y divide-line">
          {rules.map((r) => (
            <li key={r.label} className="flex items-start justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
              <div>
                <p className="text-ink">{r.label}</p>
                {r.note && <p className="text-xs text-ink-faint">{r.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={r.value === "Sin regla" ? "text-ink-faint" : "font-medium text-ink"}>{r.value}</span>
                {r.mode && <Pill tone={r.mode === "Bloqueo" ? "danger" : "amber"}>{r.mode}</Pill>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-faint">
          Prompt {config.prompt_version ?? "—"}
          {config.generated_at && ` · generada ${fmtDate(config.generated_at)}`} · actualizada {fmtDate(config.updated_at)}
        </p>
      </Card>

      <Card
        title="Pesos del CV"
        subtitle={`Umbral para avanzar: ${config.cv_threshold} de 100`}
        action={<Pill tone={totalWeight === 100 ? "mint" : "danger"}>Suma {totalWeight}</Pill>}
      >
        {weights.length === 0 ? (
          <p className="text-sm text-ink-faint">Sin pesos configurados.</p>
        ) : (
          <div className="space-y-3">
            {weights.map((w) => (
              <div key={w.key}>
                <Bar label={w.label} value={w.weight} max={100} tone="forest" />
                {w.hint && <p className="mt-1 text-xs text-ink-faint">{w.hint}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 border-t border-line pt-3">
          <Bar label="Umbral mínimo" value={config.cv_threshold} max={100} tone="leaf" />
        </div>
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-medium text-forest">Editar pesos y umbral</summary>
          <div className="mt-3">
            <CvWeightsForm key={config.version} profileId={profileId} weights={weights} threshold={config.cv_threshold} />
          </div>
        </details>
      </Card>

      <Card title="Preguntas del prefiltro" subtitle="En el orden en que las hace el agente">
        {questions.length === 0 ? (
          <p className="text-sm text-ink-faint">Sin preguntas configuradas.</p>
        ) : (
          <ol className="space-y-3">
            {questions.map((q) => (
              <li key={q.key} className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-semibold text-forest">{q.order}</span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{q.text}</p>
                  <p className="text-xs text-ink-faint">
                    Regla <code className="rounded bg-canvas px-1 font-mono">{q.rule_key}</code> · {ANSWER_TYPES[q.answer_type] ?? q.answer_type}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Mínimos psicométricos" subtitle="Escalas de Psicotest que se comparan con el resultado">
        {minimums.length === 0 && blocking.length === 0 ? (
          <p className="text-sm text-ink-faint">Sin mínimos configurados.</p>
        ) : (
          <div className="space-y-4">
            {minimums.length > 0 && (
              <div className="space-y-3">
                {minimums.map((m) => (
                  <Bar key={m.scale} label={m.scale} value={m.min} max={100} tone="info" />
                ))}
              </div>
            )}
            {blocking.length > 0 && (
              <div className="rounded-lg bg-danger-soft px-3 py-2">
                <p className="text-xs font-medium text-danger">Bloqueantes</p>
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {blocking.map((b) => (
                    <li key={b.scale} className="flex justify-between">
                      <span>{b.scale}</span>
                      <span className="font-medium">mínimo {b.min}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">Por debajo de estos valores el veredicto es &quot;No recomendado&quot; aunque el resto cumpla.</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
