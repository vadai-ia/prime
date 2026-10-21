"use client";

import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "@/actions/blacklist";
import { alertErrorClass, inputClass, labelClass } from "@/components/ui/form";
import { BLACKLIST_REASON_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";

type ActiveEntry = { id: string; reason_key: Enums<"blacklist_reason">; reason_note: string | null; added_by_name: string | null; added_at_label: string };

const smallButton = "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60";

/** Ficha del candidato, solo admin: marcar en lista negra o, si ya está, ver el motivo y quitarla. */
export function BlacklistPanel({ candidateId, applicationId, entry }: { candidateId: string; applicationId: string; entry: ActiveEntry | null }) {
  const [open, setOpen] = useState(false);
  const [addState, addAction, adding] = useActionState(addToBlacklist, undefined);
  const [removeState, removeAction, removing] = useActionState(removeFromBlacklist, undefined);

  if (entry) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger-soft px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-danger">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">En lista negra: {BLACKLIST_REASON_LABELS[entry.reason_key]}</p>
              {entry.reason_note && <p className="mt-0.5 text-ink">{entry.reason_note}</p>}
              <p className="mt-1 text-xs text-ink-muted">
                {entry.added_by_name ?? "Admin"} · {entry.added_at_label}. No puede postularse a ninguna vacante. Solo los admins ven esto.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(!open)} className={smallButton}>
            Quitar de la lista negra
          </button>
        </div>
        {open && (
          <form action={removeAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="entry_id" value={entry.id} />
            <input type="hidden" name="application_id" value={applicationId} />
            <label className={`${labelClass} min-w-64 flex-1`}>
              Por qué se quita (opcional)
              <input name="note" type="text" maxLength={1000} className={inputClass} />
            </label>
            <button type="submit" disabled={removing} className={smallButton}>
              {removing ? "Quitando…" : "Confirmar"}
            </button>
          </form>
        )}
        {removeState?.error && (
          <p role="alert" className={`mt-3 ${alertErrorClass}`}>
            {removeState.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-danger">
          <Ban className="h-3.5 w-3.5" /> Agregar a lista negra
        </button>
      ) : (
        <form action={addAction} className="rounded-card border border-line bg-surface px-5 py-4 shadow-sm">
          <input type="hidden" name="candidate_id" value={candidateId} />
          <input type="hidden" name="application_id" value={applicationId} />
          <p className="text-sm font-semibold text-ink">Agregar a lista negra</p>
          <p className="mt-0.5 text-xs text-ink-muted">Sus postulaciones abiertas se descartan y no podrá postularse a ninguna vacante (por teléfono, CURP o correo). Las contrataciones no cambian. El reclutador no ve el motivo.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Motivo
              <select name="reason_key" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Elige…
                </option>
                {Object.entries(BLACKLIST_REASON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Nota
              <input name="note" type="text" maxLength={1000} placeholder="Qué pasó, con qué cliente, cuándo" className={inputClass} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={adding} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60">
              {adding ? "Guardando…" : "Agregar a lista negra"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={smallButton}>
              Cancelar
            </button>
          </div>
          {addState?.error && (
            <p role="alert" className={`mt-3 ${alertErrorClass}`}>
              {addState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
