// Datos de los tres correos automáticos (plan §6.6). Funciones puras: reciben filas de v_pipeline,
// entrevistas y vacantes ya leídas y devuelven lo que pinta cada plantilla. La vista previa en
// Reportes las llama con la sesión del usuario; el cron las llamará con service role filtrando por
// la misma regla (CLAUDE.md, service role).
import { CHANNEL_LABELS, INTERVIEW_TYPE_LABELS, PIPELINE_STAGES, PLATFORM_LABELS, STAGE_LABELS, type Stage } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";
import type { Client, InterviewRow, PipelineRow, ProfileSummary, SourceChannel, StageCounts } from "@/lib/queries/types";
import { attentionReason, needsAttention } from "@/lib/attention";
import { DONE_INTERVIEW, IN_PROCESS, STAGE_ORDER, countStages, dayIndex, isActive, median, reachedOrder } from "@/lib/metrics";
import { fmtDate, fmtTime } from "@/lib/format";

/** Etapas que el cliente ve (plan §2.3): desde Psicométrico. El correo diario no repite contratados. */
export const CLIENT_DAILY_STAGES: Stage[] = ["psychometric", "documents", "client_interview"];
const CLIENT_VISIBLE_FROM = STAGE_ORDER.get("psychometric")!;


// ─── Entrevistas próximas ─────────────────────────────────────────────────

/** Una entrevista agendada, lista para "Mañana a las 10:00 · Ana López · Ejecutivo de cobranza". */
export type UpcomingInterview = {
  id: string;
  application_id: string;
  at: string;
  /** "Hoy", "Mañana" o "Lunes 30 nov", contado desde el día en que sale el correo. */
  day: string;
  time: string;
  candidate: string;
  type: string;
  vacancy: string;
  client: string;
  with: string;
  platform: string;
};

const LIVE_INTERVIEW = new Set(["scheduled", "confirmed"]);
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Entrevistas agendadas o confirmadas entre `from` y `to` días después de `now`, en orden.
 * `now` es la referencia del reporte (ayer en la noche) y el correo sale en `now + 1`:
 * from=1 es "hoy" para quien lo lee y from=2 es "mañana".
 */
export function upcomingInterviews(interviews: InterviewRow[], now: Date, from: number, to: number, keep: (i: InterviewRow) => boolean = () => true): UpcomingInterview[] {
  const ref = dayIndex(now);
  return interviews
    .filter((i) => LIVE_INTERVIEW.has(i.status) && !!i.scheduled_at && keep(i))
    .filter((i) => {
      const d = dayIndex(i.scheduled_at!) - ref;
      return d >= from && d <= to;
    })
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .map((i) => {
      const offset = dayIndex(i.scheduled_at!) - ref;
      return {
        id: i.id,
        application_id: i.application_id,
        at: i.scheduled_at!,
        day: offset === 1 ? "Hoy" : offset === 2 ? "Mañana" : capitalize(fmtDate(i.scheduled_at, { weekday: "long", day: "numeric", month: "short" })),
        time: fmtTime(i.scheduled_at),
        candidate: i.candidate_name,
        type: INTERVIEW_TYPE_LABELS[i.type],
        vacancy: i.profile_title,
        client: i.client_name,
        with: i.type === "client" ? i.client_interviewer_name ?? i.client_name : i.interviewer_name ?? "Sin entrevistador",
        platform: PLATFORM_LABELS[i.platform],
      };
    });
}

// ─── Resumen diario interno ───────────────────────────────────────────────

export type DailyInternalData = {
  date: string;
  vacancies: { id: string; title: string; client_name: string; counts: StageCounts }[];
  totals: { newToday: number; advancedToday: number; hiredToday: number; active: number };
  attention: { application_id: string; name: string; vacancy: string; reason: string; days: number | null }[];
  tomorrow: { id: string; at: string; candidate: string; type: string; vacancy: string; platform: string; with: string }[];
  /** Del día siguiente al envío a una semana: "Mañana a las 10:00…". */
  nextDays: UpcomingInterview[];
};

export function buildDailyInternal(input: { rows: PipelineRow[]; interviews: InterviewRow[]; profiles: ProfileSummary[]; now: Date }): DailyInternalData {
  const { rows, interviews, profiles, now } = input;
  const today = dayIndex(now);
  const isToday = (iso: string | null) => !!iso && dayIndex(iso) === today;
  return {
    date: now.toISOString(),
    vacancies: profiles.map((p) => ({ id: p.id, title: p.title, client_name: p.client_name, counts: countStages(rows.filter((r) => r.profile_id === p.id)) })),
    totals: {
      newToday: rows.filter((r) => isToday(r.applied_at)).length,
      advancedToday: rows.filter((r) => r.stage !== "new" && r.stage !== "discarded" && isToday(r.stage_changed_at)).length,
      hiredToday: rows.filter((r) => r.stage === "hired" && isToday(r.hired_at)).length,
      active: rows.filter(isActive).length,
    },
    attention: rows
      .filter(needsAttention)
      .sort((a, b) => (b.days_in_stage ?? 0) - (a.days_in_stage ?? 0))
      .map((r) => ({ application_id: r.application_id ?? "", name: r.full_name ?? "", vacancy: r.profile_title ?? "", reason: attentionReason(r), days: r.days_in_stage })),
    tomorrow: interviews
      .filter((i) => i.status !== "cancelled" && i.scheduled_at && dayIndex(i.scheduled_at) === today + 1)
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
      .map((i) => ({
        id: i.id,
        at: i.scheduled_at!,
        candidate: i.candidate_name,
        type: INTERVIEW_TYPE_LABELS[i.type],
        vacancy: i.profile_title,
        platform: PLATFORM_LABELS[i.platform],
        with: i.type === "client" ? i.client_interviewer_name ?? i.client_name : i.interviewer_name ?? "Sin entrevistador",
      })),
    nextDays: upcomingInterviews(interviews, now, 2, 7),
  };
}

// ─── Candidatos que avanzaron (diario al cliente) ─────────────────────────

export type ClientCandidateLine = {
  application_id: string;
  name: string;
  age: number | null;
  experience_months: number | null;
  stage: Stage;
  cv_score: number | null;
  interview_score: number | null;
  psych_verdict: Enums<"psych_verdict"> | null;
  docs_validated: number;
  docs_required: number;
  client_interview_at: string | null;
  advanced_today: boolean;
};

export type DailyClientData = {
  date: string;
  client: Pick<Client, "id" | "name" | "contact_name">;
  groups: { vacancy: string; lines: ClientCandidateLine[] }[];
  advancedToday: number;
  /** Entrevistas con el cliente de hoy y mañana (las de Prime no: el cliente ve desde Psicométrico). */
  upcoming: UpcomingInterview[];
};

function toLine(r: PipelineRow, today: number): ClientCandidateLine {
  return {
    application_id: r.application_id ?? "",
    name: r.full_name ?? "",
    age: r.age_reported,
    experience_months: r.experience_months,
    stage: r.stage ?? "psychometric",
    cv_score: r.cv_score,
    interview_score: r.prime_interview_score,
    psych_verdict: r.psych_verdict,
    docs_validated: r.docs_validated ?? 0,
    docs_required: r.docs_required ?? 0,
    client_interview_at: r.client_interview_at,
    advanced_today: !!r.stage_changed_at && dayIndex(r.stage_changed_at) === today,
  };
}

/** Solo entrevistas con el cliente y de sus postulaciones. */
function clientInterviewFilter(rows: PipelineRow[], clientId: string) {
  const apps = new Set(rows.filter((r) => r.client_id === clientId).map((r) => r.application_id));
  return (i: InterviewRow) => i.type === "client" && apps.has(i.application_id);
}

export function buildDailyClient(input: { rows: PipelineRow[]; interviews: InterviewRow[]; client: Pick<Client, "id" | "name" | "contact_name">; now: Date }): DailyClientData {
  const { rows, interviews, client, now } = input;
  const today = dayIndex(now);
  const visible = rows
    .filter((r) => r.client_id === client.id && r.stage && CLIENT_DAILY_STAGES.includes(r.stage))
    .sort((a, b) => (b.stage_order ?? 0) - (a.stage_order ?? 0) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const byVacancy = new Map<string, ClientCandidateLine[]>();
  for (const r of visible) {
    const key = r.profile_title ?? "";
    byVacancy.set(key, [...(byVacancy.get(key) ?? []), toLine(r, today)]);
  }
  return {
    date: now.toISOString(),
    client,
    groups: [...byVacancy.entries()].map(([vacancy, lines]) => ({ vacancy, lines })),
    advancedToday: visible.filter((r) => r.stage_changed_at && dayIndex(r.stage_changed_at) === today).length,
    upcoming: upcomingInterviews(interviews, now, 1, 2, clientInterviewFilter(rows, client.id)),
  };
}

// ─── Reporte semanal al cliente ───────────────────────────────────────────

export type WeeklyClientData = {
  periodStart: string;
  periodEnd: string;
  week: number;
  client: Pick<Client, "id" | "name" | "contact_name">;
  kpis: { newApplications: number; primeInterviews: number; readyForClient: number; hiredWeek: number; hiredTotal: number; openings: number; daysToHire: number | null };
  funnel: { key: Stage; label: string; value: number }[];
  channels: { label: string; applications: number; passedPrime: number }[];
  hiredProfile: { count: number; avgAge: number | null; avgExperience: number | null; topEducation: string | null; bestChannel: string | null; avgCvScore: number | null } | null;
  vacancies: { title: string; hired: number; openings: number; inProcess: number }[];
  nextSteps: string[];
  /** Entrevistas con el cliente de los próximos 7 días. */
  upcoming: UpcomingInterview[];
};

/** Semana ISO 8601 del día (lunes a domingo). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 864e5 + 1) / 7);
}

const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

function mostCommon(values: string[]): string | null {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const dateLong = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeZone: process.env.APP_TIMEZONE ?? "America/Mexico_City", day: "numeric", month: "long" }).format(new Date(iso));

export function nextStepsFor(rows: PipelineRow[]): string[] {
  const inStage = (s: Stage) => rows.filter((r) => r.stage === s);
  return [
    ...inStage("client_interview").map((r) =>
      r.client_interview_at
        ? `Entrevista con ${r.full_name} (${r.profile_title}) el ${dateLong(r.client_interview_at)}; después, Vo.Bo. o no continuar desde el portal.`
        : `Agendar entrevista con ${r.full_name} (${r.profile_title}); su expediente y psicométrico ya están listos.`,
    ),
    ...inStage("documents").map((r) => `${r.full_name} completa su expediente (${r.docs_validated ?? 0} de ${r.docs_required ?? 0} documentos).`),
    ...inStage("psychometric").map((r) => `${r.full_name} está completando su evaluación psicométrica.`),
  ];
}

export function buildWeeklyClient(input: {
  rows: PipelineRow[];
  interviews: InterviewRow[];
  profiles: ProfileSummary[];
  client: Pick<Client, "id" | "name" | "contact_name">;
  now: Date;
}): WeeklyClientData {
  const { interviews, profiles, client, now } = input;
  const rows = input.rows.filter((r) => r.client_id === client.id);
  const today = dayIndex(now);
  const inWeek = (iso: string | null) => !!iso && today - dayIndex(iso) < 7 && today >= dayIndex(iso);
  const apps = new Set(rows.map((r) => r.application_id));
  const hired = rows.filter((r) => r.stage === "hired");
  const clientProfiles = profiles.filter((p) => p.client_id === client.id && p.status === "active");

  const reached = rows.map(reachedOrder);
  const channelKeys = [...new Set(rows.map((r) => r.source_channel).filter((c): c is SourceChannel => !!c))];
  const primeOrder = STAGE_ORDER.get("prime_interview")!;

  const channelHireRate = channelKeys
    .map((c) => {
      const all = rows.filter((r) => r.source_channel === c);
      return { c, rate: all.length ? all.filter((r) => r.stage === "hired").length / all.length : 0, hired: all.filter((r) => r.stage === "hired").length };
    })
    .filter((x) => x.hired > 0)
    .sort((a, b) => b.rate - a.rate);

  return {
    periodStart: new Date(now.getTime() - 6 * 864e5).toISOString(),
    periodEnd: now.toISOString(),
    week: isoWeek(now),
    client,
    kpis: {
      newApplications: rows.filter((r) => inWeek(r.applied_at)).length,
      primeInterviews: interviews.filter((i) => apps.has(i.application_id) && i.type === "prime" && DONE_INTERVIEW.has(i.status) && inWeek(i.scheduled_at)).length,
      readyForClient: rows.filter((r) => r.stage === "client_interview").length,
      hiredWeek: hired.filter((r) => inWeek(r.hired_at)).length,
      hiredTotal: hired.length,
      openings: clientProfiles.reduce((s, p) => s + p.openings, 0),
      daysToHire: median(hired.filter((r) => r.hired_at && r.applied_at).map((r) => dayIndex(r.hired_at!) - dayIndex(r.applied_at!))),
    },
    funnel: PIPELINE_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s], value: reached.filter((o) => o >= STAGE_ORDER.get(s)!).length })),
    channels: channelKeys
      .map((c) => {
        const all = rows.filter((r) => r.source_channel === c);
        return { label: CHANNEL_LABELS[c], applications: all.length, passedPrime: all.filter((r) => reachedOrder(r) > primeOrder).length };
      })
      .sort((a, b) => b.applications - a.applications),
    hiredProfile: hired.length
      ? {
          count: hired.length,
          avgAge: avg(hired.map((r) => r.age_reported).filter((v): v is number => v !== null)),
          avgExperience: avg(hired.map((r) => r.experience_months).filter((v): v is number => v !== null)),
          topEducation: mostCommon(hired.map((r) => r.education_level).filter((v): v is string => !!v)),
          bestChannel: channelHireRate[0] ? CHANNEL_LABELS[channelHireRate[0].c] : null,
          avgCvScore: avg(hired.map((r) => r.cv_score).filter((v): v is number => v !== null)),
        }
      : null,
    vacancies: clientProfiles.map((p) => {
      const pr = rows.filter((r) => r.profile_id === p.id);
      return { title: p.title, hired: pr.filter((r) => r.stage === "hired").length, openings: p.openings, inProcess: pr.filter((r) => r.stage && IN_PROCESS.includes(r.stage)).length };
    }),
    nextSteps: nextStepsFor(rows.filter((r) => reachedOrder(r) >= CLIENT_VISIBLE_FROM && r.stage !== "discarded")),
    upcoming: upcomingInterviews(interviews, now, 1, 7, clientInterviewFilter(rows, client.id)),
  };
}
