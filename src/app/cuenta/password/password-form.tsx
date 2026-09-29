"use client";

import { useActionState } from "react";
import { updatePassword } from "@/actions/auth";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className={labelClass}>
        Nueva contraseña
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </label>
      <label className={labelClass}>
        Confirmar
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
