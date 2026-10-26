"use client";

import { useActionState } from "react";
import { createClient, updateClient } from "@/actions/clients";
import type { Client } from "@/lib/queries/types";
import { alertErrorClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { WEEKDAY_LABELS } from "@/lib/labels";


/** Alta y edición de cliente. Con `client` edita: los campos del alta, más destinatarios de reportes y baja. */
export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(client ? updateClient : createClient, undefined);

  return (
    <form action={action} className="space-y-6">
      {client && <input type="hidden" name="id" value={client.id} />}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-forest">Empresa</legend>
        <label className={labelClass}>
          Cliente
          <input name="name" type="text" required minLength={2} defaultValue={client?.name ?? ""} className={inputClass} placeholder="Telasist" />
          <span className="mt-1 block text-xs font-normal text-ink-muted">Nombre corto con el que aparece en todo el sistema.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Razón social
            <input name="legal_name" type="text" defaultValue={client?.legal_name ?? ""} className={inputClass} placeholder="Telasist, S.A. de C.V." />
          </label>
          <label className={labelClass}>
            Nombre comercial
            <input name="trade_name" type="text" defaultValue={client?.trade_name ?? ""} className={inputClass} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Giro
            <input name="industry" type="text" defaultValue={client?.industry ?? ""} className={inputClass} placeholder="Textil" />
          </label>
          <label className={labelClass}>
            Ciudad
            <input name="city" type="text" defaultValue={client?.city ?? ""} className={inputClass} placeholder="Aguascalientes" />
          </label>
        </div>
        <label className={labelClass}>
          Domicilio
          <input name="address" type="text" defaultValue={client?.address ?? ""} className={inputClass} placeholder="Calle, número, colonia" />
        </label>
        <label className={labelClass}>
          Cliente desde
          <input name="client_since" type="date" defaultValue={client?.client_since ?? ""} className={inputClass} />
        </label>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-6">
        <legend className="text-sm font-semibold text-forest">Contacto principal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Nombre
            <input name="contact_name" type="text" defaultValue={client?.contact_name ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Puesto
            <input name="contact_title" type="text" defaultValue={client?.contact_title ?? ""} className={inputClass} placeholder="Gerente de RH" />
          </label>
          <label className={labelClass}>
            Correo
            <input name="contact_email" type="email" defaultValue={client?.contact_email ?? ""} className={inputClass} placeholder="contacto@empresa.mx" />
          </label>
          <label className={labelClass}>
            Teléfono
            <input name="contact_phone" type="tel" defaultValue={client?.contact_phone ?? ""} className={inputClass} placeholder="+52 449 000 0000" />
          </label>
        </div>
        {!client && <p className="text-xs text-ink-faint">El correo de contacto queda como primer destinatario de los reportes.</p>}
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-6">
        <legend className="text-sm font-semibold text-forest">Reportes y portal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Hora del reporte diario
            <input name="daily_report_time" type="time" defaultValue={client?.daily_report_time.slice(0, 5) ?? "18:00"} required className={inputClass} />
          </label>
          <label className={labelClass}>
            Día del reporte semanal
            <select name="weekly_report_dow" defaultValue={String(client?.weekly_report_dow ?? 5)} className={inputClass}>
              {WEEKDAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        {client && (
          <label className={labelClass}>
            Destinatarios de los reportes
            <input name="report_recipients" type="text" defaultValue={client.report_recipients.join(", ")} className={inputClass} placeholder="rh@empresa.mx, direccion@empresa.mx" />
            <span className="mt-1 block text-xs font-normal text-ink-faint">Correos separados por coma. Reciben el diario y el semanal.</span>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input name="portal_enabled" type="checkbox" defaultChecked={client?.portal_enabled ?? true} className="h-4 w-4 rounded border-line accent-forest" />
          Habilitar portal del cliente
        </label>
        {client && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
            <input name="is_active" type="checkbox" defaultChecked={client.is_active} className="h-4 w-4 rounded border-line accent-forest" />
            Cliente activo
            <span className="text-xs text-ink-faint">Al desmarcarlo sale de las listas; sus vacantes y candidatos se conservan.</span>
          </label>
        )}
      </fieldset>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Guardando…" : client ? "Guardar cambios" : "Guardar cliente"}
      </button>
    </form>
  );
}
