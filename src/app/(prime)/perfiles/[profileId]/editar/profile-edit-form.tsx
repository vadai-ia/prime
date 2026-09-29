"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profiles";
import { PositionFields, type PositionDefaults } from "@/components/profile/position-fields";
import { alertErrorClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { PROFILE_STATUS_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";

const STATUSES: Enums<"profile_status">[] = ["active", "paused", "closed", "intake"];

export function ProfileEditForm({ profileId, status, defaults }: { profileId: string; status: Enums<"profile_status">; defaults: PositionDefaults }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="profile_id" value={profileId} />

      <fieldset className="rounded-card border border-line bg-surface p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-forest">Estado de la vacante</legend>
        <label className={`${labelClass} max-w-xs`}>
          Estado
          <select name="status" defaultValue={status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROFILE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-ink-muted">Una vacante cerrada ya no recibe candidatos nuevos; los que tiene se conservan.</p>
      </fieldset>

      <PositionFields defaults={defaults} withNotes={false} />

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={`${buttonPrimaryClass} w-auto`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
