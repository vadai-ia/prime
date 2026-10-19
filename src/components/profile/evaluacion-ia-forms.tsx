"use client";

import { useActionState, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { generateEvaluation, saveCvWeights } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass, inputClass, labelClass } from "@/components/ui/form";
import type { CvWeight } from "@/lib/domain/json";

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
