import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { alertErrorClass } from "@/components/ui/form";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = { title: "Entrar · Prime HR Innovation" };

const ERROR_MESSAGES: Record<string, string> = {
  enlace: "El enlace no es válido o ya caducó. Pide uno nuevo.",
  "sin-rol": "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active.",
  "no-role": "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active.",
  inactive: "Tu cuenta está desactivada.",
};

// Composición de la tarjeta de marca: panel negro con franja turquesa a la izquierda, formulario a la
// derecha con la marca de agua en gris claro. En celular el panel negro queda arriba como encabezado.
export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] bg-surface md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-1">
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-chrome px-6 py-6 text-white md:px-12 md:py-12">
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-lime md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-1.5" />

        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-lime text-xl font-bold text-black">P</span>
          <div>
            <p className="text-lg font-semibold tracking-wide">PRIME HR</p>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-lime">Innovation</p>
          </div>
        </div>

        <div className="hidden max-w-sm md:block">
          <p className="text-3xl font-semibold leading-tight">
            Del levantamiento a la <span className="text-lime">contratación</span>, en un solo lugar.
          </p>
          <p className="mt-4 text-sm text-white/60">Vacantes, candidatos, entrevistas y reportes para el equipo de Prime y sus clientes.</p>
        </div>

        <p className="hidden text-xs text-white/40 md:block">Prime HR Innovation · Sistema de reclutamiento</p>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden px-4 pb-12 pt-16 md:px-12 md:py-12">
        <span aria-hidden className="pointer-events-none absolute -bottom-8 -right-4 hidden select-none text-[10rem] font-bold leading-none tracking-tighter text-line md:block">
          PRIME
        </span>
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Acceso</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Entra a tu cuenta</h1>
          <p className="mt-1 text-sm text-ink-muted">Usa el correo y la contraseña que te dio el administrador.</p>

          {error && (
            <p role="alert" className={`mt-4 ${alertErrorClass}`}>
              {error}
            </p>
          )}

          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
