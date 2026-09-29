import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Bar } from "@/components/ui/bar";
import { Pill, StagePill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendChart } from "@/components/charts/trend-chart";
import { getCurrentUser, requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { countStages, listPipeline } from "@/lib/queries/pipeline";
import { attentionReason, needsAttention } from "@/lib/attention";
import { listProfiles } from "@/lib/queries/profiles";
import { listInterviews } from "@/lib/queries/interviews";
import { listStaff } from "@/lib/queries/users";
import { INTERVIEW_TYPE_LABELS, PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import { daysLabel, fmtDate, fmtDateLong, fmtPct, fmtTime } from "@/lib/format";
import type { InterviewRow, ProfileSummary, StageCounts } from "@/lib/queries/types";
import { IN_PROCESS, STALE_DAYS, dayIndex, indicators, kpis, recruiterLoad, stageConversion, staleRows, weeklyTrend } from "./metrics";
import { RecruiterFilter } from "@/components/filters/recruiter-filter";
import { CLIENT_DAILY_STAGES, buildDailyInternal } from "@/lib/email/data";

export const metadata: Metadata = { title: "Tablero · Prime HR Innovation" };

const TZ = process.env.APP_TIMEZONE ?? "America/Mexico_City";

const SEGMENT_CLASS: Record<Stage, string> = {
  new: "bg-ink-faint",
  prefilter: "bg-info/60",
  cv_review: "bg-info",
  prime_interview: "bg-amber/60",
  psychometric: "bg-amber",
  documents: "bg-leaf/60",
  client_interview: "bg-leaf",
  hired: "bg-forest",
  discarded: "bg-danger",
};

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

function ProfileStrip({ profile, counts }: { profile: ProfileSummary; counts: StageCounts }) {
  const inProcess = IN_PROCESS.reduce((s, st) => s + counts[st], 0);
  const total = inProcess + counts.hired;
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/perfiles/${profile.id}`} className="block truncate text-sm font-medium text-ink hover:text-forest">
            {profile.title}
          </Link>
          <p className="text-xs text-ink-muted">
            {profile.client_name} · {inProcess} en proceso · {counts.discarded} descartados
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-ink">
            {counts.hired}/{profile.openings}
          </p>
          <p className="text-[11px] text-ink-faint">cubiertas</p>
        </div>
      </div>
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-canvas">
        {PIPELINE_STAGES.filter((st) => counts[st] > 0).map((st) => (
          <div key={st} title={`${STAGE_LABELS[st]}: ${counts[st]}`} className={`h-full ${SEGMENT_CLASS[st]}`} style={{ width: `${total > 0 ? (counts[st] / total) * 100 : 0}%` }} />
        ))}
      </div>
    </li>
  );
}

function StageLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-5 py-3">
      {PIPELINE_STAGES.map((st) => (
        <span key={st} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className={`inline-block size-2.5 rounded-sm ${SEGMENT_CLASS[st]}`} />
          {STAGE_LABELS[st]}
        </span>
      ))}
    </div>
  );
}

function Indicator({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>
      <p className="shrink-0 text-lg font-semibold text-forest">{value}</p>
    </div>
  );
}

function AgendaItem({ i }: { i: InterviewRow }) {
  return (
    <li>
      <Link href={`/candidatos/${i.application_id}`} className="flex gap-3 px-5 py-3 transition hover:bg-canvas">
        <p className="w-16 shrink-0 text-sm font-semibold text-forest">{fmtTime(i.scheduled_at)}</p>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{i.candidate_name}</p>
          <p className="truncate text-xs text-ink-muted">
            {INTERVIEW_TYPE_LABELS[i.type]} · {i.profile_title}
          </p>
          <p className="truncate text-[11px] text-ink-faint">{i.type === "client" ? i.client_interviewer_name ?? i.client_name : i.interviewer_name ?? "Sin asignar"}</p>
        </div>
      </Link>
    </li>
  );
}

type Search = Record<string, string | string[] | undefined>;

export default async function TableroPage(props: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  const isAdmin = can(session.role, "manage_assignments");
  const sp = await props.searchParams;
  const recruiterParam = isAdmin && typeof sp.reclutador === "string" ? sp.reclutador : "";

  const [user, allRows, allInterviews, profiles, staff] = await Promise.all([
    getCurrentUser(),
    listPipeline({ includeDiscarded: true }),
    listInterviews("all"),
    listProfiles({ status: "active" }),
    isAdmin ? listStaff() : Promise.resolve([]),
  ]);

  // El filtro por reclutador es de admin; al reclutador RLS ya le devuelve solo lo suyo.
  const rows = recruiterParam
    ? allRows.filter((r) => (recruiterParam === "sin-asignar" ? r.assigned_recruiter_id === null : r.assigned_recruiter_id === recruiterParam))
    : allRows;
  const visibleApps = new Set(rows.map((r) => r.application_id));
  const interviews = recruiterParam ? allInterviews.filter((i) => visibleApps.has(i.application_id)) : allInterviews;

  const now = new Date();
  const today = dayIndex(now);
  const k = kpis(rows, interviews, now);
  const ind = indicators(rows, now);
  const trend = weeklyTrend(rows, interviews, now);
  const conversion = stageConversion(rows);
  const load = isAdmin && !recruiterParam ? recruiterLoad(rows, now) : [];
  const stale = staleRows(rows).slice(0, 6);
  const attention = rows.filter(needsAttention).sort((a, b) => (b.days_in_stage ?? 0) - (a.days_in_stage ?? 0));

  // Hoy completo (también las que ya pasaron, como la agenda de la demo) y, debajo, las siguientes.
  const scheduled = interviews
    .filter((i) => i.status !== "cancelled" && i.scheduled_at && dayIndex(i.scheduled_at) >= today)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const agendaToday = scheduled.filter((i) => dayIndex(i.scheduled_at!) === today);
  const agendaNext = scheduled.filter((i) => dayIndex(i.scheduled_at!) > today).slice(0, Math.max(2, 5 - agendaToday.length));

  const countsByProfile = new Map(profiles.map((p) => [p.id, countStages(rows.filter((r) => r.profile_id === p.id))]));
  const shownProfiles = recruiterParam ? profiles.filter((p) => rows.some((r) => r.profile_id === p.id)) : profiles;
  const conversionMax = Math.max(1, conversion[0]?.reached ?? 0);
  const loadMax = Math.max(1, ...load.map((l) => l.inProcess));
  const recruiters = staff.filter((s) => s.role === "recruiter").map((s) => ({ id: s.id, full_name: s.full_name }));
  const firstName = user.full_name?.split(" ")[0] ?? "";
  const daily = buildDailyInternal({ rows, interviews, profiles: shownProfiles, now });
  const forClients = rows.filter((r) => r.stage && CLIENT_DAILY_STAGES.includes(r.stage));
  const clientsWithNews = new Set(forClients.map((r) => r.client_id)).size;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${greeting(now)}${firstName ? `, ${firstName}` : ""}`}
        subtitle={`${fmtDateLong(now.toISOString())} · ${k.active} ${k.active === 1 ? "candidato" : "candidatos"} en proceso en ${shownProfiles.length} ${shownProfiles.length === 1 ? "vacante activa" : "vacantes activas"}`}
        actions={isAdmin ? <RecruiterFilter action="/tablero" recruiters={recruiters} value={recruiterParam} /> : undefined}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Nuevos hoy" value={k.newToday} hint="Postulaciones recibidas hoy" tone="forest" />
        <Stat label="En prefiltro" value={k.inPrefilter} hint="Respondiendo las preguntas del perfil" />
        <Stat label="Entrevistas hoy" value={k.interviewsToday} hint="Prime y con cliente" />
        <Stat label="Psicométricos por completar" value={k.psychPending} hint="Sin enviar o sin respuesta" tone={k.psychPending ? "amber" : "ink"} />
        <Stat label="Expedientes en captura" value={k.docsInProgress} hint={k.docsMissing ? `Faltan ${k.docsMissing} documentos en total` : "Sin documentos pendientes"} />
        <Stat label="Contratados esta semana" value={k.hiredThisWeek} hint="Últimos 7 días" tone="leaf" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Tendencia" subtitle="Últimas 8 semanas: postulaciones, entrevistas realizadas y contrataciones">
            <TrendChart data={trend} />
          </Card>

          <Card title="Requiere tu atención" subtitle="Lo que el agente no puede resolver solo" padded={false}>
            {attention.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nada pendiente por ahora" hint="Las excepciones del prefiltro, documentos por revisar y conversaciones pausadas aparecen aquí." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {attention.slice(0, 8).map((r) => (
                  <li key={r.application_id}>
                    <Link href={`/candidatos/${r.application_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-canvas">
                      <Avatar name={r.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {r.profile_title} · {r.client_name}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-xs font-medium text-amber">{attentionReason(r)}</p>
                        <p className="text-[11px] text-ink-faint">{daysLabel(r.days_in_stage)} en etapa</p>
                      </div>
                      <StagePill stage={r.stage} />
                    </Link>
                  </li>
                ))}
                {attention.length > 8 && <li className="px-5 py-2.5 text-xs text-ink-muted">Y {attention.length - 8} más.</li>}
              </ul>
            )}
          </Card>

          <Card
            title="Vacantes activas"
            subtitle="Candidatos por etapa y vacantes cubiertas"
            action={
              <Link href="/perfiles" className="text-xs text-forest hover:underline">
                Ver todas
              </Link>
            }
            padded={false}
          >
            {shownProfiles.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sin vacantes activas" hint={recruiterParam ? "Este reclutador no tiene candidatos en vacantes activas." : "Crea un levantamiento para abrir la primera."} />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line px-5">
                  {shownProfiles.map((p) => (
                    <ProfileStrip key={p.id} profile={p} counts={countsByProfile.get(p.id)!} />
                  ))}
                </ul>
                <StageLegend />
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Agenda"
            subtitle={agendaToday.length ? `${agendaToday.length} ${agendaToday.length === 1 ? "entrevista" : "entrevistas"} hoy` : "Sin entrevistas hoy"}
            action={
              <Link href="/entrevistas" className="text-xs text-forest hover:underline">
                Ver agenda
              </Link>
            }
            padded={false}
          >
            {agendaToday.length === 0 && agendaNext.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sin entrevistas próximas" />
              </div>
            ) : (
              <>
                {agendaToday.length > 0 && (
                  <ul className="divide-y divide-line">
                    {agendaToday.map((i) => (
                      <AgendaItem key={i.id} i={i} />
                    ))}
                  </ul>
                )}
                {agendaNext.length > 0 && (
                  <>
                    <p className="border-t border-line bg-canvas px-5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Próximas</p>
                    <ul className="divide-y divide-line">
                      {agendaNext.map((i) => (
                        <li key={i.id}>
                          <Link href={`/candidatos/${i.application_id}`} className="block px-5 py-3 transition hover:bg-canvas">
                            <p className="text-xs font-medium text-forest">{fmtDate(i.scheduled_at, { weekday: "short" })} · {fmtTime(i.scheduled_at)}</p>
                            <p className="mt-0.5 truncate text-sm font-medium text-ink">{i.candidate_name}</p>
                            <p className="truncate text-xs text-ink-muted">
                              {INTERVIEW_TYPE_LABELS[i.type]} · {i.profile_title}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Card>

          <Card title="Indicadores" subtitle="Últimos 90 días">
            <div className="divide-y divide-line">
              <Indicator
                label="Días a contratación"
                value={ind.daysToHire === null ? "—" : `${Math.round(ind.daysToHire)} d`}
                hint={ind.hiresInWindow ? `Mediana de ${ind.hiresInWindow} ${ind.hiresInWindow === 1 ? "contratación" : "contrataciones"}, de postulación a contratado` : "Aún no hay contrataciones"}
              />
              <Indicator
                label="Llegan a contratación"
                value={ind.hireRate === null ? "—" : fmtPct(ind.hireRate)}
                hint={`De ${ind.applicationsInWindow} ${ind.applicationsInWindow === 1 ? "postulación" : "postulaciones"} recibidas`}
              />
              <Indicator label="Estancados" value={String(ind.stale)} hint="Más días de los esperados en su etapa" />
            </div>
          </Card>

          <Card title="Conversión entre etapas" subtitle="Cuántos llegan a cada etapa y qué parte pasa desde la anterior">
            {conversion[0]?.reached ? (
              <div className="space-y-3">
                {conversion.map((c) => (
                  <div key={c.key}>
                    <div className="mb-1 flex justify-between text-xs text-ink-muted">
                      <span>{c.label}</span>
                      <span className="text-ink">
                        {c.reached}
                        {c.fromPrev !== null && <span className="ml-1.5 text-ink-faint">{fmtPct(c.fromPrev)}</span>}
                      </span>
                    </div>
                    <Bar value={c.reached} max={conversionMax} tone={c.key === "hired" ? "forest" : "leaf"} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin postulaciones todavía" />
            )}
          </Card>

          {load.length > 0 && (
            <Card title="Carga por reclutador" subtitle="En proceso, estancados y contratados en 30 días" padded={false}>
              <ul className="divide-y divide-line">
                {load.map((l) => (
                  <li key={l.id ?? "none"}>
                    <Link href={`/tablero?reclutador=${l.id ?? "sin-asignar"}`} className="block px-5 py-3 transition hover:bg-canvas">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`truncate text-sm font-medium ${l.id ? "text-ink" : "text-ink-muted"}`}>{l.name}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {l.stale > 0 && <Pill tone="amber">{l.stale} estancados</Pill>}
                          {l.hired30 > 0 && <Pill tone="forest">{l.hired30} contratados</Pill>}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Bar value={l.inProcess} max={loadMax} tone={l.id ? "leaf" : "neutral"} className="flex-1" />
                        <span className="w-8 text-right text-xs text-ink">{l.inProcess}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Estancados" subtitle="Llevan más días de lo esperado en su etapa" padded={false}>
            {stale.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nadie estancado" hint="Todos se están moviendo a buen ritmo." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {stale.map((r) => (
                  <li key={r.application_id}>
                    <Link href={`/candidatos/${r.application_id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-canvas">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {r.stage ? STAGE_LABELS[r.stage] : ""} · {r.profile_title}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-medium text-amber">
                        {daysLabel(r.days_in_stage)}
                        <span className="font-normal text-ink-faint"> / {r.stage ? STALE_DAYS[r.stage] : "—"}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Resumen diario interno" action={<Pill tone="mint">Se envía a las 18:00</Pill>}>
          <p className="text-sm leading-relaxed text-ink">
            {daily.totals.newToday === 1 ? "Hoy llegó 1 postulación" : `Hoy llegaron ${daily.totals.newToday} postulaciones`}, {daily.totals.advancedToday} {daily.totals.advancedToday === 1 ? "candidato avanzó" : "candidatos avanzaron"} de etapa y {attention.length}{" "}
            {attention.length === 1 ? "espera" : "esperan"} decisión del reclutador. Mañana hay {daily.tomorrow.length} {daily.tomorrow.length === 1 ? "entrevista" : "entrevistas"}.
          </p>
          <Link href="/reportes?correo=interno" className="mt-3 inline-block text-sm font-medium text-forest hover:underline">
            Ver el correo completo
          </Link>
        </Card>
        <Card title="Envío diario a clientes" action={<Pill tone="mint">A la hora de cada cliente</Pill>}>
          <p className="text-sm leading-relaxed text-ink">
            {forClients.length} {forClients.length === 1 ? "candidato está" : "candidatos están"} de psicométrico en adelante en {clientsWithNews} {clientsWithNews === 1 ? "cliente" : "clientes"}. Cada cliente recibe solo los suyos, con score de CV, entrevista, psicométrico y avance del expediente.
          </p>
          <Link href="/reportes?correo=cliente" className="mt-3 inline-block text-sm font-medium text-forest hover:underline">
            Ver el correo al cliente
          </Link>
        </Card>
      </div>
    </div>
  );
}
