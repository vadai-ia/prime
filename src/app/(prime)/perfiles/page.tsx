import type { Metadata } from "next";
import Link from "next/link";
import { listIntakes, listProfiles } from "@/lib/queries/profiles";
import { listClients } from "@/lib/queries/clients";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Coverage } from "@/components/ui/coverage";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_TONES } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { asJson, type IntakeForm } from "@/lib/domain/json";
import type { Enums } from "@/lib/db/types";
import { CreateProfileForm } from "./create-profile-form";
import { ClientFilter } from "./client-filter";

export const metadata: Metadata = { title: "Vacantes · Prime HR Innovation" };

const STATUSES: Enums<"profile_status">[] = ["active", "paused", "intake", "closed"];

function isStatus(value: unknown): value is Enums<"profile_status"> {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export default async function PerfilesPage(props: PageProps<"/perfiles">) {
  const session = await requireStaff();
  const isAdmin = session.role === "admin";
  const showRecruiters = can(session.role, "manage_assignments");
  const params = await props.searchParams;
  const status = isStatus(params.status) ? params.status : undefined;
  const clients = await listClients();
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  // Solo se acepta un cliente que el usuario puede ver; cualquier otro valor se ignora.
  const clientId = typeof params.client === "string" && clientOptions.some((c) => c.id === params.client) ? params.client : undefined;
  const clientName = clientOptions.find((c) => c.id === clientId)?.name;
  const [profiles, intakes] = await Promise.all([listProfiles({ status, clientId }), listIntakes()]);
  const withClient = (href: string) => (clientId ? `${href}${href.includes("?") ? "&" : "?"}client=${clientId}` : href);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Vacantes"
        subtitle={`${profiles.length} ${profiles.length === 1 ? "vacante" : "vacantes"}${clientName ? ` · ${clientName}` : ""}${status ? ` · ${PROFILE_STATUS_LABELS[status].toLowerCase()}` : ""}`}
        actions={<ButtonLink href="/perfiles/levantamiento">Nuevo levantamiento</ButtonLink>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ClientFilter clients={clientOptions} value={clientId} />
        <FilterChip href={withClient("/perfiles")} active={!status}>
          Todas
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} href={withClient(`/perfiles?status=${s}`)} active={status === s}>
            {PROFILE_STATUS_LABELS[s]}
          </FilterChip>
        ))}
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          title={isAdmin ? "Sin vacantes en este filtro" : "No tienes vacantes asignadas en este filtro"}
          hint={isAdmin ? "Cambia el filtro o levanta una vacante nueva." : "Un administrador decide qué vacantes trabajas. Las verás aquí en cuanto te asigne."}
        />
      ) : (
        <Card padded={false}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-faint">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Puesto</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                {showRecruiters && <th className="px-3 py-2 font-medium">Reclutadores</th>}
                <th className="px-3 py-2 font-medium">Plazas</th>
                <th className="px-3 py-2 font-medium">Zona</th>
                <th className="px-5 py-2 font-medium">Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <Link href={`/perfiles/${p.id}`} className="font-medium text-ink hover:text-forest">
                      {p.title}
                    </Link>
                    <p className="text-xs text-ink-faint">Creado {fmtDate(p.created_at)}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{p.client_name}</td>
                  <td className="px-3 py-3">
                    <Pill tone={PROFILE_STATUS_TONES[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Pill>
                  </td>
                  {showRecruiters && (
                    <td className="px-3 py-3 text-xs">
                      {p.recruiters.length > 0 ? <span className="text-ink-muted">{p.recruiters.join(", ")}</span> : <span className="font-medium text-amber">Sin asignar</span>}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <Coverage hired={p.counts.hired} openings={p.openings} compact />
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{p.work_zone ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 text-xs">
                      <MiniCount label="Prefiltro" value={p.counts.prefilter} />
                      <MiniCount label="Entrevista" value={p.counts.prime_interview} />
                      <MiniCount label="Cliente" value={p.counts.client_interview} />
                      <MiniCount label="Contratados" value={p.counts.hired} highlight />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-ink">Levantamientos</h2>
        <p className="mt-1 text-sm text-ink-muted">Formularios capturados con el cliente. Los generados ya tienen su perfil.</p>
        {intakes.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Sin levantamientos" hint="Captura el primero desde Nuevo levantamiento." />
          </div>
        ) : (
          <Card className="mt-3" padded={false}>
            <ul className="divide-y divide-line">
              {intakes.map((i) => {
                const form = asJson<IntakeForm>(i.form, {});
                const title = form.position?.title ?? i.profile_title ?? "Sin puesto";
                return (
                  <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      {i.profile_id ? (
                        <Link href={`/perfiles/${i.profile_id}`} className="font-medium text-ink hover:text-forest">
                          {title}
                        </Link>
                      ) : (
                        <p className="font-medium text-ink">{title}</p>
                      )}
                      <p className="text-xs text-ink-muted">
                        {i.client_name ?? form.company?.name ?? "Cliente por dar de alta"} · {fmtDate(i.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {/* Generado pero sin vacante: la vacante se borró y el levantamiento quedó. */}
                      <Pill tone={i.profile_id ? "mint" : "amber"}>{i.profile_id ? "Perfil generado" : i.status === "generated" ? "Sin vacante" : "Borrador"}</Pill>
                      {!i.profile_id && isAdmin && <CreateProfileForm intakeId={i.id} hasClient={Boolean(i.client_id)} clients={clientOptions} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-forest text-on-forest" : "border border-line bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function MiniCount({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span className="flex flex-col items-center">
      <span className={`text-sm font-semibold ${highlight ? "text-leaf" : "text-ink"}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
    </span>
  );
}
