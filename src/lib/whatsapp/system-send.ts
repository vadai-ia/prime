import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/db/types";
import { listTemplates, renderTemplate, sendTemplate, templateVariableCount, whaapyEnabled, WhaapyError, type WhaapyTemplate } from "@/lib/integrations/whaapy";

// Plantillas que manda el sistema solo (cola, cron), sin reclutador de por medio. Corre con service
// role: quien llama ya decidió a quién se manda. Cada envío queda en wa_messages con
// sent_by = 'system' y se ve en la ficha. Los textos viven en Whaapy (los aprueba Meta); aquí solo
// el nombre, que se puede cambiar con su variable de entorno sin tocar código.

type Admin = ReturnType<typeof createAdminClient>;
export type Outcome = { ok: true; detail: string } | { ok: false; error: string; retry: boolean };

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";
const LANGUAGE = "es_MX";
const UNIQUE_VIOLATION = "23505";

/** Nombre de cada plantilla en Whaapy y cuántas variables lleva (en ese orden). */
export const SYSTEM_TEMPLATES = {
  /** {{1}} nombre, {{2}} vacante, {{3}} enlace al aviso de privacidad. */
  first_contact: { name: process.env.WHAAPY_TEMPLATE_FIRST_CONTACT || "primer_contacto_aviso_utility", variables: 3 },
  /** {{1}} nombre, {{2}} vacante, {{3}} fecha y hora, {{4}} enlace de la videollamada. */
  interview: { name: process.env.WHAAPY_TEMPLATE_INTERVIEW || "confirmacion_entrevista_utility", variables: 4 },
  /** {{1}} nombre, {{2}} enlace, {{3}} fecha límite. */
  psych_link: { name: process.env.WHAAPY_TEMPLATE_PSYCH_LINK || "enlace_psicometrico_utility", variables: 3 },
  /** Misma forma que psych_link: por defecto se vuelve a mandar esa plantilla como recordatorio. */
  psych_reminder: { name: process.env.WHAAPY_TEMPLATE_PSYCH_REMINDER || "enlace_psicometrico_utility", variables: 3 },
  /** {{1}} nombre, {{2}} vacante, {{3}} documentos que faltan. */
  docs_request: { name: process.env.WHAAPY_TEMPLATE_DOCS_REQUEST || "solicitud_documentos_utility", variables: 3 },
  /** Misma forma que docs_request: por defecto se vuelve a mandar esa plantilla con lo que sigue faltando. */
  docs_reminder: { name: process.env.WHAAPY_TEMPLATE_DOCS_REMINDER || "solicitud_documentos_utility", variables: 3 },
  /** {{1}} nombre, {{2}} vacante. */
  discard: { name: process.env.WHAAPY_TEMPLATE_DISCARD || "cierre_corte_utility", variables: 2 },
} as const;

export type SystemTemplate = keyof typeof SYSTEM_TEMPLATES;

/** Aviso de privacidad que va en el primer contacto. */
export function privacyNoticeUrl(): string {
  return process.env.PRIVACY_NOTICE_URL || "https://catch-your-talent-sa-cv.pandape.computrabajo.com/Privacy";
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] || "Hola";
}

/** "jueves 26 de noviembre". */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)).replace(",", "");
}

/** "martes 24 de noviembre a las 10:30 (hora del centro de México)". */
export function formatWhen(iso: string): string {
  const time = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return `${formatDay(iso)} a las ${time} (hora del centro de México)`;
}

/** "INE, CURP y comprobante de domicilio". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// Las plantillas se leen una vez por ejecución del servidor (una corrida del cron manda varias).
let cache: { at: number; list: WhaapyTemplate[] } | null = null;
async function approvedTemplate(name: string): Promise<WhaapyTemplate | null> {
  if (!cache || Date.now() - cache.at > 5 * 60_000) cache = { at: Date.now(), list: await listTemplates() };
  return cache.list.find((t) => t.name === name && t.language === LANGUAGE && t.status.toUpperCase() === "APPROVED") ?? null;
}

const permanent = (e: unknown) => e instanceof WhaapyError && e.status >= 400 && e.status < 500;

/**
 * Manda una plantilla del sistema al candidato de una postulación y la guarda en su conversación.
 * `parameters` sin el nombre: el nombre de pila va siempre en {{1}} y lo pone esta función.
 */
export async function sendSystemTemplate(
  admin: Admin,
  input: { applicationId: string; template: SystemTemplate; parameters: (candidate: { full_name: string }, vacancy: string) => string[] },
): Promise<Outcome> {
  if (!whaapyEnabled()) return { ok: false, error: "Falta WHAAPY_API_KEY en el servidor", retry: false };
  const spec = SYSTEM_TEMPLATES[input.template];

  const { data: app, error } = await admin
    .from("applications")
    .select("id, candidate_id, candidates(id, full_name, phone_e164), job_profiles(title)")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, retry: true };
  const candidate = app?.candidates;
  if (!app || !candidate) return { ok: false, error: "No se encontró la postulación", retry: false };
  if (!candidate.phone_e164) return { ok: false, error: "El candidato no tiene teléfono", retry: false };

  const parameters = [firstName(candidate.full_name), ...input.parameters(candidate, app.job_profiles?.title ?? "la vacante")].map((p) =>
    // Meta rechaza parámetros con saltos de línea, tabuladores o más de 4 espacios seguidos.
    p.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim(),
  );
  if (parameters.length !== spec.variables || parameters.some((p) => !p)) return { ok: false, error: `Faltan datos para la plantilla ${spec.name}`, retry: false };

  let body: string;
  try {
    const found = await approvedTemplate(spec.name);
    if (!found) return { ok: false, error: `La plantilla ${spec.name} no está aprobada en Whaapy`, retry: false };
    if (templateVariableCount(found.content) !== spec.variables) return { ok: false, error: `La plantilla ${spec.name} no lleva ${spec.variables} variables`, retry: false };
    body = renderTemplate(found.content, parameters);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retry: !permanent(e) };
  }

  // La conversación más reciente del candidato; si no tiene, se abre una (igual que desde la ficha).
  const { data: existing } = await admin.from("wa_conversations").select("id").eq("candidate_id", candidate.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let conversationId = existing?.id ?? null;
  if (!conversationId) {
    const { data: created, error: convError } = await admin
      .from("wa_conversations")
      .insert({ candidate_id: candidate.id, application_id: app.id, phone_e164: candidate.phone_e164, flow: "manual", status: "open" })
      .select("id")
      .single();
    if (convError?.code === UNIQUE_VIOLATION) {
      const { data: open } = await admin.from("wa_conversations").select("id").eq("phone_e164", candidate.phone_e164).eq("status", "open").maybeSingle();
      conversationId = open?.id ?? null;
    } else conversationId = created?.id ?? null;
    if (!conversationId) return { ok: false, error: convError?.message ?? "No se pudo abrir la conversación", retry: true };
  }

  const row: TablesInsert<"wa_messages"> = { conversation_id: conversationId, direction: "outbound", type: "template", body, status: "queued", sent_by: "system" };
  const { data: queued, error: insertError } = await admin.from("wa_messages").insert(row).select("id").single();
  if (insertError || !queued) return { ok: false, error: insertError?.message ?? "No se pudo guardar el mensaje", retry: true };

  try {
    const res = await sendTemplate(candidate.phone_e164, { name: spec.name, language: LANGUAGE, parameters });
    const { error: idError } = await admin.from("wa_messages").update({ whaapy_message_id: res.id, wamid: res.wamid, status: "sent" }).eq("id", queued.id).eq("status", "queued");
    // El webhook message.sent ya lo guardó por su lado: esta copia sobra.
    if (idError?.code === UNIQUE_VIOLATION) await admin.from("wa_messages").delete().eq("id", queued.id);
    await admin.from("wa_conversations").update({ last_outbound_at: new Date().toISOString() }).eq("id", conversationId);
    return { ok: true, detail: `${spec.name} enviado a ${candidate.phone_e164}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("wa_messages").update({ status: "failed", error: message.slice(0, 500) }).eq("id", queued.id);
    return { ok: false, error: `Whaapy: ${message}`, retry: !permanent(e) };
  }
}

// ---------------------------------------------------------------------------
// Encolar sin repetir (sin importar src/lib/queue/run.ts, que importa handlers.ts)
// ---------------------------------------------------------------------------

/** Ya hay (o hubo) una tarea con esa llave: pendiente, corriendo o terminada. */
export async function alreadyQueued(admin: Admin, key: string): Promise<boolean> {
  const { data, error } = await admin.from("scheduled_tasks").select("id").eq("dedupe_key", key).in("status", ["pending", "running", "done"]).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Cuándo terminó bien la tarea con esa llave, o null. */
export async function doneAt(admin: Admin, key: string): Promise<Date | null> {
  const { data, error } = await admin.from("scheduled_tasks").select("finished_at").eq("dedupe_key", key).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.finished_at ? new Date(data.finished_at) : null;
}

/** Encola si esa llave nunca se encoló. Devuelve el id de la tarea, o null si ya estaba. */
export async function enqueueOnce(admin: Admin, type: string, payload: Record<string, string | number>, key: string, maxAttempts = 3): Promise<string | null> {
  if (await alreadyQueued(admin, key)) return null;
  const { data, error } = await admin.rpc("enqueue_task", { p_type: type, p_payload: payload, p_dedupe_key: key });
  if (error) throw error;
  if (data) await admin.from("scheduled_tasks").update({ max_attempts: maxAttempts }).eq("id", data).eq("status", "pending");
  return data ?? null;
}
