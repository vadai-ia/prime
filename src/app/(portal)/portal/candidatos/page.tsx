import type { Metadata } from "next";
import Link from "next/link";
import { listPortalApplications } from "@/lib/queries/portal";
import type { PortalApplication } from "@/lib/queries/types";
import { PSYCH_VERDICT_LABELS, PSYCH_VERDICT_TONES, STAGE_LABELS, type Stage } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Pill, StagePill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Candidatos · Portal Prime HR" };

const CLIENT_STAGES: Stage[] = ["psychometric", "documents", "client_interview", "hired", "discarded"];

export default async function PortalCandidatesPage(props: PageProps<"/portal/candidatos">) {
  const params = await props.searchParams;
  const stageParam = typeof params.stage === "string" ? params.stage : undefined;
  const stage = CLIENT_STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : undefined;

  const all = await listPortalApplications();
  const rows = stage ? all.filter((a) => a.stage === stage) : all;

  const groups = new Map<string, PortalApplication[]>();
  for (const a of rows) {
    const key = a.profile_title ?? "Sin vacante";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const countFor = (s: Stage) => all.filter((a) => a.stage === s).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Candidatos</h1>
        <p className="mt-1 text-sm text-ink-muted">Todos los candidatos que ya pasaron la entrevista con Prime, agrupados por vacante.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/portal/candidatos" active={!stage} label="Todos" count={all.length} />
        {CLIENT_STAGES.map((s) => (
          <FilterChip key={s} href={`/portal/candidatos?stage=${s}`} active={stage === s} label={STAGE_LABELS[s]} count={countFor(s)} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Sin candidatos en esta etapa" hint="Prueba con otro filtro o vuelve más tarde." />
      ) : (
        Array.from(groups.entries()).map(([title, list]) => (
          <section key={title} className="rounded-card border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              <span className="text-xs text-ink-muted">
                {list.length} {list.length === 1 ? "candidato" : "candidatos"}
              </span>
            </header>
            <ul className="divide-y divide-line">
              {list.map((a) => (
                <li key={a.application_id}>
                  <Link href={`/portal/candidatos/${a.application_id}`} className="flex flex-wrap items-center gap-4 px-5 py-3 transition hover:bg-canvas">
                    <Avatar name={a.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.full_name}</p>
                      <p className="text-xs text-ink-muted">
                        {[a.zone ?? a.municipality, a.education_level].filter(Boolean).join(" · ") || "Sin datos de ubicación"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      {a.psych_verdict ? (
                        <Pill tone={PSYCH_VERDICT_TONES[a.psych_verdict]}>{PSYCH_VERDICT_LABELS[a.psych_verdict]}</Pill>
                      ) : (
                        <Pill>Psicométrico en proceso</Pill>
                      )}
                      <span className="whitespace-nowrap">
                        Documentos {a.docs_validated ?? 0}/{a.docs_required ?? 10}
                      </span>
                      {a.client_interview_at && <span className="whitespace-nowrap">Entrevista {fmtDate(a.client_interview_at)}</span>}
                      <StagePill stage={a.stage} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-forest bg-forest text-on-forest" : "border-line bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      {label}
      <span className={active ? "text-on-forest/70" : "text-ink-faint"}>{count}</span>
    </Link>
  );
}
