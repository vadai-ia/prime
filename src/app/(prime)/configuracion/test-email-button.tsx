"use client";

import { useActionState } from "react";
import { sendTestEmail, type TestEmailState } from "@/actions/email";
import { alertErrorClass, alertSuccessClass } from "@/components/ui/form";

/** Botón de la tarjeta "Correos automáticos": manda una prueba a quien está en sesión. */
export function TestEmailButton() {
  const [state, action, pending] = useActionState<TestEmailState>(() => sendTestEmail(), undefined);
  return (
    <form action={action} className="mt-3 space-y-2">
      <button type="submit" disabled={pending} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60">
        {pending ? "Enviando…" : "Mandarme un correo de prueba"}
      </button>
      {state?.error && (
        <p role="alert" className={`${alertErrorClass} text-xs`}>
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className={`${alertSuccessClass} text-xs`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
