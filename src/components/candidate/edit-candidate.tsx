"use client";

import { useActionState, useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { updateCandidate } from "@/actions/candidates";
import { Modal } from "@/components/ui/modal";
import { alertErrorClass, inputClass, labelClass } from "@/components/ui/form";
import { AGE_MAX, AGE_MIN } from "@/lib/cv/parse";
import { fmtPhone } from "@/lib/format";
import type { Candidate } from "@/lib/queries/types";

/** Botón "Editar datos" de la ficha: corrige los datos de la persona. Lo que cambie se ve en todas sus postulaciones. */
export function EditCandidate({ applicationId, candidate }: { applicationId: string; candidate: Candidate }) {
  return (
    <Modal
      title="Editar datos del candidato"
      subtitle="Los cambios se ven en todas sus postulaciones y quedan en Logs técnicos."
      size="lg"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas"
        >
          <Pencil className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
          Editar datos
        </button>
      )}
    >
      {(close) => <EditForm applicationId={applicationId} c={candidate} onDone={close} />}
    </Modal>
  );
}

function EditForm({ applicationId, c, onDone }: { applicationId: string; c: Candidate; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateCandidate, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="application_id" value={applicationId} />

      <Section title="Contacto">
        <Field label="Nombre completo" name="full_name" defaultValue={c.full_name} required minLength={3} maxLength={120} span />
        <Field label="Teléfono" name="phone" defaultValue={fmtPhone(c.phone_e164)} required inputMode="tel" autoComplete="off" hint="Es su identidad en el sistema: con él se encuentra su historial." />
        <Field label="Correo" name="email" type="email" defaultValue={c.email ?? ""} autoComplete="off" />
      </Section>

      <Section title="Perfil">
        <Field
          label="Edad"
          name="age_reported"
          defaultValue={c.age_reported?.toString() ?? ""}
          inputMode="numeric"
          pattern="[0-9]{2}"
          maxLength={2}
          autoComplete="off"
          placeholder={`${AGE_MIN} a ${AGE_MAX}`}
          title={`De ${AGE_MIN} a ${AGE_MAX} años`}
        />
        <Field label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={c.birth_date ?? ""} />
        <Field label="Municipio" name="municipality" defaultValue={c.municipality ?? ""} maxLength={80} />
        <Field label="Zona o colonia" name="zone" defaultValue={c.zone ?? ""} maxLength={80} />
        <Field label="Escolaridad" name="education_level" defaultValue={c.education_level ?? ""} maxLength={120} placeholder="Preparatoria" span />
      </Section>

      <Section title="Identidad" hint="Se confirma con sus documentos del expediente. Solo la ve el equipo de Prime.">
        <Field label="CURP" name="curp" defaultValue={c.curp ?? ""} maxLength={18} autoComplete="off" className="uppercase" placeholder="18 caracteres" />
        <Field label="RFC" name="rfc" defaultValue={c.rfc ?? ""} maxLength={13} autoComplete="off" className="uppercase" placeholder="12 o 13 caracteres" />
        <Field label="NSS" name="nss" defaultValue={c.nss ?? ""} inputMode="numeric" maxLength={13} autoComplete="off" placeholder="11 dígitos" />
        <Field label="Domicilio" name="address_line" defaultValue={c.address_line ?? ""} maxLength={300} placeholder="Calle, número, colonia, CP" span />
      </Section>

      <label className={labelClass}>
        Notas
        <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} maxLength={2000} className={inputClass} placeholder="De dónde llegó, quién lo refirió, disponibilidad." />
      </label>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onDone} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface hover:text-ink">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</legend>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, span, className = "", ...props }: { label: string; name: string; hint?: string; span?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`${labelClass} ${span ? "sm:col-span-2" : ""}`}>
      {label}
      <input className={`${inputClass} ${className}`} {...props} />
      {hint && <span className="mt-1 block text-xs font-normal text-ink-faint">{hint}</span>}
    </label>
  );
}
