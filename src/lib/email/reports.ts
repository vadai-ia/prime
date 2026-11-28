import "server-only";
import { createElement, type ReactElement } from "react";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/db/types";
import type { Client, InterviewRow, PipelineRow, ProfileSummary } from "@/lib/queries/types";
import { countStages } from "@/lib/metrics";
import { utcIsoToZoned, zonedToUtcIso } from "@/lib/domain/time";
import { buildDailyClient, buildDailyInternal, buildWeeklyClient } from "./data";
import { DailyClientEmail, DailyInternalEmail, WeeklyClientEmail, dailyClientSubject, dailyInternalSubject, weeklyClientSubject } from "./templates";
import { emailEnabled, emailStatus, EmailError, sendEmail, type Attachment } from "./send";
import { addDays, localDow, reportReferenceNow } from "./schedule";

export { reportReferenceNow };

// Los tres correos automáticos (plan §12.23). Salen con el cron de las 8:00 y cuentan el día (o la
// semana) que terminó ayer. Corren con service role, así que la visibilidad se aplica aquí a mano
// (CLAUDE.md): el admin recibe todo, cada reclutador solo las vacantes que tiene asignadas y cada
// cliente solo lo suyo desde Psicométrico (buildDailyClient / buildWeeklyClient ya filtran).
// Cada envío queda en report_runs; antes de mandar se busca ahí el mismo periodo y destinatarios,
// así que un reintento no duplica correos.

type Admin = ReturnType<typeof createAdminClient>;
type ReportType = Enums<"report_type">;
export type Outcome = { ok: true; detail: string } | { ok: false; error: string; retry: boolean };

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.primehrinnovation.com.mx";

// ---------------------------------------------------------------------------
// Lecturas con service role (mismas formas que src/lib/queries, sin sesión)
// ---------------------------------------------------------------------------

async function loadPipeline(admin: Admin): Promise<PipelineRow[]> {
  const { data, error } = await admin.from("v_pipeline").select("*").order("stage_order").order("stage_changed_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function loadInterviews(admin: Admin): Promise<InterviewRow[]> {
  const { data, error } = await admin
    .from("interviews")
    .select("*, applications!inner(stage, candidates(full_name), job_profiles(title, clients(name))), users!interviews_interviewer_user_id_fkey(full_name)")
    .order("scheduled_at");
  if (error) throw error;
  return data.map(({ applications, users, ...i }) => ({
    ...i,
    candidate_name: applications.candidates?.full_name ?? "",
    profile_title: applications.job_profiles?.title ?? "",
    client_name: applications.job_profiles?.clients?.name ?? "",
    interviewer_name: users?.full_name ?? null,
    stage: applications.stage,
  }));
}

async function loadActiveProfiles(admin: Admin, rows: PipelineRow[]): Promise<ProfileSummary[]> {
  const { data, error } = await admin
    .from("job_profiles")
    .select("id, client_id, title, status, openings, work_zone, created_at, clients(name), job_profile_ai_configs(cv_threshold)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    title: p.title,
    status: p.status,
    openings: p.openings,
    work_zone: p.work_zone,
    created_at: p.created_at,
    client_name: p.clients?.name ?? "",
    counts: countStages(rows.filter((r) => r.profile_id === p.id)),
    cv_threshold: p.job_profile_ai_configs?.cv_threshold ?? null,
    recruiters: [],
  }));
}

// ---------------------------------------------------------------------------
// Render, envío y registro
// ---------------------------------------------------------------------------

async function renderHtml(element: ReactElement): Promise<string> {
  // Import dinámico: react-dom/server solo se carga en la corrida del cron, no en las páginas.
  const { renderToStaticMarkup } = await import("react-dom/server");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${renderToStaticMarkup(element)}</body></html>`;
}

const clean = (list: (string | null | undefined)[]) => [...new Set(list.map((e) => (e ?? "").trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].sort();

/** Destinatarios del cliente: los de report_recipients o, si no hay, el contacto. */
export function clientRecipients(client: Pick<Client, "report_recipients" | "contact_email">): string[] {
  return clean(client.report_recipients.length ? client.report_recipients : [client.contact_email]);
}

type Delivery = {
  type: ReportType;
  clientId: string | null;
  periodStart: Date;
  periodEnd: Date;
  to: string[];
  subject: string;
  element: ReactElement;
  pdf?: () => Promise<Attachment>;
};

/** "sent" si salió ahora, "skipped" si ese mismo reporte ya había salido. */
async function deliver(admin: Admin, d: Delivery): Promise<"sent" | "skipped"> {
  let prior = admin
    .from("report_runs")
    .select("id")
    .eq("type", d.type)
    .eq("period_start", d.periodStart.toISOString())
    .eq("status", "sent")
    .contains("recipients", d.to)
    .containedBy("recipients", d.to);
  prior = d.clientId ? prior.eq("client_id", d.clientId) : prior.is("client_id", null);
  const { data: already, error: priorError } = await prior.limit(1);
  if (priorError) throw priorError;
  if ((already ?? []).length > 0) return "skipped";

  const { data: run, error: runError } = await admin
    .from("report_runs")
    .insert({ type: d.type, client_id: d.clientId, period_start: d.periodStart.toISOString(), period_end: d.periodEnd.toISOString(), recipients: d.to, subject: d.subject, status: "pending" })
    .select("id")
    .single();
  if (runError || !run) throw runError ?? new Error("No se pudo registrar el reporte");

  try {
    const html = await renderHtml(d.element);
    const attachments: Attachment[] = [];
    let pdfPath: string | null = null;
    if (d.pdf) {
      const file = await d.pdf();
      attachments.push(file);
      pdfPath = `${d.clientId ?? "interno"}/${run.id}.pdf`;
      const { error: uploadError } = await admin.storage.from("reports").upload(pdfPath, file.content, { contentType: "application/pdf", upsert: true });
      if (uploadError) {
        console.error("[reports] no se guardó el PDF", uploadError.message);
        pdfPath = null;
      }
    }
    await admin.from("report_runs").update({ status: "rendered", pdf_path: pdfPath }).eq("id", run.id);
    const { id } = await sendEmail({ to: d.to, subject: d.subject, html, attachments });
    await admin.from("report_runs").update({ status: "sent", sent_at: new Date().toISOString(), resend_message_id: id }).eq("id", run.id);
    return "sent";
  } catch (e) {
    await admin
      .from("report_runs")
      .update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) })
      .eq("id", run.id);
    throw e;
  }
}

function failure(e: unknown): Outcome {
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false, error: message, retry: !(e instanceof EmailError && e.permanent) };
}

function notConfigured(): Outcome | null {
  return emailEnabled() ? null : { ok: true, detail: `Correo no configurado: ${emailStatus().detail}; no se mandó nada` };
}

// ---------------------------------------------------------------------------
// Resumen diario interno
// ---------------------------------------------------------------------------

export async function runDailyInternal(admin: Admin, now = new Date()): Promise<Outcome> {
  const skip = notConfigured();
  if (skip) return skip;
  const ref = reportReferenceNow(now);
  const periodEnd = ref;
  const periodStart = new Date(zonedToUtcIso(utcIsoToZoned(ref.toISOString(), TZ).date, "00:00", TZ)!);

  try {
    const rows = await loadPipeline(admin);
    const [interviews, profiles] = await Promise.all([loadInterviews(admin), loadActiveProfiles(admin, rows)]);
    const { data: staff, error } = await admin.from("users").select("id, email, role").in("role", ["admin", "recruiter"]).eq("is_active", true);
    if (error) throw error;
    const { data: assignments, error: aError } = await admin.from("job_profile_assignments").select("recruiter_id, profile_id");
    if (aError) throw aError;

    const sends: { to: string[]; rows: PipelineRow[]; interviews: InterviewRow[]; profiles: ProfileSummary[] }[] = [];
    const admins = clean(staff.filter((s) => s.role === "admin").map((s) => s.email));
    if (admins.length) sends.push({ to: admins, rows, interviews, profiles });
    // Cada reclutador, solo sus vacantes (la misma regla que app.assigned_profile_ids()).
    for (const r of staff.filter((s) => s.role === "recruiter")) {
      const to = clean([r.email]);
      const mine = new Set(assignments.filter((a) => a.recruiter_id === r.id).map((a) => a.profile_id));
      if (!to.length || mine.size === 0) continue;
      const myRows = rows.filter((x) => x.profile_id && mine.has(x.profile_id));
      const myApps = new Set(myRows.map((x) => x.application_id));
      sends.push({ to, rows: myRows, interviews: interviews.filter((i) => myApps.has(i.application_id)), profiles: profiles.filter((p) => mine.has(p.id)) });
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const s of sends) {
      const data = buildDailyInternal({ rows: s.rows, interviews: s.interviews, profiles: s.profiles, now: ref });
      try {
        const r = await deliver(admin, { type: "daily_internal", clientId: null, periodStart, periodEnd, to: s.to, subject: dailyInternalSubject(data), element: createElement(DailyInternalEmail, { data, appUrl: appUrl() }) });
        if (r === "sent") sent++;
        else skipped++;
      } catch (e) {
        errors.push(`${s.to.join(", ")}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Lo que ya salió no se repite al reintentar (report_runs), así que reintentar es seguro.
    if (errors.length) return { ok: false, error: `Enviados ${sent}; fallaron ${errors.length}: ${errors.join(" | ")}`.slice(0, 2000), retry: true };
    return { ok: true, detail: `${sent} enviados${skipped ? `, ${skipped} ya habían salido` : ""}` };
  } catch (e) {
    return failure(e);
  }
}

// ---------------------------------------------------------------------------
// Diario y semanal al cliente
// ---------------------------------------------------------------------------

async function clientsWithActiveVacancies(admin: Admin, profiles: ProfileSummary[]): Promise<Client[]> {
  const ids = [...new Set(profiles.map((p) => p.client_id))];
  if (ids.length === 0) return [];
  const { data, error } = await admin.from("clients").select("*").in("id", ids).order("name");
  if (error) throw error;
  return data;
}

async function runForClients(admin: Admin, kind: "daily" | "weekly", now: Date): Promise<Outcome> {
  const skip = notConfigured();
  if (skip) return skip;
  const ref = reportReferenceNow(now);
  const refDate = utcIsoToZoned(ref.toISOString(), TZ).date;
  const dow = localDow(now);

  try {
    const rows = await loadPipeline(admin);
    const [interviews, profiles] = await Promise.all([loadInterviews(admin), loadActiveProfiles(admin, rows)]);
    const clients = await clientsWithActiveVacancies(admin, profiles);

    let sent = 0;
    let skipped = 0;
    let empty = 0;
    let noRecipients = 0;
    const errors: string[] = [];
    for (const client of clients) {
      if (kind === "weekly" && client.weekly_report_dow !== dow) continue;
      const to = clientRecipients(client);
      if (!to.length) {
        noRecipients++;
        continue;
      }
      try {
        let r: "sent" | "skipped";
        if (kind === "daily") {
          const data = buildDailyClient({ rows, interviews, client, now: ref });
          // Sin candidatos en etapas finales no se manda: el cliente no recibe correos vacíos diario.
          if (data.groups.length === 0) {
            empty++;
            continue;
          }
          r = await deliver(admin, {
            type: "daily_client",
            clientId: client.id,
            periodStart: new Date(zonedToUtcIso(refDate, "00:00", TZ)!),
            periodEnd: ref,
            to,
            subject: dailyClientSubject(data),
            element: createElement(DailyClientEmail, { data, appUrl: appUrl() }),
          });
        } else {
          const data = buildWeeklyClient({ rows, interviews, profiles, client, now: ref });
          r = await deliver(admin, {
            type: "weekly_client",
            clientId: client.id,
            periodStart: new Date(zonedToUtcIso(addDays(refDate, -6), "00:00", TZ)!),
            periodEnd: ref,
            to,
            subject: weeklyClientSubject(data),
            element: createElement(WeeklyClientEmail, { data, appUrl: appUrl() }),
            pdf: async () => {
              const { renderWeeklyPdf } = await import("./weekly-pdf");
              return { filename: `Reporte semanal ${data.week} - ${client.name}.pdf`, content: await renderWeeklyPdf(data) };
            },
          });
        }
        if (r === "sent") sent++;
        else skipped++;
      } catch (e) {
        errors.push(`${client.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const detail = `${sent} enviados${skipped ? `, ${skipped} ya habían salido` : ""}${empty ? `, ${empty} sin candidatos que reportar` : ""}${noRecipients ? `, ${noRecipients} clientes sin destinatarios` : ""}`;
    if (errors.length) return { ok: false, error: `${detail}; fallaron ${errors.length}: ${errors.join(" | ")}`.slice(0, 2000), retry: true };
    return { ok: true, detail };
  } catch (e) {
    return failure(e);
  }
}

export const runDailyClient = (admin: Admin, now = new Date()) => runForClients(admin, "daily", now);
export const runWeeklyClient = (admin: Admin, now = new Date()) => runForClients(admin, "weekly", now);
