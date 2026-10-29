"use client";

import { useActionState, useState } from "react";
import { flushSync } from "react-dom";
import { saveIntake } from "@/actions/intakes";
import { StepperFooter, StepperHeader, useFormStepper } from "@/components/profile/form-stepper";
import { JobDescriptionUpload } from "@/components/profile/job-description-upload";
import { PositionFields, Section, Text, type PositionDefaults } from "@/components/profile/position-fields";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { countFilled, fillEmptyPosition, positionFromFormData } from "@/lib/domain/intake-form-data";
import type { IntakeForm as IntakeFormData } from "@/lib/domain/json";
import type { RecruiterOption } from "@/lib/queries/assignments";

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
const NEW_DEFAULTS: PositionDefaults = { specs: { sex: "Indistinto", marital_status: "Indistinto", children: "Indistinto" } };

const toDefaults = ({ position, ...rest }: Omit<IntakeFormData, "company">): PositionDefaults => ({ ...rest, ...position });

/** `recruiters`: solo para admin; los marcados trabajan la vacante desde que se crea. */
export function IntakeForm({ clients, canCreateProfile, lockedClient, recruiters = [] }: { clients: ClientOption[]; canCreateProfile: boolean; lockedClient?: LockedClient; recruiters?: RecruiterOption[] }) {
  const [state, action, pending] = useActionState(saveIntake, undefined);
  const stepper = useFormStepper();
  const [clientId, setClientId] = useState("");
  const selected = clients.find((c) => c.id === clientId);
  // Lo leído del descriptivo: cambia la key de las secciones II a VII para remontarlas con los valores nuevos.
  const [position, setPosition] = useState({ defaults: NEW_DEFAULTS, version: 0 });

  /** Junta lo capturado con lo leído (solo llena lo vacío), remonta las secciones y lleva al paso 2 a revisar. */
  function applyDescription(extracted: Omit<IntakeFormData, "company">): number {
    const form = stepper.formRef.current;
    if (!form) return 0;
    const data = new FormData(form);
    const current = positionFromFormData(data, String(data.get("title") ?? "").trim());
    const merged = fillEmptyPosition(current, extracted);
    // Sincrónico para medir el avance con los campos ya pintados.
    flushSync(() => setPosition((p) => ({ defaults: toDefaults(merged), version: p.version + 1 })));
    stepper.remeasure();
    stepper.goTo(2);
    return countFilled(merged) - countFilled(current);
  }

  function selectClient(id: string) {
    // El select no es controlado: si lo fuera, el re-render de onInput (que llega antes que onChange) lo regresaría.
    // La key de cada campo lo remonta con los datos del cliente; "Cliente nuevo" los limpia.
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    stepper.remeasure({ company_name: client?.name ?? "", company_city: client?.city ?? "", contact_name: client?.contact_name ?? "" });
  }

  return (
    <div className="space-y-5">
      <JobDescriptionUpload onRead={applyDescription} />
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

        <PositionFields key={position.version} defaults={position.defaults} step={stepper.step} />

        <StepperFooter steps={STEPS} stepper={stepper} error={state?.error} />

        {canCreateProfile && recruiters.length > 0 && (
          <fieldset className="rounded-card border border-line bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-semibold text-forest">Reclutadores de la vacante</legend>
            <p className="mb-3 text-xs text-ink-muted">
              Se asignan al crear la vacante y ven a todos sus candidatos. Sin ninguno, solo la ve un administrador. Se cambian después en la pestaña Reclutadores.
            </p>
            <div className="flex flex-wrap gap-2">
              {recruiters.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink transition hover:bg-canvas has-[:checked]:border-forest has-[:checked]:bg-forest/10">
                  <input type="checkbox" name="recruiter_ids" value={r.id} data-skip-progress className="h-4 w-4 rounded border-line accent-forest" />
                  <span title={r.email}>{r.full_name || r.email}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

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
    </div>
  );
}
