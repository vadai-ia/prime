"use client";

import { useActionState } from "react";
import { removeFromBlacklist } from "@/actions/blacklist";

/** Quitar desde la lista (sin nota; para dejar una, se quita desde la ficha). */
export function RemoveButton({ entryId, name }: { entryId: string; name: string }) {
  const [state, action, pending] = useActionState(removeFromBlacklist, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Quitar a ${name} de la lista negra? Podrá volver a postularse.`)) e.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="note" value="" />
      <button type="submit" disabled={pending} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
        {pending ? "Quitando…" : "Quitar"}
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
