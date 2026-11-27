import type { Metadata } from "next";
import Image from "next/image";
import { confirmEmailLink } from "@/actions/auth";

export const metadata: Metadata = { title: "Confirmar · Prime HR Innovation" };

const COPY: Record<string, { title: string; body: string; cta: string }> = {
  recovery: {
    title: "Restablecer contraseña",
    body: "Da clic en continuar para definir una contraseña nueva.",
    cta: "Continuar",
  },
  invite: {
    title: "Aceptar invitación",
    body: "Da clic en continuar para crear tu contraseña y entrar.",
    cta: "Aceptar invitación",
  },
};

const FALLBACK = { title: "Confirmar acceso", body: "Da clic en continuar para entrar.", cta: "Continuar" };

/**
 * Paso intermedio de los enlaces de correo (invitación, recuperación). Los escáneres de correo
 * (Microsoft Defender Safe Links y similares) abren cada enlace con GET antes que la persona; si el
 * token_hash se canjeara aquí, llegaría gastado. Por eso esta página no toca el token: solo lo
 * canjea el POST del formulario (`confirmEmailLink`), que manda la persona con el botón.
 * Funciona sin JavaScript (server action con mejora progresiva).
 */
export default async function ConfirmPage(props: PageProps<"/auth/confirmar">) {
  const params = await props.searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";
  const next = typeof params.next === "string" ? params.next : "";
  const copy = COPY[type] ?? FALLBACK;
  const valid = tokenHash !== "" && type !== "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-sm">
        {/* Texto oscuro en tema claro, texto blanco en tema oscuro. */}
        <Image src="/brand/logo-dark.png" alt="Prime HR Innovation" width={800} height={302} loading="eager" className="mb-5 h-12 w-auto [[data-theme=dark]_&]:hidden" />
        <Image src="/brand/logo-light.png" alt="Prime HR Innovation" width={800} height={302} loading="eager" className="mb-5 hidden h-12 w-auto [[data-theme=dark]_&]:block" />
        <h1 className="mt-1 text-xl font-semibold text-ink">{copy.title}</h1>
        {valid ? (
          <>
            <p className="mt-1 text-sm text-ink-muted">{copy.body}</p>
            <form action={confirmEmailLink} method="post" className="mt-6">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep"
              >
                {copy.cta}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">El enlace está incompleto. Pide uno nuevo desde la pantalla de entrada.</p>
        )}
      </div>
    </main>
  );
}
