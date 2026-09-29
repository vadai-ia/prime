import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { listInterviews } from "@/lib/queries/interviews";
import { listPipeline } from "@/lib/queries/pipeline";
import { listStaff } from "@/lib/queries/users";
import { DONE_INTERVIEW, dayIndex, dayToIso } from "@/lib/metrics";
import { RecruiterFilter } from "@/components/filters/recruiter-filter";
import type { InterviewRow } from "@/lib/queries/types";
import { INTERVIEW_STATUS_LABELS, INTERVIEW_STATUS_TONES as STATUS_TONE, INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Entrevistas · Prime HR Innovation" };

type Search = Record<string, string | string[] | undefined>;

/** Resumen de la semana en curso (lunes a domingo, zona de la app), como el de la demo. */
function weekSummary(all: InterviewRow[], now: Date) {
  const today = dayIndex(now);
  const weekday = (new Date(dayToIso(today)).getUTCDay() + 6) % 7; // 0 = lunes
  const start = today - weekday;
  const inWeek = all.filter((i) => i.scheduled_at && dayIndex(i.scheduled_at) >= start && dayIndex(i.scheduled_at) < start + 7);
  const done = inWeek.filter((i) => DONE_INTERVIEW.has(i.status));
  return {
    done: done.length,
    analyzed: done.filter((i) => i.status === "analyzed").length,
    scheduled: inWeek.filter((i) => (i.status === "scheduled" || i.status === "confirmed") && (i.scheduled_at ?? "") >= now.toISOString()).length,
    avgMinutes: done.length ? Math.round(done.reduce((s, i) => s + i.duration_min, 0) / done.length) : null,
    noShows: inWeek.filter((i) => i.status === "no_show").length,
  };
}

function dayTitle(iso: string | null, today: number): string {
  const d = iso ? dayIndex(iso) : today;
  const label = fmtDate(iso, { weekday: "long", day: "numeric", month: "long" });
  return d === today ? `Hoy · ${label}` : d === today + 1 ? `Mañana · ${label}` : label;
}

export default async function EntrevistasPage(props: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  const isAdmin = can(session.role, "manage_assignments");
  const sp = await props.searchParams;
  const recruiterParam = isAdmin && typeof sp.reclutador === "string" ? sp.reclutador : "";

  const [all, pipeline, staff] = await Promise.all([
    listInterviews("all"),
    recruiterParam ? listPipeline({ includeDiscarded: true }) : Promise.resolve([]),
    isAdmin ? listStaff() : Promise.resolve([]),
  ]);

  // Filtro de admin por el reclutador dueño del candidato (el mismo que usa el Tablero).
  const owned = new Set(
    pipeline.filter((r) => (recruiterParam === "sin-asignar" ? r.assigned_recruiter_id === null : r.assigned_recruiter_id === recruiterParam)).map((r) => r.application_id),
  );
  const interviews = recruiterParam ? all.filter((i) => owned.has(i.application_id)) : all;

  const now = new Date();
  const nowIso = now.toISOString();
  const today = dayIndex(now);
  const upcoming = interviews.filter((i) => (i.scheduled_at ?? "") >= nowIso && i.status !== "cancelled").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const past = interviews.filter((i) => (i.scheduled_at ?? "") < nowIso).sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""));
  const week = weekSummary(interviews, now);
  const recruiters = staff.filter((s) => s.role === "recruiter").map((s) => ({ id: s.id, full_name: s.full_name }));

  const byDay = upcoming.reduce<Map<string, InterviewRow[]>>((acc, iv) => {
    const key = dayTitle(iv.scheduled_at, today);
    acc.set(key, [...(acc.get(key) ?? []), iv]);
    return acc;
  }, new Map());

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Entrevistas"
        subtitle="Agenda de entrevistas Prime y con cliente. Se agendan y reagendan desde la ficha del candidato."
        actions={isAdmin ? <RecruiterFilter action="/entrevistas" recruiters={recruiters} value={recruiterParam} /> : undefined}
      />

      <h2 className="mb-3 text-sm font-medium text-ink-muted">Esta semana</h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realizadas" value={week.done} tone="leaf" hint={`${week.analyzed} analizadas por la IA`} />
        <Stat label="Programadas" value={week.scheduled} tone="forest" hint={`${upcoming.length} próximas en total`} />
        <Stat label="Duración promedio" value={week.avgMinutes === null ? "—" : `${week.avgMinutes} min`} hint="De las realizadas" />
        <Stat label="No se presentaron" value={week.noShows} tone={week.noShows > 0 ? "danger" : "ink"} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium text-ink">Próximas</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="Sin entrevistas agendadas" hint="Se agendan desde la ficha del candidato." />
        ) : (
          <div className="space-y-5">
            {[...byDay.entries()].map(([day, items]) => (
              <Card key={day} title={<span className="first-letter:uppercase">{day}</span>} padded={false}>
                <ul className="divide-y divide-line">
                  {items.map((iv) => (
                    <li key={iv.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                      <span className="w-14 shrink-0 font-semibold text-forest">{fmtTime(iv.scheduled_at)}</span>
                      <Avatar name={iv.candidate_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/candidatos/${iv.application_id}`} className="font-medium text-ink hover:text-forest">
                          {iv.candidate_name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {iv.profile_title} · {iv.client_name}
                        </p>
                      </div>
                      <span className="text-xs text-ink-muted">{INTERVIEW_TYPE_LABELS[iv.type]}</span>
                      <Pill tone={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABELS[iv.status]}</Pill>
                      <span className="text-xs text-ink-muted">{iv.client_interviewer_name ?? iv.interviewer_name ?? "—"}</span>
                      {iv.meeting_url && (
                        <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline">
                          {iv.platform === "zoom" ? "Zoom" : "Meet"} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Link href={`/candidatos/${iv.application_id}?tab=entrevista`} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:bg-canvas hover:text-ink">
                        Reagendar
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium text-ink">Pasadas</h2>
        {past.length === 0 ? (
          <EmptyState title="Sin entrevistas pasadas" />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 font-semibold">Candidato</th>
                  <th className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Score</th>
                  <th className="px-4 py-2.5 font-semibold">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {past.map((iv) => (
                  <tr key={iv.id} className="transition hover:bg-canvas">
                    <td className="px-4 py-3 text-ink-muted">{fmtDateTime(iv.scheduled_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{iv.candidate_name}</p>
                      <p className="text-xs text-ink-muted">
                        {iv.profile_title} · {iv.client_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{INTERVIEW_TYPE_LABELS[iv.type]}</td>
                    <td className="px-4 py-3">
                      <Pill tone={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABELS[iv.status]}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">{iv.score ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/candidatos/${iv.application_id}?tab=entrevista`} className="text-forest hover:underline">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
