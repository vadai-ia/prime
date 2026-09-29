"use client";

import { useActionState } from "react";
import { createProfileFromIntake } from "@/actions/intakes";

type ClientOption = { id: string; name: string };

/** Botón "Crear vacante" de un levantamiento en borrador. Pide el cliente solo si el levantamiento no lo tiene. */
export function CreateProfileForm({ intakeId, hasClient, clients }: { intakeId: string; hasClient: boolean; clients: ClientOption[] }) {
  const [state, action, pending] = useActionState(createProfileFromIntake, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="intake_id" value={intakeId} />
      {!hasClient && (
        <select name="client_id" required defaultValue="" aria-label="Cliente" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink">
          <option value="" disabled>
            Cliente…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-white transition hover:bg-forest-deep disabled:opacity-60">
        {pending ? "Creando…" : "Crear vacante"}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
