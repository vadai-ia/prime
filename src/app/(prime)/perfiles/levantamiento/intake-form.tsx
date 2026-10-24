"use client";

import { useActionState, useState } from "react";
import { saveIntake } from "@/actions/intakes";
import { StepperFooter, StepperHeader, useFormStepper } from "@/components/profile/form-stepper";
import { PositionFields, Section, Text } from "@/components/profile/position-fields";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

const STEPS = ["Cliente", "Puesto", "Perfil", "Requisitos", "Actividades", "Condiciones", "Competencias"];

/** Empresa con los datos que precargan la sección I. Fija cuando el levantamiento se abre desde su ficha. */
export type LockedClient = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

/** Al elegir un cliente existente solo se precargan nombre, ciudad y contacto. */
type ClientOption = Pick<LockedClient, "id" | "name" | "city" | "contact_name">;

// Sexo, estado civil e hijos casi siempre son "Indistinto": el levantamiento nuevo ya los trae así.
const NEW_DEFAULTS = { specs: { sex: "Indistinto", marital_status: "Indistinto", children: "Indistinto" } };

export function IntakeForm({ clients, canCreateProfile, lockedClient }: { clients: ClientOption[]; canCreateProfile: boolean; lockedClient?: LockedClient }) {
  const [state, action, pending] = useActionState(saveIntake, undefined);
  const stepper = useFormStepper();
  const [clientId, setClientId] = useState("");
  const selected = clients.find((c) => c.id === clientId);

  function selectClient(id: string) {
    // El select no es controlado: si lo fuera, el re-render de onInput (que llega antes que onChange) lo regresaría.
    // La key de cada campo lo remonta con los datos del cliente; "Cliente nuevo" los limpia.
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    stepper.remeasure({ company_name: client?.name ?? "", company_city: client?.city ?? "", contact_name: client?.contact_name ?? "" });
  }

  return (
    <form action={action} {...stepper.formProps} className="space-y-5">
      <StepperHeader steps={STEPS} stepper={stepper} inDialog={Boolean(lockedClient)} />

      <Section
        number="I"
        title="Empresa"
        step={1}
        hidden={stepper.step !== 1}
        hint={lockedClient ? "Datos de la empresa tal como están dados de alta; puedes ajustar el contacto para este levantamiento." : "Si el cliente ya está dado de alta, selecciónalo: se llenan su nombre, ciudad y contacto. Si no, captura sus datos y se da de alta después."}
      >
        {lockedClient ? (
          <>
            <input type="hidden" name="client_id" value={lockedClient.id} />
            <label className={`${labelClass} sm:col-span-2`}>
              Empresa
              <input name="company_name" value={lockedClient.name} readOnly aria-readonly className={`${inputClass} cursor-not-allowed bg-canvas text-ink-muted`} />
            </label>
            <Text name="company_industry" label="Giro" placeholder="Ej.: Textil" value={lockedClient.industry} />
            <Text name="company_city" label="Ciudad" placeholder="Ej.: Aguascalientes" value={lockedClient.city} />
            <Text name="contact_name" label="Contacto" value={lockedClient.contact_name} />
            <Text name="contact_title" label="Puesto del contacto" placeholder="Ej.: Gerente de RH" value={lockedClient.contact_title} />
            <Text name="contact_email" label="Correo" type="email" value={lockedClient.contact_email} />
            <Text name="contact_phone" label="Teléfono" type="tel" value={lockedClient.contact_phone} />
          </>
        ) : (
          <>
            <label className={`${labelClass} sm:col-span-2`}>
              Cliente existente
              <select name="client_id" defaultValue="" data-skip-progress onChange={(e) => selectClient(e.target.value)} className={inputClass}>
                <option value="">Cliente nuevo (por dar de alta)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Text key={`name-${clientId}`} name="company_name" label="Nombre de la empresa" placeholder="Ej.: Telasist" value={selected?.name} />
            <Text name="company_industry" label="Giro" placeholder="Ej.: Textil" />
            <Text key={`city-${clientId}`} name="company_city" label="Ciudad" placeholder="Ej.: Aguascalientes" value={selected?.city} />
            <Text key={`contact-${clientId}`} name="contact_name" label="Contacto" value={selected?.contact_name} />
            <Text name="contact_title" label="Puesto del contacto" placeholder="Ej.: Gerente de RH" />
            <Text name="contact_email" label="Correo" type="email" />
            <Text name="contact_phone" label="Teléfono" type="tel" />
          </>
        )}
      </Section>

      <PositionFields defaults={NEW_DEFAULTS} step={stepper.step} />

      <StepperFooter steps={STEPS} stepper={stepper} error={state?.error} />

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <p className="mr-auto text-xs text-ink-muted">
          {canCreateProfile
            ? "Crear la vacante copia el levantamiento al perfil y la deja activa para recibir candidatos."
            : "Se guarda como borrador. Un administrador crea la vacante y decide qué reclutadores la trabajan."}
        </p>
        <button type="submit" disabled={pending} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
          Guardar borrador
        </button>
        {canCreateProfile && (
          <button type="submit" name="intent" value="create_profile" disabled={pending} className={`${buttonPrimaryClass} w-auto`}>
            {pending ? "Guardando…" : "Guardar y crear vacante"}
          </button>
        )}
      </div>
    </form>
  );
}
