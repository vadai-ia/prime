import type { Metadata } from "next";
import Link from "next/link";
import { listPortalApplications, listPortalProfiles } from "@/lib/queries/portal";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_TONES } from "@/lib/labels";
import { Clock } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/format";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Pill, StagePill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Coverage } from "@/components/ui/coverage";

export const metadata: Metadata = { title: "Portal · Prime HR Innovation" };

const IN_PROCESS = new Set(["psychometric", "documents", "client_interview"]);

export default async function PortalHome() {
  const [applications, profiles] = await Promise.all([listPortalApplications(), listPortalProfiles()]);

  const inProcess = applications.filter((a) => a.stage && IN_PROCESS.has(a.stage));
  const pending = applications.filter((a) => a.stage === "client_interview");
  const hired = applications.filter((a) => a.stage === "hired");
  const activeProfiles = profiles.filter((p) => p.status === "active");
  const recent = applications
    .slice()
    .sort((a, b) => (b.stage_changed_at ?? "").localeCompare(a.stage_changed_at ?? ""))
    .slice(0, 6);

  const nowIso = new Date().toISOString();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tu proceso de reclutamiento</h1>
        <p className="mt-1 text-sm text-ink-muted">Candidatos que ya pasaron la entrevista con Prime y están listos para ti.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Candidatos en proceso" value={inProcess.length} tone="forest" />
        <Stat label="Pendientes de tu decisión" value={pending.length} tone={pending.length ? "amber" : "ink"} hint={pending.length ? "Esperan tu Vo.Bo." : "Nada por decidir"} />
        <Stat label="Contratados" value={hired.length} tone="leaf" />
        <Stat label="Vacantes activas" value={activeProfiles.length} />
      </section>

      <Card title="Pendientes de tu decisión" subtitle="Candidatos en entrevista con tu equipo: da tu Vo.Bo. o indica que no continúen." padded={false}>
        {pending.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-muted">No tienes candidatos pendientes de decisión por ahora.</div>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((a) => (
              <li key={a.application_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Link href={`/portal/candidatos/${a.application_id}`} className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink hover:text-forest">{a.full_name}</p>
                    <p className="text-xs text-ink-muted">
                      {a.profile_title}
                      {a.client_interview_at ? ` · Entrevista ${fmtDate(a.client_interview_at)}` : " · Sin entrevista agendada"}
                    </p>
                  </div>
                </Link>
                <ButtonLink href={`/portal/candidatos/${a.application_id}`}>Decidir</ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Tus vacantes</h2>
        {profiles.length === 0 ? (
          <EmptyState title="Aún no hay vacantes" hint="Cuando Prime dé de alta una vacante para tu empresa, aparecerá aquí." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {profiles.map((p) => {
              const apps = applications.filter((a) => a.profile_id === p.id);
              const hiredHere = apps.filter((a) => a.stage === "hired").length;
              const inProcessHere = apps.filter((a) => a.stage && IN_PROCESS.has(a.stage)).length;
              const ready = apps.filter((a) => a.stage === "client_interview");
              const interviews = ready.filter((a) => a.client_interview_at && a.client_interview_at >= nowIso).sort((a, b) => (a.client_interview_at ?? "").localeCompare(b.client_interview_at ?? ""));
              return (
                <li key={p.id} className="rounded-card border border-line bg-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{p.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{p.work_zone ?? "Sin zona"}</p>
                    </div>
                    <Pill tone={PROFILE_STATUS_TONES[p.status]}>{PROFILE_STATUS_LABELS[p.status]}</Pill>
                  </div>
                  <div className="mt-3">
                    <Coverage hired={hiredHere} openings={p.openings} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dd className="text-xl font-semibold text-ink">{inProcessHere}</dd>
                      <dt className="text-[11px] text-ink-muted">en proceso</dt>
                    </div>
                    <div>
                      <dd className={`text-xl font-semibold ${ready.length ? "text-amber" : "text-ink"}`}>{ready.length}</dd>
                      <dt className="text-[11px] text-ink-muted">listos para ti</dt>
                    </div>
                    <div>
                      <dd className="text-xl font-semibold text-ink">{interviews.length}</dd>
                      <dt className="text-[11px] text-ink-muted">entrevistas agendadas</dt>
                    </div>
                  </dl>
                  {interviews.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {interviews.map((a) => (
                        <li key={a.application_id}>
                          <Link href={`/portal/candidatos/${a.application_id}`} className="flex items-center gap-2 rounded-lg bg-mint/60 px-2.5 py-1.5 text-xs text-ink hover:bg-mint">
                            <Clock className="size-3.5 shrink-0 text-forest" aria-hidden />
                            <span className="font-medium">{fmtDate(a.client_interview_at, { weekday: "short" })} {fmtTime(a.client_interview_at)}</span>
                            <span className="truncate">· {a.full_name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card title="Últimos avances" subtitle="Movimientos recientes de tus candidatos." padded={false} action={<Link href="/portal/candidatos" className="text-sm text-forest hover:underline">Ver todos</Link>}>
        {recent.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Aún no hay candidatos que hayan pasado la entrevista con Prime.</div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.application_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link href={`/portal/candidatos/${a.application_id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink hover:text-forest">{a.full_name}</p>
                  <p className="text-xs text-ink-muted">{a.profile_title}</p>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint">{fmtDate(a.stage_changed_at)}</span>
                  <StagePill stage={a.stage} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
