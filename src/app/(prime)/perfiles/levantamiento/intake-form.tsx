"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { saveIntake } from "@/actions/intakes";
import { PositionFields, Section, Text } from "@/components/profile/position-fields";
import { alertErrorClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

type ClientOption = { id: string; name: string };

// Campos que el prefiltro y la evaluación necesitan; si faltan, se avisa sin bloquear el guardado.
const KEY_FIELDS: [name: string, label: string][] = [
  ["cond_salary", "sueldo"],
  ["cond_schedule", "horario"],
  ["work_zone", "zona de trabajo"],
  ["spec_age", "edad"],
  ["req_experience", "experiencia"],
  ["req_education", "escolaridad"],
];

function missingFields(form: HTMLFormElement): string[] {
  const data = new FormData(form);
  return KEY_FIELDS.filter(([name]) => !String(data.get(name) ?? "").trim()).map(([, label]) => label);
}

function listLabel(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? "");
}

/** Cliente fijo cuando el levantamiento se abre desde la ficha de la empresa: no se puede cambiar. */
export type LockedClient = ClientOption & {
  industry: string | null;
  city: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export function IntakeForm({ clients, canCreateProfile, lockedClient }: { clients: ClientOption[]; canCreateProfile: boolean; lockedClient?: LockedClient }) {
  const [state, action, pending] = useActionState(saveIntake, undefined);
  const [companyName, setCompanyName] = useState(lockedClient?.name ?? "");
  // El formulario nuevo arranca vacío: todos los campos clave faltan hasta que se capturan.
  const [missing, setMissing] = useState(() => KEY_FIELDS.map(([, label]) => label));

  function selectClient(id: string) {
    // Al elegir un cliente existente se propone su nombre; sigue siendo editable.
    const client = clients.find((c) => c.id === id);
    if (client) setCompanyName(client.name);
  }

  return (
    <form action={action} onInput={(e) => setMissing(missingFields(e.currentTarget))} className="space-y-5">
      <Section number="I" title="Empresa" hint={lockedClient ? "Datos de la empresa tal como están dados de alta; puedes ajustar el contacto para este levantamiento." : "Si el cliente ya está dado de alta, selecciónalo; si no, captura sus datos y se da de alta después."}>
        {lockedClient ? (
          <>
            <input type="hidden" name="client_id" value={lockedClient.id} />
            <label className={`${labelClass} sm:col-span-2`}>
              Empresa
              <input name="company_name" value={lockedClient.name} readOnly aria-readonly className={`${inputClass} cursor-not-allowed bg-canvas text-ink-muted`} />
            </label>
          </>
        ) : (
          <>
            <label className={`${labelClass} sm:col-span-2`}>
              Cliente existente
              <select name="client_id" defaultValue="" onChange={(e) => selectClient(e.target.value)} className={inputClass}>
                <option value="">Cliente nuevo (por dar de alta)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Nombre de la empresa
              <input name="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Telasist" className={inputClass} />
            </label>
          </>
        )}
        <Text name="company_industry" label="Giro" placeholder="Textil" value={lockedClient?.industry} />
        <Text name="company_city" label="Ciudad" placeholder="Aguascalientes" value={lockedClient?.city} />
        <Text name="contact_name" label="Contacto" value={lockedClient?.contact_name} />
        <Text name="contact_title" label="Puesto del contacto" placeholder="Gerente de RH" value={lockedClient?.contact_title} />
        <Text name="contact_email" label="Correo" type="email" value={lockedClient?.contact_email} />
        <Text name="contact_phone" label="Teléfono" type="tel" value={lockedClient?.contact_phone} />
      </Section>

      <PositionFields />

      {missing.length > 0 && (
        <div role="status" className="flex gap-2.5 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Faltan {listLabel(missing)}. Puedes guardar y quedarán marcados para completar con el cliente; sin ellos, el prefiltro y la evaluación del CV no tienen contra qué comparar.
          </p>
        </div>
      )}

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-xs text-ink-muted">
          {canCreateProfile
            ? "Crear la vacante copia el levantamiento al perfil y la deja activa para recibir candidatos."
            : "Se guarda como borrador. Un administrador crea la vacante y decide qué reclutadores la trabajan."}
        </p>
        <button type="submit" disabled={pending} className="mt-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
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
