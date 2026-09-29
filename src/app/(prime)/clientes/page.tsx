import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, UserRound } from "lucide-react";
import { getSession } from "@/lib/dal";
import { listClients } from "@/lib/queries/clients";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Clientes · Prime HR Innovation" };

export default async function ClientesPage() {
  const [session, clients] = await Promise.all([getSession(), listClients({ includeInactive: true })]);
  const isAdmin = session?.role === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} ${clients.length === 1 ? "empresa" : "empresas"} · ${clients.filter((c) => c.is_active).length} activas`}
        actions={isAdmin ? <ButtonLink href="/clientes/nuevo">Nuevo cliente</ButtonLink> : undefined}
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Aún no hay clientes"
          hint="Da de alta la primera empresa para empezar a levantar vacantes."
          action={isAdmin ? <ButtonLink href="/clientes/nuevo">Nuevo cliente</ButtonLink> : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-sm transition hover:border-leaf"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint text-forest">
                      <Building2 size={18} />
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted">{c.industry ?? "Sin giro"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!c.is_active && <Pill tone="danger">Inactivo</Pill>}
                    {c.portal_enabled ? <Pill tone="mint">Portal</Pill> : <Pill>Sin portal</Pill>}
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-sm text-ink-muted">
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-ink-faint" />
                    {c.city ?? "Sin ciudad"}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound size={14} className="text-ink-faint" />
                    {c.contact_name ?? "Sin contacto"}
                    {c.contact_email && <span className="text-ink-faint">· {c.contact_email}</span>}
                  </p>
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Vacantes</dt>
                    <dd className="text-lg font-semibold text-forest">{c.active_profiles}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-faint">En proceso</dt>
                    <dd className="text-lg font-semibold text-ink">{c.in_process}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Contratados</dt>
                    <dd className="text-lg font-semibold text-leaf">{c.hired}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
