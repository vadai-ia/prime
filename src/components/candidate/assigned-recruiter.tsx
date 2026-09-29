"use client";

import { useActionState } from "react";
import { assignApplicationRecruiter } from "@/actions/assignments";
import type { RecruiterOption } from "@/lib/queries/types";

/** Reclutador asignado al candidato, con reasignación (solo admin) entre quienes trabajan la vacante. */
export function AssignedRecruiter({ applicationId, recruiterId, team }: { applicationId: string; recruiterId: string | null; team: RecruiterOption[] }) {
  const [state, action, pending] = useActionState(assignApplicationRecruiter, undefined);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="application_id" value={applicationId} />
      <label htmlFor="recruiter_id" className="text-ink-muted">
        Reclutador
      </label>
      <select id="recruiter_id" name="recruiter_id" defaultValue={recruiterId ?? ""} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink">
        <option value="">Sin asignar</option>
        {team.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name || r.email}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
        {pending ? "Guardando…" : "Reasignar"}
      </button>
      {team.length === 0 && <span className="text-amber">Esta vacante no tiene reclutadores; asígnalos en el perfil.</span>}
      {state?.error && (
        <span role="alert" className="text-danger">
          {state.error}
        </span>
      )}
      {state?.ok && <span className="text-forest">{state.message}</span>}
    </form>
  );
}
