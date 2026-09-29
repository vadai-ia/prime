"use client";

import { useActionState } from "react";
import { signInWithPassword } from "@/actions/auth";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

/** Un solo acceso para los tres roles: correo y contraseña. Las cuentas las crea un admin. */
export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className={labelClass}>
        Correo
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>
      <label className={labelClass}>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required minLength={8} className={inputClass} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-ink-faint">Si no tienes cuenta, pídela al administrador de Prime.</p>
    </form>
  );
}
