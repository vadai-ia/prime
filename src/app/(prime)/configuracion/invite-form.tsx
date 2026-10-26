"use client";

import { useActionState, useState } from "react";
import { createUserAccount, type UserFormState } from "@/actions/users";
import { alertErrorClass, alertSuccessClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { tempPassword } from "@/lib/temp-password";

/**
 * Alta de usuarios por el admin con contraseña temporal. La invitación por correo
 * (mode=invite en createUserAccount) queda apagada hasta configurar SMTP y templates.
 * Va dentro del modal "Crear usuario" (se monta al abrirlo), así que la temporal se genera en el navegador.
 */
export function InviteForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [role, setRole] = useState<(typeof ROLES)[number]>("recruiter");
  const [password, setPassword] = useState(tempPassword);
  // el aviso muestra la contraseña con la que se creó esa cuenta, no la que esté escrita después;
  // al crear, el campo trae una nueva para el siguiente usuario
  type CreateState = (UserFormState & { password?: string }) | undefined;
  const [state, action, pending] = useActionState(async (prev: CreateState, formData: FormData): Promise<CreateState> => {
    const result = await createUserAccount(prev, formData);
    if (!result?.ok) return result;
    setPassword(tempPassword());
    return { ...result, password: String(formData.get("password") ?? "") };
  }, undefined);

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
        <div className="flex items-center gap-2">
          <input
            name="password"
            type="text"
            required
            minLength={8}
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} font-mono`}
            placeholder="Mínimo 8 caracteres"
          />
          <button type="button" onClick={() => setPassword(tempPassword())} className="mt-1 shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-muted transition hover:bg-surface hover:text-ink">
            Otra
          </button>
        </div>
        <span className="mt-1 block text-xs font-normal text-ink-faint">Cópiala antes de crear la cuenta: tú se la pasas y la puede cambiar en Mi cuenta.</span>
      </label>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className={alertSuccessClass}>
          {state.message ?? "Listo."} Contraseña: <span className="select-all font-mono font-semibold">{state.password}</span>
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Guardando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
