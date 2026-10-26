"use client";

import { useActionState, useState, useTransition } from "react";
import { requestPasswordReset, signInWithPassword, type AuthFormState } from "@/actions/auth";
import { alertSuccessClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

/**
 * Un solo acceso para los tres roles: correo y contraseña. Las cuentas las crea un admin.
 * Si la contraseña falla, el mensaje depende del rol del correo: el admin puede pedir el enlace
 * de recuperación; el reclutador y el cliente se lo piden a un admin.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, undefined);
  const [reset, setReset] = useState<{ for: AuthFormState; result: AuthFormState } | null>(null);
  const [sending, start] = useTransition();
  // el resultado del enlace solo vale para el intento de login que lo pidió
  const resetResult = reset && reset.for === state ? reset.result : undefined;

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
      {resetResult?.message ? (
        <p role="status" className={alertSuccessClass}>
          {resetResult.message}
        </p>
      ) : (
        (resetResult?.error ?? state?.error) && (
          <p role="alert" className="text-sm text-danger">
            {resetResult?.error ?? state?.error}
          </p>
        )
      )}
      {state?.resetEmail && !resetResult?.message && (
        <button
          type="button"
          disabled={sending}
          onClick={() => {
            const email = state.resetEmail!;
            start(async () => setReset({ for: state, result: await requestPasswordReset(email) }));
          }}
          className="text-sm font-medium text-forest hover:underline disabled:opacity-60"
        >
          {sending ? "Mandando…" : "Olvidé mi contraseña"}
        </button>
      )}
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-ink-faint">Si no tienes cuenta, pídela al administrador de Prime.</p>
    </form>
  );
}
