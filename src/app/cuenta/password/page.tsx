import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Contraseña · Prime HR Innovation" };

export default async function PasswordPage() {
  const session = await verifySession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Prime HR Innovation</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Define tu contraseña</h1>
        <p className="mt-1 text-sm text-ink-muted">{session.email}</p>
        <PasswordForm />
      </div>
    </main>
  );
}
