"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profiles";
import { StepperFooter, StepperHeader, useFormStepper } from "@/components/profile/form-stepper";
import { PositionFields, Section, type PositionDefaults } from "@/components/profile/position-fields";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { PROFILE_STATUS_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";

const STATUSES: Enums<"profile_status">[] = ["active", "paused", "closed", "intake"];

// Mismos pasos que el levantamiento; el 1 es el estado de la vacante en lugar del cliente.
const STEPS = ["Estado", "Puesto", "Perfil", "Requisitos", "Actividades", "Condiciones", "Competencias"];

export function ProfileEditForm({ profileId, status, defaults }: { profileId: string; status: Enums<"profile_status">; defaults: PositionDefaults }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const stepper = useFormStepper();

  return (
    <form action={action} {...stepper.formProps} className="space-y-5">
      <input type="hidden" name="profile_id" value={profileId} />

      <StepperHeader steps={STEPS} stepper={stepper} />

      <Section number="I" title="Estado de la vacante" step={1} hidden={stepper.step !== 1} hint="Una vacante cerrada ya no recibe candidatos nuevos; los que tiene se conservan.">
        <label className={labelClass}>
          Estado
          <select name="status" defaultValue={status} data-skip-progress className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROFILE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <PositionFields defaults={defaults} withNotes={false} step={stepper.step} />

      <StepperFooter steps={STEPS} stepper={stepper} error={state?.error} />

      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" disabled={pending} className={`${buttonPrimaryClass} w-auto`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
