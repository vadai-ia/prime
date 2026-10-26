import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/dal";
import { getClient } from "@/lib/queries/clients";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Coverage } from "@/components/ui/coverage";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_TONES, REPORT_TYPE_LABELS, type Tone, WEEKDAY_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateLong } from "@/lib/format";
import type { StageCounts } from "@/lib/queries/types";
import { NewVacancyDialog } from "./new-vacancy-dialog";

export const metadata: Metadata = { title: "Cliente · Prime HR Innovation" };

const REPORT_TONES: Record<string, Tone> = { sent: "mint", pending: "info", rendered: "info", failed: "danger" };
const REPORT_STATUS: Record<string, string> = { sent: "Enviado", pending: "Pendiente", rendered: "Generado", failed: "Falló" };

function inProcess(counts: StageCounts) {
  return counts.prefilter + counts.cv_review + counts.prime_interview + counts.psychometric + counts.documents + counts.client_interview;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value ?? "—"}</dd>
    </div>
  );
}

export default async function ClienteDetailPage(props: PageProps<"/clientes/[clientId]">) {
  const session = await requireStaff();
  const { clientId } = await props.params;
  const client = await getClient(clientId);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        backHref="/clientes"
        title={client.name}
        subtitle={[client.industry, client.city].filter(Boolean).join(" · ") || "Sin giro ni ciudad"}
        actions={
          <>
            {!client.is_active && <Pill tone="danger">Inactivo</Pill>}
            {client.portal_enabled ? <Pill tone="mint">Portal activo</Pill> : <Pill>Sin portal</Pill>}
            {session.role === "admin" && (
              <ButtonLink href={`/clientes/${client.id}/editar`} variant="secondary">
                Editar
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Contacto y reportes" className="lg:col-span-1">
          <dl className="space-y-3">
            <Field label="Razón social" value={client.legal_name} />
            {client.trade_name && client.trade_name !== client.name && <Field label="Nombre comercial" value={client.trade_name} />}
            <Field label="Contacto" value={client.contact_name ? `${client.contact_name}${client.contact_title ? `, ${client.contact_title}` : ""}` : null} />
            <Field label="Correo" value={client.contact_email} />
            <Field label="Teléfono" value={client.contact_phone} />
            <Field label="Domicilio" value={client.address} />
            <Field label="Cliente desde" value={client.client_since ? fmtDateLong(client.client_since) : null} />
            <div className="border-t border-line pt-3">
              <Field label="Reporte diario" value={`Todos los días a las ${client.daily_report_time.slice(0, 5)}`} />
            </div>
            <Field label="Reporte semanal" value={`${WEEKDAY_LABELS[client.weekly_report_dow] ?? "Viernes"} a las ${client.weekly_report_time.slice(0, 5)}`} />
            <Field
              label="Destinatarios"
              value={
                client.report_recipients.length ? (
                  <ul className="space-y-0.5">
                    {client.report_recipients.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  "Sin destinatarios"
                )
              }
            />
          </dl>
        </Card>

        <Card
          title="Vacantes"
          subtitle={`${client.profiles.length} en total`}
          action={
            session.role === "admin" && (
              <NewVacancyDialog
                client={{
                  id: client.id,
                  name: client.name,
                  industry: client.industry,
                  city: client.city,
                  contact_name: client.contact_name,
                  contact_title: client.contact_title,
                  contact_email: client.contact_email,
                  contact_phone: client.contact_phone,
                }}
              />
            )
          }
          className="lg:col-span-2"
          padded={false}
        >
          {client.profiles.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Sin vacantes" hint="Levanta la primera vacante para este cliente." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">Puesto</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Plazas</th>
                  <th className="px-5 py-2 font-medium">Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {client.profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link href={`/perfiles/${p.id}`} className="font-medium text-ink hover:text-forest">
                        {p.title}
                      </Link>
                      {p.work_zone && <p className="text-xs text-ink-muted">{p.work_zone}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={PROFILE_STATUS_TONES[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <Coverage hired={p.counts.hired} openings={p.openings} compact />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {inProcess(p.counts)} en proceso · {p.counts.hired} {p.counts.hired === 1 ? "contratado" : "contratados"}
                      {p.counts.discarded > 0 && <span className="text-ink-faint"> · {p.counts.discarded} descartados</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Usuarios del portal" subtitle="Quién puede entrar a ver candidatos y dar Vo.Bo." className="lg:col-span-1">
          {client.users.length === 0 ? (
            <p className="text-sm text-ink-muted">Nadie tiene acceso todavía. Un admin puede invitar desde Configuración.</p>
          ) : (
            <ul className="space-y-3">
              {client.users.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  <Avatar name={u.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{u.full_name || u.email}</p>
                    <p className="truncate text-xs text-ink-muted">{u.email}</p>
                  </div>
                  {!u.is_active && <Pill tone="danger">Inactivo</Pill>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reportes enviados" subtitle="Correos diarios y semanales" className="lg:col-span-2" padded={false}>
          {client.reports.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-ink-muted">Todavía no se ha enviado ningún reporte a este cliente.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {client.reports.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.subject ?? REPORT_TYPE_LABELS[r.type]}</p>
                    <p className="text-xs text-ink-muted">
                      {REPORT_TYPE_LABELS[r.type]} · {fmtDate(r.period_start)} a {fmtDate(r.period_end)}
                      {r.sent_at && <span className="text-ink-faint"> · enviado {fmtDate(r.sent_at)}</span>}
                    </p>
                    {r.error && <p className="text-xs text-danger">{r.error}</p>}
                  </div>
                  <Pill tone={REPORT_TONES[r.status] ?? "neutral"}>{REPORT_STATUS[r.status] ?? r.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
