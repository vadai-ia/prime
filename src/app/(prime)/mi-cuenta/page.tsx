import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, requireStaff } from "@/lib/dal";
import { getMyOutlook } from "@/lib/queries/integrations";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { alertErrorClass, alertSuccessClass, buttonPrimaryClass } from "@/components/ui/form";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { fmtDateTime } from "@/lib/format";
import { microsoftEnabled } from "@/lib/integrations/microsoft-graph";
import { disconnectOutlook } from "@/actions/integrations";

export const metadata: Metadata = { title: "Mi cuenta · Prime HR Innovation" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Outlook conectado. Las entrevistas que agendes se crean en tu calendario con reunión de Teams y Fireflies invitado." },
  "sin-permiso": { ok: false, text: "Microsoft no dio el permiso. Si sale \"Se necesita aprobación del administrador\", el admin de Microsoft 365 de Prime tiene que aprobar la app una vez." },
  "sin-configurar": { ok: false, text: "La conexión con Microsoft todavía no está configurada en el servidor." },
  error: { ok: false, text: "No se pudo conectar Outlook. Vuelve a intentarlo; si sigue fallando, avisa al admin." },
};

export default async function MiCuentaPage({ searchParams }: PageProps<"/mi-cuenta">) {
  const session = await requireStaff();
  const [user, params, outlook] = await Promise.all([getCurrentUser(), searchParams, getMyOutlook()]);
  const notice = typeof params.outlook === "string" ? NOTICES[params.outlook] : undefined;
  const enabled = microsoftEnabled();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mi cuenta" subtitle={`${user.full_name || user.email} · ${ROLE_LABELS[session.role]}`} />

      {notice && (
        <p role="status" className={`mb-5 ${notice.ok ? alertSuccessClass : alertErrorClass}`}>
          {notice.text}
        </p>
      )}

      <div className="space-y-5">
        <Card
          title="Outlook y Teams"
          subtitle="Con tu cuenta conectada, al agendar una entrevista se crea el evento en tu Outlook con enlace de Teams, se invita a Fireflies para grabarla y la invitación al candidato sale de tu correo."
          action={<Pill tone={outlook ? "mint" : "amber"}>{outlook ? "Conectado" : "Sin conectar"}</Pill>}
        >
          {outlook ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                {outlook.account_email ?? "Cuenta de Microsoft"} <span className="text-ink-muted">· desde {fmtDateTime(outlook.created_at)}</span>
              </p>
              <form action={disconnectOutlook}>
                <button type="submit" className="rounded-lg px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft">
                  Desconectar
                </button>
              </form>
            </div>
          ) : enabled ? (
            <div className="space-y-2">
              <a href="/api/integrations/microsoft/connect" className={`${buttonPrimaryClass} mt-0 inline-block w-auto`}>
                Conectar Outlook
              </a>
              <p className="text-xs text-ink-faint">Entras con tu correo de Prime. Mientras no conectes, el enlace de Teams se pega a mano al agendar.</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Pendiente: falta registrar la app de Prime en Microsoft (variables MICROSOFT_* y ENCRYPTION_KEY). Mientras, el enlace de Teams se pega a mano al agendar.</p>
          )}
        </Card>

        <Card title="Contraseña">
          <Link href="/cuenta/password" className="text-sm font-medium text-forest hover:underline">
            Cambiar mi contraseña
          </Link>
        </Card>
      </div>
    </div>
  );
}
