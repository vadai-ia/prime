"use client";

import { useActionState, useState } from "react";
import { setStage } from "@/actions/applications";
import { DISCARD_REASON_LABELS, PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/form";

export function StageActions({ applicationId, stage, discardedFrom }: { applicationId: string; stage: Stage; discardedFrom: Stage | null }) {
  const [state, action, pending] = useActionState(setStage, undefined);
  const [discarding, setDiscarding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const position = PIPELINE_STAGES.indexOf(stage);
  const next = stage !== "discarded" && position >= 0 && position < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[position + 1]! : null;
  // Regresar una etapa (se capturó de más, el candidato pidió reagendar, etc.). Un contratado no se regresa desde aquí.
  const previous = stage !== "discarded" && stage !== "hired" && position > 0 ? PIPELINE_STAGES[position - 1]! : null;
  const reopenTo: Stage = discardedFrom && discardedFrom !== "discarded" ? discardedFrom : "cv_review";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {next && (
          <form action={action}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="stage" value={next} />
            <Button type="submit" disabled={pending}>
              Avanzar a {STAGE_LABELS[next]}
            </Button>
          </form>
        )}
        {previous && (
          <form action={action}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="stage" value={previous} />
            <input type="hidden" name="reason" value={`Regresó de ${STAGE_LABELS[stage]} (ficha)`} />
            <Button type="submit" variant="secondary" disabled={pending}>
              Regresar a {STAGE_LABELS[previous]}
            </Button>
          </form>
        )}
        {stage === "hired" && (
          <Button type="button" variant="danger" onClick={() => setCancelling((v) => !v)} aria-expanded={cancelling}>
            {cancelling ? "Cancelar" : "Cancelar contratación"}
          </Button>
        )}
        {stage === "discarded" ? (
          <form action={action}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="stage" value={reopenTo} />
            <input type="hidden" name="reason" value="Reapertura desde la ficha" />
            <Button type="submit" variant="secondary" disabled={pending}>
              Reabrir en {STAGE_LABELS[reopenTo]}
            </Button>
          </form>
        ) : (
          stage !== "hired" && (
            <Button type="button" variant="danger" onClick={() => setDiscarding((v) => !v)} aria-expanded={discarding}>
              {discarding ? "Cancelar" : "Descartar"}
            </Button>
          )
        )}
      </div>

      {cancelling && stage === "hired" && (
        <form action={action} className="w-80 rounded-card border border-line bg-surface p-4 shadow-sm">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="stage" value="client_interview" />
          <p className="text-sm text-ink">
            El candidato regresa a <strong>{STAGE_LABELS.client_interview}</strong>. Se borran la fecha de contratación, la decisión del cliente y los seguimientos pendientes; la línea de tiempo conserva todo.
          </p>
          <label className={`${labelClass} mt-3`}>
            Motivo
            <textarea name="reason" rows={3} maxLength={500} required placeholder="No se presentó el primer día, declinó la oferta, el cliente cambió de opinión…" className={inputClass} />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCancelling(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </form>
      )}

      {discarding && stage !== "discarded" && (
        <form action={action} className="w-80 rounded-card border border-line bg-surface p-4 shadow-sm">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="stage" value="discarded" />
          <label className={labelClass}>
            Motivo
            <select name="discardKey" defaultValue="other" className={inputClass}>
              {(Object.keys(DISCARD_REASON_LABELS) as (keyof typeof DISCARD_REASON_LABELS)[]).map((key) => (
                <option key={key} value={key}>
                  {DISCARD_REASON_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} mt-3`}>
            Detalle
            <textarea name="reason" rows={3} maxLength={500} placeholder="Qué se le dice al candidato y por qué" className={inputClass} />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDiscarding(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Guardando…" : "Confirmar descarte"}
            </Button>
          </div>
        </form>
      )}

      {state?.error && (
        <p role="alert" className="max-w-sm rounded-lg bg-amber-soft px-3 py-2 text-right text-xs text-amber">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="rounded-lg bg-mint px-3 py-2 text-xs text-forest">Etapa actualizada.</p>}
    </div>
  );
}
