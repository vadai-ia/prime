import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { alertErrorClass } from "@/components/ui/form";

export const metadata: Metadata = { title: "Entrar · Prime HR Innovation" };

const ERROR_MESSAGES: Record<string, string> = {
  enlace: "El enlace no es válido o ya caducó. Pide uno nuevo.",
  "sin-rol": "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active.",
  "no-role": "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active.",
  inactive: "Tu cuenta está desactivada.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Prime HR Innovation</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Sistema de reclutamiento</h1>

        {error && (
          <p role="alert" className={`mt-4 ${alertErrorClass}`}>
            {error}
          </p>
        )}

        <LoginForm next={next} />
      </div>
    </main>
  );
}
