import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { listUsers } from "@/lib/queries/users";
import { listClients } from "@/lib/queries/clients";
import { getIntegrationsStatus } from "@/lib/queries/settings";
import { getQueueOverview } from "@/lib/queries/tasks";
import { taskLabel } from "@/lib/queue/handlers";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES } from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { fmtDateTime, timeAgo } from "@/lib/format";
import type { IntegrationStatus } from "@/lib/queries/types";
import { SimpleTable } from "../reportes/simple-table";
import { InviteForm } from "./invite-form";
import { UserRowActions } from "./user-row-actions";
import { TaskRowActions } from "./task-row-actions";

export const metadata: Metadata = { title: "Configuración · Prime HR Innovation" };

const NEEDS: Record<IntegrationStatus["key"], string> = {
  supabase: "URL y llave pública del proyecto; la llave secreta solo para invitaciones, webhooks y cron.",
  anthropic: "API key con límite de gasto mensual. Modelo por defecto claude-opus-5-5.",
  whaapy: "API key del número de Prime, secret del webhook y la IA nativa apagada en ese número. Templates enviados a aprobación de Meta.",
  fireflies: "API key de la cuenta de Prime y webhook de transcripción apuntando a /api/webhooks/fireflies.",
  microsoft: "Falta que el admin de Microsoft 365 de Prime registre la app y nos pase tres datos (tenant, client id y secreto; pasos en tasks.md §6). Con eso, cada reclutador da clic en Conectar Outlook en Mi cuenta.",
  cron: "CRON_SECRET (cualquier texto largo) en Vercel y en .env.local, y el cron diario de vercel.json. En local se corre con npm run queue:tick.",
  resend: "Dominio de Prime verificado (SPF, DKIM, DMARC) y remitente configurado.",
};

export default async function ConfiguracionPage() {
  const session = await requireAdmin();
  const [users, clients, integrations, queue] = await Promise.all([listUsers(), listClients({ includeInactive: true }), getIntegrationsStatus(), getQueueOverview()]);

  const usersSection = (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SimpleTable
          headers={["Usuario", "Rol", "Empresa", "Estado", "Última vez", ""]}
          align={["left", "left", "left", "left", "left", "right"]}
          rows={users.map((u) => [
            <div key={u.id} className="flex items-center gap-3">
              <Avatar name={u.full_name || u.email} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium">{u.full_name || "Sin nombre"}</p>
                <p className="truncate text-xs text-ink-muted">{u.email}</p>
              </div>
            </div>,
            ROLE_LABELS[u.role],
            u.client_name ?? <span className="text-ink-faint">—</span>,
            <Pill key={`${u.id}-a`} tone={u.is_active ? "mint" : "neutral"}>{u.is_active ? "Activo" : "Inactivo"}</Pill>,
            <span key={`${u.id}-t`} className="text-xs text-ink-muted">{u.last_seen_at ? timeAgo(u.last_seen_at) : "Nunca"}</span>,
            <UserRowActions key={`${u.id}-x`} userId={u.id} fullName={u.full_name} isActive={u.is_active} isSelf={u.id === session.userId} />,
          ])}
        />
        <p className="mt-2 text-xs text-ink-faint">El nombre se corrige aquí. El rol y la empresa se cambian desde app_metadata en Supabase; desactivar también bloquea el acceso en Auth y saca al reclutador de sus vacantes.</p>
      </div>
      <Card title="Crear usuario" subtitle="Sin registro público: todas las cuentas se crean aquí.">
        <InviteForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Configuración" subtitle={`${users.length} ${users.length === 1 ? "usuario" : "usuarios"}`} />
      {usersSection}

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Integraciones</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {integrations.filter((i) => i.configured).length} de {integrations.length} configuradas. Mientras una no exista, su dato se captura a mano.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {integrations.map((i) => (
            <div key={i.key} className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{i.label}</p>
                <Pill tone={i.configured ? "mint" : "amber"}>{i.configured ? "Configurada" : "Pendiente"}</Pill>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{i.detail}</p>
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">{NEEDS[i.key]}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tareas" className="mt-10 scroll-mt-6">
        <h2 className="text-lg font-medium text-ink">Tareas automáticas</h2>
        <p className="mt-1 text-sm text-ink-muted">
          La cola corre una vez al día, 8:00 (/api/cron/tick). {queue.pending} pendientes · {queue.running} corriendo · {queue.failed} fallidas · {queue.doneLastDay} terminadas en 24 h
          {queue.lastFinishedAt ? ` · última ${timeAgo(queue.lastFinishedAt)}` : ""}.
        </p>
        {queue.cronStale && (
          <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
            Hay tareas que ya tocaban y no han corrido: el cron no está llegando. Revisa CRON_SECRET y el cron en Vercel (en local: npm run queue:tick).
          </p>
        )}
        <div className="mt-3">
          <SimpleTable
            headers={["Tarea", "Estado", "Intentos", "Cuándo", "Error", ""]}
            align={["left", "left", "center", "left", "left", "right"]}
            empty="Nada pendiente ni fallido."
            rows={queue.open.map((t) => [
              taskLabel(t.type),
              <Pill key={`${t.id}-s`} tone={TASK_STATUS_TONES[t.status]}>
                {TASK_STATUS_LABELS[t.status]}
              </Pill>,
              `${t.attempts}/${t.max_attempts}`,
              <span key={`${t.id}-w`} className="text-xs text-ink-muted">
                {t.status === "pending" ? `Corre ${fmtDateTime(t.run_at)}` : t.finished_at ? fmtDateTime(t.finished_at) : `Desde ${fmtDateTime(t.run_at)}`}
              </span>,
              <span key={`${t.id}-e`} className="line-clamp-2 max-w-md text-xs text-danger">
                {t.last_error ?? ""}
              </span>,
              <TaskRowActions key={`${t.id}-x`} taskId={t.id} status={t.status} />,
            ])}
          />
        </div>
      </section>
    </div>
  );
}
