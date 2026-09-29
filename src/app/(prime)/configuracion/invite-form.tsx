"use client";

import { useActionState, useState } from "react";
import { createUserAccount } from "@/actions/users";
import { alertErrorClass, alertSuccessClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";

/**
 * Alta de usuarios por el admin con contraseña temporal. La invitación por correo
 * (mode=invite en createUserAccount) queda apagada hasta configurar SMTP y templates.
 */
export function InviteForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createUserAccount, undefined);
  const [role, setRole] = useState<(typeof ROLES)[number]>("recruiter");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value="password" />
      <label className={labelClass}>
        Nombre
        <input name="full_name" type="text" required minLength={2} className={inputClass} placeholder="Nombre y apellido" />
      </label>
      <label className={labelClass}>
        Correo
        <input name="email" type="email" required autoComplete="off" className={inputClass} placeholder="persona@empresa.com" />
      </label>
      <label className={labelClass}>
        Rol
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      {role === "client" && (
        <label className={labelClass}>
          Empresa
          <select name="client_id" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Elige la empresa
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={labelClass}>
        Contraseña temporal
        <input name="password" type="text" required minLength={8} autoComplete="off" className={inputClass} placeholder="Mínimo 8 caracteres" />
        <span className="mt-1 block text-xs font-normal text-ink-faint">Tú se la comunicas; puede cambiarla después.</span>
      </label>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      {state?.ok && <p className={alertSuccessClass}>{state.message ?? "Listo."}</p>}
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Guardando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
