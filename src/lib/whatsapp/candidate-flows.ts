import "server-only";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { whaapyEnabled } from "@/lib/integrations/whaapy";
import { doneAt, enqueueOnce, formatDay, joinList, privacyNoticeUrl, sendSystemTemplate, type Outcome } from "./system-send";

// Mensajes automáticos al candidato por WhatsApp (plan §12.22): primer contacto con aviso de
// privacidad, enlace del psicométrico y sus recordatorios, solicitud de documentos y sus
// recordatorios, y aviso de descarte. Cada envío vuelve a leer el estado justo antes de mandar: si
// el candidato ya avanzó, se descartó o ya entregó, no se manda nada. Corre con service role desde
// la cola; quien encola ya pasó por la sesión del reclutador (RLS).

type Admin = ReturnType<typeof createAdminClient>;

const HOUR = 36e5;
/** Recordatorios del psicométrico: a las 12 h y a las 48 h de mandar el enlace. */
const PSYCH_REMINDERS_H = [12, 48];
/** Recordatorios de documentos: a las 24 h y a las 48 h de pedirlos. */
const DOCS_REMINDERS_H = [24, 48];
/** Sin fecha límite capturada, el candidato tiene 2 días. */
const DEFAULT_PSYCH_DAYS = 2;
const CLOSED = ["discarded", "hired"];

const short = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

// ---------------------------------------------------------------------------
// Llaves y encolado (los usa la Server Action; aquí sin run.ts para no cerrar un ciclo)
// ---------------------------------------------------------------------------

export const firstContactKey = (applicationId: string) => `wa_first_contact:${applicationId}`;
export const psychLinkKey = (testId: string, link: string) => `wa_psych_link:${testId}:${short(link)}`;
export const psychReminderKey = (testId: string, link: string, n: number) => `wa_psych_reminder:${testId}:${short(link)}:${n}`;
export const docsRequestKey = (applicationId: string) => `wa_docs_request:${applicationId}`;
export const docsReminderKey = (applicationId: string, n: number) => `wa_docs_reminder:${applicationId}:${n}`;
export const discardKey = (applicationId: string, at: string) => `wa_discard:${applicationId}:${short(at)}`;

export function enqueueFirstContact(admin: Admin, applicationId: string) {
  return enqueueOnce(admin, "wa_first_contact", { application_id: applicationId }, firstContactKey(applicationId));
}

export function enqueuePsychLink(admin: Admin, testId: string, link: string) {
  return enqueueOnce(admin, "wa_psych_link", { test_id: testId, link }, psychLinkKey(testId, link));
}

export function enqueueDocsRequest(admin: Admin, applicationId: string) {
  return enqueueOnce(admin, "wa_docs_request", { application_id: applicationId }, docsRequestKey(applicationId));
}

/** `stageChangedAt` distingue un descarte de otro: si se reabre y se vuelve a descartar, vuelve a salir. */
export function enqueueDiscardNotice(admin: Admin, applicationId: string, stageChangedAt: string) {
  return enqueueOnce(admin, "wa_discard", { application_id: applicationId }, discardKey(applicationId, stageChangedAt));
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

async function applicationStage(admin: Admin, applicationId: string) {
  const { data, error } = await admin.from("applications").select("id, stage, candidate_id").eq("id", applicationId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Documentos obligatorios que el candidato todavía no manda (recibido, en revisión o validado ya cuentan). */
export async function missingDocuments(admin: Admin, candidateId: string): Promise<string[]> {
  const [{ data: types, error: typesError }, { data: docs, error: docsError }] = await Promise.all([
    admin.from("document_types").select("key, label").eq("required", true).order("sort_order"),
    admin.from("candidate_documents").select("document_type_key, status").eq("candidate_id", candidateId).in("status", ["received", "in_review", "validated"]),
  ]);
  if (typesError) throw typesError;
  if (docsError) throw docsError;
  const have = new Set((docs ?? []).map((d) => d.document_type_key));
  return (types ?? []).filter((t) => !have.has(t.key)).map((t) => t.label);
}

async function latestPsychTest(admin: Admin, testId: string) {
  const { data, error } = await admin
    .from("psychometric_tests")
    .select("id, application_id, status, test_link, sent_at, due_at, completed_at, report_file_path, created_at")
    .eq("id", testId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const psychPending = (t: { status: string; completed_at: string | null; report_file_path: string | null }) => t.status === "sent" && !t.completed_at && !t.report_file_path;

// ---------------------------------------------------------------------------
// Envíos (handlers de la cola)
// ---------------------------------------------------------------------------

export async function sendFirstContact(admin: Admin, applicationId: string): Promise<Outcome> {
  const app = await applicationStage(admin, applicationId);
  if (!app) return { ok: true, detail: "La postulación ya no existe" };
  if (CLOSED.includes(app.stage)) return { ok: true, detail: `No se mandó: la postulación está en ${app.stage}` };
  const url = privacyNoticeUrl();
  return sendSystemTemplate(admin, { applicationId, template: "first_contact", parameters: (_c, vacancy) => [vacancy, url] });
}

export async function sendPsychLink(admin: Admin, testId: string, link: string): Promise<Outcome> {
  const test = await latestPsychTest(admin, testId);
  if (!test) return { ok: true, detail: "La evaluación ya no existe" };
  if (test.test_link !== link) return { ok: true, detail: "No se mandó: cambió el enlace" };
  if (!psychPending(test)) return { ok: true, detail: "No se mandó: la evaluación ya tiene resultado" };
  const app = await applicationStage(admin, test.application_id);
  if (!app || CLOSED.includes(app.stage)) return { ok: true, detail: "No se mandó: la postulación ya está cerrada" };

  // Sin fecha límite: 2 días desde hoy, y se guarda para que los recordatorios digan lo mismo.
  let due = test.due_at;
  if (!due) {
    due = new Date(Date.now() + DEFAULT_PSYCH_DAYS * 24 * HOUR).toISOString();
    await admin.from("psychometric_tests").update({ due_at: due }).eq("id", test.id).is("due_at", null);
  }
  const dueLabel = formatDay(due);
  const result = await sendSystemTemplate(admin, { applicationId: test.application_id, template: "psych_link", parameters: () => [link, dueLabel] });
  // Los recordatorios cuentan desde que salió el enlace por WhatsApp.
  if (result.ok) await admin.from("psychometric_tests").update({ sent_at: new Date().toISOString() }).eq("id", test.id);
  return result;
}

export async function sendPsychReminder(admin: Admin, testId: string, link: string, n: number): Promise<Outcome> {
  const test = await latestPsychTest(admin, testId);
  if (!test) return { ok: true, detail: "La evaluación ya no existe" };
  if (test.test_link !== link || !psychPending(test)) return { ok: true, detail: "No se mandó: la evaluación ya cambió o tiene resultado" };
  if (test.due_at && new Date(test.due_at) <= new Date()) return { ok: true, detail: "No se mandó: ya pasó la fecha límite" };
  const app = await applicationStage(admin, test.application_id);
  if (!app || CLOSED.includes(app.stage)) return { ok: true, detail: "No se mandó: la postulación ya está cerrada" };

  const dueLabel = test.due_at ? formatDay(test.due_at) : "la fecha acordada";
  const result = await sendSystemTemplate(admin, { applicationId: test.application_id, template: "psych_reminder", parameters: () => [link, dueLabel] });
  if (result.ok) await admin.from("psychometric_tests").update({ reminder_sent_at: new Date().toISOString() }).eq("id", test.id);
  return result.ok ? { ok: true, detail: `Recordatorio ${n}: ${result.detail}` } : result;
}

async function sendDocs(admin: Admin, applicationId: string, template: "docs_request" | "docs_reminder"): Promise<Outcome> {
  const app = await applicationStage(admin, applicationId);
  if (!app) return { ok: true, detail: "La postulación ya no existe" };
  if (app.stage !== "documents") return { ok: true, detail: `No se mandó: la postulación ya no está en Documentos (${app.stage})` };
  const missing = await missingDocuments(admin, app.candidate_id);
  if (missing.length === 0) return { ok: true, detail: "No se mandó: ya entregó todos los documentos" };
  const list = joinList(missing);
  return sendSystemTemplate(admin, { applicationId, template, parameters: (_c, vacancy) => [vacancy, list] });
}

export const sendDocsRequest = (admin: Admin, applicationId: string) => sendDocs(admin, applicationId, "docs_request");
export const sendDocsReminder = (admin: Admin, applicationId: string) => sendDocs(admin, applicationId, "docs_reminder");

export async function sendDiscardNotice(admin: Admin, applicationId: string): Promise<Outcome> {
  const app = await applicationStage(admin, applicationId);
  if (!app) return { ok: true, detail: "La postulación ya no existe" };
  if (app.stage !== "discarded") return { ok: true, detail: "No se mandó: la postulación se reabrió" };
  return sendSystemTemplate(admin, { applicationId, template: "discard", parameters: (_c, vacancy) => [vacancy] });
}

// ---------------------------------------------------------------------------
// Barrido diario de recordatorios (8:00)
// ---------------------------------------------------------------------------

/** El siguiente recordatorio que toca, si alguno: el n-ésimo sale cuando pasaron sus horas y salió el anterior. */
async function nextReminder(admin: Admin, since: Date, hours: number[], keyOf: (n: number) => string, now: Date): Promise<number | null> {
  for (let i = 0; i < hours.length; i++) {
    const n = i + 1;
    if (await doneAt(admin, keyOf(n))) continue; // ya salió
    const due = now.getTime() - since.getTime() >= hours[i]! * HOUR;
    const previousSent = n === 1 || !!(await doneAt(admin, keyOf(n - 1)));
    return due && previousSent ? n : null;
  }
  return null;
}

export async function sweepWhatsAppReminders(admin: Admin, now = new Date()): Promise<Outcome> {
  if (!whaapyEnabled()) return { ok: true, detail: "WhatsApp no está configurado (falta WHAAPY_API_KEY); no se mandó nada" };
  let psych = 0;
  let docs = 0;

  // Psicométrico: solo evaluaciones cuyo enlace salió por WhatsApp desde el sistema.
  const { data: tests, error: testsError } = await admin
    .from("psychometric_tests")
    .select("id, test_link, sent_at, due_at, status, completed_at, report_file_path")
    .eq("status", "sent")
    .not("test_link", "is", null)
    .is("completed_at", null)
    .is("report_file_path", null);
  if (testsError) return { ok: false, error: testsError.message, retry: true };
  for (const t of tests ?? []) {
    if (!t.test_link || (t.due_at && new Date(t.due_at) <= now)) continue;
    const link = t.test_link;
    const sentAt = await doneAt(admin, psychLinkKey(t.id, link));
    if (!sentAt) continue;
    const n = await nextReminder(admin, sentAt, PSYCH_REMINDERS_H, (k) => psychReminderKey(t.id, link, k), now);
    if (n && (await enqueueOnce(admin, "wa_psych_reminder", { test_id: t.id, link, n }, psychReminderKey(t.id, link, n)))) psych++;
  }

  // Documentos: postulaciones en Documentos a las que el sistema ya les pidió los papeles.
  const { data: apps, error: appsError } = await admin.from("applications").select("id").eq("stage", "documents");
  if (appsError) return { ok: false, error: appsError.message, retry: true };
  for (const a of apps ?? []) {
    const requestedAt = await doneAt(admin, docsRequestKey(a.id));
    if (!requestedAt) continue;
    const n = await nextReminder(admin, requestedAt, DOCS_REMINDERS_H, (k) => docsReminderKey(a.id, k), now);
    if (n && (await enqueueOnce(admin, "wa_docs_reminder", { application_id: a.id, n }, docsReminderKey(a.id, n)))) docs++;
  }

  return { ok: true, detail: `${psych} recordatorios de psicométrico y ${docs} de documentos encolados` };
}
