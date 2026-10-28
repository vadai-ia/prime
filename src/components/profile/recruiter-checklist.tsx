"use client";

import { useActionState } from "react";
import { setProfileRecruiters } from "@/actions/assignments";
import { Avatar } from "@/components/ui/avatar";
import { alertErrorClass, alertSuccessClass, buttonPrimaryClass } from "@/components/ui/form";
import type { ProfileRecruiters } from "@/lib/queries/types";

/** Checklist de reclutadores activos de la vacante. Guardar deja asignados exactamente a los marcados. */
export function RecruiterChecklist({ profileId, recruiters }: { profileId: string; recruiters: ProfileRecruiters["recruiters"] }) {
  const [state, action, pending] = useActionState(setProfileRecruiters, undefined);

  if (recruiters.length === 0) {
    return <p className="text-sm text-ink-muted">No hay reclutadores activos. Crea sus cuentas en Configuración.</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={profileId} />
      <ul className="divide-y divide-line">
        {recruiters.map((r) => (
          <li key={r.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" name="recruiter_ids" value={r.id} defaultChecked={r.assigned} className="h-4 w-4 rounded border-line accent-forest" />
              <Avatar name={r.full_name || r.email} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.full_name || "Sin nombre"}</span>
                <span className="block truncate text-xs text-ink-muted">{r.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className={alertSuccessClass}>
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">Quien quede desmarcado deja de ver la vacante y sus candidatos.</p>
        <button type="submit" disabled={pending} className={`${buttonPrimaryClass} mt-0 w-auto`}>
          {pending ? "Guardando…" : "Guardar asignación"}
        </button>
      </div>
    </form>
  );
}
