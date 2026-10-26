"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { generateEvaluation, saveCvWeights, savePrefilterQuestions, savePrefilterRules, savePsychMinimums, type AiActionState } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass, inputClass, labelClass } from "@/components/ui/form";
import type { CvWeight, PrefilterQuestion, PsychMinimum } from "@/lib/domain/json";
import { ANSWER_TYPES, RULE_KEYS } from "@/lib/domain/scoring";
import { ANSWER_TYPE_LABELS, RULE_KEY_LABELS } from "@/lib/labels";
import type { AiConfig } from "@/lib/queries/types";

/** Botón "Generar con IA": propone la evaluación completa desde el descriptivo. Si ya hay una, pide confirmar. */
export function GenerateEvaluationForm({ profileId, hasConfig, aiOn }: { profileId: string; hasConfig: boolean; aiOn: boolean }) {
  const [state, action, pending] = useActionState(generateEvaluation, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (hasConfig && !window.confirm("Se reemplazan pesos, umbral, reglas, preguntas y mínimos actuales por los que proponga la IA. ¿Continuar?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !aiOn}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {pending ? "Generando… puede tardar un minuto" : hasConfig ? "Regenerar con IA" : "Generar con IA"}
        </Button>
        <p className="text-xs text-ink-muted">
          {aiOn ? "La IA lee el descriptivo y propone; tú revisas y ajustas. La edad siempre queda como alerta." : "La IA no está configurada: falta ANTHROPIC_API_KEY."}
        </p>
      </div>
      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <div role="status" className={alertSuccessClass}>
          <p>{state.message}</p>
          {state.notes && state.notes.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide">Datos que faltan o que supuso la IA</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {state.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}

type Row = { id: number; key: string; label: string; weight: string; hint: string };

/** Edición a mano de los pesos del CV y del umbral. Guarda solo si los pesos suman 100. */
export function CvWeightsForm({ profileId, weights, threshold }: { profileId: string; weights: CvWeight[]; threshold: number }) {
  const [state, action, pending] = useActionState(saveCvWeights, undefined);
  const [rows, setRows] = useState<Row[]>(() =>
    weights.length > 0 ? weights.map((w, i) => ({ id: i, key: w.key, label: w.label, weight: String(w.weight), hint: w.hint ?? "" })) : [{ id: 0, key: "", label: "", weight: "", hint: "" }],
  );
  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={profileId} />
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-line p-3">
            <input type="hidden" name="key" value={r.key} />
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Criterio</span>
                <input name="label" value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} placeholder="Criterio (ej. Experiencia en cobranza)" className={inputClass} />
              </label>
              <label className="w-20 shrink-0">
                <span className="sr-only">Peso</span>
                <input name="weight" type="number" min={1} max={100} step={1} value={r.weight} onChange={(e) => update(r.id, { weight: e.target.value })} placeholder="Peso" className={inputClass} />
              </label>
              <Button type="button" variant="ghost" aria-label="Quitar criterio" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} disabled={rows.length === 1}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <label className="mt-2 block">
              <span className="sr-only">Guía para la IA</span>
              <input name="hint" value={r.hint} onChange={(e) => update(r.id, { hint: e.target.value })} placeholder="Qué da el puntaje completo y qué el parcial (guía para la IA)" className={`${inputClass} text-xs`} />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { id: Math.max(...rs.map((x) => x.id)) + 1, key: "", label: "", weight: "", hint: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Agregar criterio
        </Button>
        <p className={`text-sm font-medium ${total === 100 ? "text-leaf" : "text-danger"}`}>Suma {total} de 100</p>
      </div>

      <label className="block max-w-40">
        <span className={labelClass}>Umbral para avanzar</span>
        <input name="cv_threshold" type="number" min={0} max={100} step={1} defaultValue={threshold} className={inputClass} />
      </label>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className={alertSuccessClass}>
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending || total !== 100}>
        {pending ? "Guardando…" : "Guardar pesos"}
      </Button>
    </form>
  );
}

/** Resultado de guardar, igual en los tres formularios de abajo. */
function Feedback({ state }: { state: AiActionState }) {
  if (state?.error)
    return (
      <p role="alert" className={alertErrorClass}>
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className={alertSuccessClass}>
        {state.message}
      </p>
    );
  return null;
}

const Num = ({ name, label, value, placeholder, suffix }: { name: string; label: string; value: number | null; placeholder?: string; suffix?: string }) => (
  <label className={labelClass}>
    {label}
    <span className="flex items-center gap-2">
      <input name={name} inputMode="numeric" autoComplete="off" defaultValue={value ?? ""} placeholder={placeholder ?? "Sin regla"} className={inputClass} />
      {suffix && <span className="shrink-0 text-xs text-ink-muted">{suffix}</span>}
    </span>
  </label>
);

/** Reglas del prefiltro a mano. Vacío = sin regla. La edad siempre es alerta. */
export function PrefilterRulesForm({ profileId, config }: { profileId: string; config: AiConfig }) {
  const [state, action, pending] = useActionState(savePrefilterRules, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Num name="age_min" label="Edad mínima" value={config.age_min} suffix="años" />
        <Num name="age_max" label="Edad máxima" value={config.age_max} suffix="años" />
        <p className="text-xs text-ink-faint sm:col-span-2">La edad es solo alerta: no descarta, el candidato cae en Requiere tu atención.</p>
        <Num name="commute_max_min" label="Traslado máximo" value={config.commute_max_min} suffix="min" />
        <Num name="experience_min_months" label="Experiencia mínima" value={config.experience_min_months} suffix="meses" />
        <Num name="salary_expectation_max" label="Sueldo esperado máximo" value={config.salary_expectation_max} suffix="MXN" />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input type="checkbox" name="salary_is_blocking" defaultChecked={config.salary_is_blocking} className="h-4 w-4 accent-forest" />
          Arriba del máximo descarta (si no, solo avisa)
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Horario
          <input name="schedule_text" defaultValue={config.schedule_text ?? ""} placeholder="Ej.: L-V 8:30 a 18:00" className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" name="requires_saturdays" defaultChecked={config.requires_saturdays} className="h-4 w-4 accent-forest" />
          Requiere disponibilidad en sábado (descarta si no puede)
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Escolaridad mínima
          <input name="education_min" defaultValue={config.education_min ?? ""} placeholder="Ej.: Preparatoria terminada" className={inputClass} />
        </label>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar reglas"}
      </Button>
    </form>
  );
}

type QuestionRow = { id: number; key: string; text: string; rule_key: string; answer_type: string };

/** Preguntas del prefiltro a mano: texto, regla que evalúa, tipo de respuesta y orden. */
export function PrefilterQuestionsForm({ profileId, questions }: { profileId: string; questions: PrefilterQuestion[] }) {
  const [state, action, pending] = useActionState(savePrefilterQuestions, undefined);
  const [rows, setRows] = useState<QuestionRow[]>(() => questions.map((q, i) => ({ id: i, key: q.key, text: q.text, rule_key: q.rule_key, answer_type: q.answer_type })));
  const update = (id: number, patch: Partial<QuestionRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row!);
      return next;
    });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={profileId} />
      {rows.length === 0 && <p className="text-sm text-ink-faint">Sin preguntas. Agrega la primera.</p>}
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className="rounded-lg border border-line p-3">
            <input type="hidden" name="key" value={r.key} />
            <div className="flex items-start gap-2">
              <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-semibold text-forest">{i + 1}</span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Pregunta</span>
                <textarea name="text" rows={2} value={r.text} onChange={(e) => update(r.id, { text: e.target.value })} placeholder="Ej.: ¿Cuántos meses de experiencia tienes en cobranza?" className={inputClass} />
              </label>
              <div className="flex shrink-0 flex-col">
                <Button type="button" variant="ghost" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button type="button" variant="ghost" aria-label="Bajar" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <Button type="button" variant="ghost" aria-label="Quitar pregunta" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
              <label className="text-xs text-ink-muted">
                Regla que evalúa
                <select name="rule_key" value={r.rule_key} onChange={(e) => update(r.id, { rule_key: e.target.value })} className={`${inputClass} text-xs`}>
                  {RULE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {RULE_KEY_LABELS[k] ?? k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink-muted">
                Respuesta esperada
                <select name="answer_type" value={r.answer_type} onChange={(e) => update(r.id, { answer_type: e.target.value })} className={`${inputClass} text-xs`}>
                  {ANSWER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ANSWER_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setRows((rs) => [...rs, { id: Math.max(-1, ...rs.map((x) => x.id)) + 1, key: "", text: "", rule_key: "other", answer_type: "text" }])}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Agregar pregunta
      </Button>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar preguntas"}
      </Button>
    </form>
  );
}

type PsychRow = { id: number; scale: string; min: string; block: string };

/** Mínimos psicométricos a mano; el bloqueante es opcional y más bajo que el mínimo. */
export function PsychMinimumsForm({ profileId, minimums, blocking }: { profileId: string; minimums: PsychMinimum[]; blocking: PsychMinimum[] }) {
  const [state, action, pending] = useActionState(savePsychMinimums, undefined);
  const [rows, setRows] = useState<PsychRow[]>(() => {
    const blockBy = new Map(blocking.map((b) => [b.scale.toLowerCase(), b.min]));
    const base = minimums.map((m, i) => ({ id: i, scale: m.scale, min: String(m.min), block: blockBy.has(m.scale.toLowerCase()) ? String(blockBy.get(m.scale.toLowerCase())) : "" }));
    // un bloqueante sin mínimo propio queda como fila con el mismo valor en los dos
    const orphan = blocking.filter((b) => !minimums.some((m) => m.scale.toLowerCase() === b.scale.toLowerCase()));
    const all = [...base, ...orphan.map((b, i) => ({ id: base.length + i, scale: b.scale, min: String(b.min), block: String(b.min) }))];
    return all.length > 0 ? all : [{ id: 0, scale: "", min: "", block: "" }];
  });
  const update = (id: number, patch: Partial<PsychRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="hidden grid-cols-[1fr_5rem_5rem_2.5rem] gap-2 text-xs text-ink-muted sm:grid">
        <span>Escala de Psicotest</span>
        <span>Mínimo</span>
        <span>Bloquea abajo de</span>
        <span />
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_5rem_5rem_2.5rem] items-center gap-2">
            <input name="scale" aria-label="Escala" value={r.scale} onChange={(e) => update(r.id, { scale: e.target.value })} placeholder="Ej.: Tolerancia a la presión" className={inputClass} />
            <input name="min" aria-label="Mínimo" inputMode="numeric" value={r.min} onChange={(e) => update(r.id, { min: e.target.value })} placeholder="0-100" className={inputClass} />
            <input name="block" aria-label="Bloquea abajo de" inputMode="numeric" value={r.block} onChange={(e) => update(r.id, { block: e.target.value })} placeholder="—" className={inputClass} />
            <Button type="button" variant="ghost" aria-label="Quitar escala" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-faint">Por debajo del bloqueante el veredicto es &quot;No recomendado&quot; aunque el resto cumpla. Déjalo vacío si la escala no es crítica.</p>
      <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { id: Math.max(-1, ...rs.map((x) => x.id)) + 1, scale: "", min: "", block: "" }])}>
        <Plus className="h-4 w-4" aria-hidden />
        Agregar escala
      </Button>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar mínimos"}
      </Button>
    </form>
  );
}
