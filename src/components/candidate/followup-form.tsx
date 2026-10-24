"use client";

import { useActionState, useState } from "react";
import { recordFollowup, type FollowupActionState } from "@/actions/followups";
import { FOLLOWUP_OUTCOME_LABELS } from "@/lib/labels";
import { inputClass } from "@/components/ui/form";
import type { Enums } from "@/lib/db/types";

type Outcome = Exclude<Enums<"followup_outcome">, "pending">;
const OUTCOMES: Outcome[] = ["active", "left", "unknown"];

/** Captura de un corte de permanencia: Sigue / Se fue / No se sabe. Se abre con un botón para no llenar la lista de formularios. */
export function FollowupForm({
  followupId,
  applicationId,
  current,
  leftAt,
  leftReason,
  notes,
}: {
  followupId: string;
  applicationId: string;
  current: Enums<"followup_outcome">;
  leftAt?: string | null;
  leftReason?: string | null;
  notes?: string | null;
}) {
  const [state, action, pending] = useActionState(recordFollowup, undefined);
  // Abierto desde qué resultado: al guardar bien llega un resultado nuevo y el formulario se cierra solo.
  const [openedAt, setOpenedAt] = useState<FollowupActionState | "closed">("closed");
  const open = openedAt !== "closed" && !(state?.ok && state !== openedAt);
  const setOpen = (v: boolean) => setOpenedAt(v ? state : "closed");
  const [outcome, setOutcome] = useState<Outcome | "">(current === "pending" ? "" : current);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${current === "pending" ? "bg-forest text-on-forest hover:bg-forest-deep" : "border border-line bg-surface text-ink hover:bg-canvas"}`}
      >
        {current === "pending" ? "Capturar" : "Corregir"}
      </button>
    );
  }

  return (
    <form action={action} className="w-full min-w-64 space-y-2 text-left">
      <input type="hidden" name="followup_id" value={followupId} />
      <input type="hidden" name="application_id" value={applicationId} />
      <div role="radiogroup" aria-label="Resultado" className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <label
            key={o}
            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition ${outcome === o ? "border-forest bg-mint text-forest" : "border-line bg-surface text-ink hover:bg-canvas"}`}
          >
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="sr-only" />
            {FOLLOWUP_OUTCOME_LABELS[o]}
          </label>
        ))}
      </div>
      {outcome === "left" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-ink-muted">
            Fecha de salida
            <input type="date" name="left_at" required defaultValue={leftAt ?? ""} className={inputClass} />
          </label>
          <label className="text-xs text-ink-muted">
            Motivo
            <input name="left_reason" maxLength={300} defaultValue={leftReason ?? ""} placeholder="Mejor oferta, horario, despido…" className={inputClass} />
          </label>
        </div>
      )}
      <label className="block text-xs text-ink-muted">
        Nota (opcional)
        <input name="notes" maxLength={1000} defaultValue={notes ?? ""} placeholder="Quién lo confirmó, cómo va" className={inputClass} />
      </label>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !outcome} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-on-forest transition hover:bg-forest-deep disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
