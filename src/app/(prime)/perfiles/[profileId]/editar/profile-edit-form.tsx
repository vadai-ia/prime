"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profiles";
import { StepperFooter, StepperHeader, useFormStepper } from "@/components/profile/form-stepper";
import { Area, PositionFields, Section, type PositionDefaults } from "@/components/profile/position-fields";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { CHANNEL_LABELS, PROFILE_STATUS_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";
import type { ProfileRelation } from "@/lib/domain/json";

const STATUSES: Enums<"profile_status">[] = ["active", "paused", "closed", "intake"];

// Mismos pasos que el levantamiento; el 1 es el estado de la vacante en lugar del cliente y el 8,
// que el levantamiento no tiene, es lo que se arma después: relaciones, proceso y publicación.
const STEPS = ["Estado", "Puesto", "Perfil", "Requisitos", "Actividades", "Condiciones", "Competencias", "Publicación"];

export type PublishingDefaults = {
  relations: ProfileRelation[];
  selection_process: string[];
  published_channels: Enums<"source_channel">[];
  posting_text: string | null;
};

export function ProfileEditForm({ profileId, status, defaults, publishing }: { profileId: string; status: Enums<"profile_status">; defaults: PositionDefaults; publishing: PublishingDefaults }) {
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

      <Section number="VIII" title="Relaciones, proceso y publicación" step={8} hidden={stepper.step !== 8} hint="Una por línea. En relaciones, con quién y después de dos puntos para qué.">
        <Area
          name="relations"
          label="Relaciones de trabajo"
          span={false}
          placeholder={"Gerente de crédito: reporta resultados\nClientes: negocia pagos"}
          value={publishing.relations.map((r) => (r.purpose ? `${r.with}: ${r.purpose}` : r.with))}
        />
        <Area name="selection_process" label="Proceso de selección" span={false} placeholder={"Entrevista Prime\nPsicométrico\nEntrevista con el cliente"} value={publishing.selection_process} />
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Dónde se publica</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(CHANNEL_LABELS) as Enums<"source_channel">[]).map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="published_channels" value={c} defaultChecked={publishing.published_channels.includes(c)} data-skip-progress className="h-4 w-4 accent-forest" />
                {CHANNEL_LABELS[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <Area name="posting_text" label="Texto de la vacante" rows={6} placeholder="El anuncio tal como se publica en Pandape, Facebook o LinkedIn." value={publishing.posting_text} />
      </Section>

      <StepperFooter steps={STEPS} stepper={stepper} error={state?.error} />

      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" disabled={pending} className={`${buttonPrimaryClass} w-auto`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
