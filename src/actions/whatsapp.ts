"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertStaff, UnauthorizedError, type Session } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/db/types";
import { MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import {
  getConversationByPhone,
  listMessages,
  listTemplates,
  renderTemplate,
  sendTemplate,
  sendText,
  templateVariableCount,
  whaapyEnabled,
  WhaapyError,
  type SendResult,
  type WhaapyConversation,
} from "@/lib/integrations/whaapy";
import { MEDIA_TYPES, mapMessageType, mapStatus, windowExpiry } from "@/lib/whatsapp/ingest";
import { enqueue, runTaskNow } from "@/lib/queue/run";

// WhatsApp desde la ficha del candidato. Todo se lee y escribe con la sesión del usuario: RLS decide
// si el candidato es suyo (wa_conversations y wa_messages cuelgan de app.can_access_candidate).
// Solo la cola (descarga de archivos) usa service role.

export type WhatsAppResult = { ok: true; detail?: string } | { ok: false; error: string };
export type WhatsAppTemplateOption = { name: string; language: string; content: string; variables: number };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Conversation = Tables<"wa_conversations">;
type Context = { applicationId: string; candidate: { id: string; phone_e164: string }; conv: Conversation | null };

const UNIQUE_VIOLATION = "23505";

async function guard(): Promise<Session | string> {
  let session: Session;
  try {
    session = await assertStaff();
  } catch (e) {
    return e instanceof UnauthorizedError ? e.message : "No autorizado";
  }
  if (MOCK) return MOCK_WRITE_ERROR;
  if (!whaapyEnabled()) return "WhatsApp no está configurado: falta WHAAPY_API_KEY en el servidor.";
  return session;
}

function whaapyMessage(e: unknown): string {
  if (e instanceof WhaapyError) {
    if (e.windowClosed) return "Pasaron más de 24 h desde el último mensaje del candidato: manda una plantilla.";
    if (e.status === 401) return "Whaapy rechazó la llave (WHAAPY_API_KEY).";
    if (e.status === 403) return "La llave de Whaapy no tiene permiso para esto.";
    return `Whaapy: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}

async function loadContext(supabase: Supabase, applicationId: string): Promise<Context | string> {
  const { data: application } = await supabase.from("applications").select("id, candidate_id").eq("id", applicationId).maybeSingle();
  if (!application) return "No se encontró la postulación";
  const { data: candidate } = await supabase.from("candidates").select("id, phone_e164").eq("id", application.candidate_id).maybeSingle();
  if (!candidate) return "No se encontró al candidato";
  const { data: conv } = await supabase
    .from("wa_conversations")
    .select("*")
    .eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { applicationId, candidate, conv };
}

async function ensureConversation(supabase: Supabase, ctx: Context): Promise<Conversation> {
  if (ctx.conv) return ctx.conv;
  const { data, error } = await supabase
    .from("wa_conversations")
    .insert({ candidate_id: ctx.candidate.id, application_id: ctx.applicationId, phone_e164: ctx.candidate.phone_e164, flow: "manual", status: "open" })
    .select("*")
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    const { data: open } = await supabase.from("wa_conversations").select("*").eq("phone_e164", ctx.candidate.phone_e164).eq("status", "open").single();
    if (open) return open;
  }
  if (error || !data) throw new Error(error?.message ?? "No se pudo abrir la conversación");
  return data;
}

/**
 * Guarda el mensaje en cola, lo manda y anota los ids de Whaapy. Si el webhook message.sent llega
 * antes que la respuesta, reclama esta misma fila (src/lib/whatsapp/ingest.ts) y no se duplica.
 */
async function deliver(supabase: Supabase, session: Session, conv: Conversation, row: Pick<TablesInsert<"wa_messages">, "type" | "body">, send: () => Promise<SendResult>): Promise<WhatsAppResult> {
  const { data: queued, error } = await supabase
    .from("wa_messages")
    .insert({ ...row, conversation_id: conv.id, direction: "outbound", status: "queued", sent_by: "recruiter", sent_by_user_id: session.userId })
    .select("id")
    .single();
  if (error || !queued) return { ok: false, error: error?.message ?? "No se pudo guardar el mensaje" };

  let res: SendResult;
  try {
    res = await send();
  } catch (e) {
    const message = whaapyMessage(e);
    await supabase.from("wa_messages").update({ status: "failed", error: message.slice(0, 500) }).eq("id", queued.id);
    console.error("[whaapy] envío", e instanceof Error ? e.message : e);
    return { ok: false, error: message };
  }

  const { error: idError } = await supabase
    .from("wa_messages")
    .update({ whaapy_message_id: res.id, wamid: res.wamid, status: mapStatus(res.status) })
    .eq("id", queued.id)
    .eq("status", "queued");
  // El webhook ya lo guardó por su lado: esta copia sobra.
  if (idError?.code === UNIQUE_VIOLATION) await supabase.from("wa_messages").delete().eq("id", queued.id);

  await supabase
    .from("wa_conversations")
    .update({ last_outbound_at: new Date().toISOString(), ...(conv.whaapy_conversation_id || !res.conversationId ? {} : { whaapy_conversation_id: res.conversationId }) })
    .eq("id", conv.id);
  return { ok: true };
}

const textSchema = z.object({
  application_id: z.string().uuid(),
  body: z.string().trim().min(1, "Escribe el mensaje").max(4096, "El mensaje no puede pasar de 4,096 caracteres"),
});

/** Texto libre. Solo llega si el candidato escribió en las últimas 24 h; si no, Whaapy lo rechaza. */
export async function sendWhatsAppText(applicationId: string, body: string): Promise<WhatsAppResult> {
  const session = await guard();
  if (typeof session === "string") return { ok: false, error: session };
  const parsed = textSchema.safeParse({ application_id: applicationId, body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const ctx = await loadContext(supabase, parsed.data.application_id);
  if (typeof ctx === "string") return { ok: false, error: ctx };
  const conv = await ensureConversation(supabase, ctx);
  const target = conv.whaapy_conversation_id ? { conversationId: conv.whaapy_conversation_id } : { to: conv.phone_e164 };
  const result = await deliver(supabase, session, conv, { type: "text", body: parsed.data.body }, () => sendText(target, parsed.data.body));
  revalidatePath(`/candidatos/${applicationId}`);
  return result;
}

/** Plantillas aprobadas por Meta en la cuenta de Whaapy. */
export async function listWhatsAppTemplates(): Promise<{ ok: true; templates: WhatsAppTemplateOption[] } | { ok: false; error: string }> {
  const session = await guard();
  if (typeof session === "string") return { ok: false, error: session };
  try {
    const all = await listTemplates();
    const templates = all
      .filter((t) => t.status.toUpperCase() === "APPROVED")
      .map((t) => ({ name: t.name, language: t.language, content: t.content ?? "", variables: templateVariableCount(t.content) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: whaapyMessage(e) };
  }
}

const templateSchema = z.object({
  application_id: z.string().uuid(),
  name: z.string().min(1).max(512),
  language: z.string().min(2).max(15),
  parameters: z.array(z.string().trim().min(1, "Llena todas las variables").max(1024)).max(20),
});

/** Plantilla: sirve para el primer contacto y cuando la ventana de 24 h ya cerró. */
export async function sendWhatsAppTemplate(applicationId: string, template: { name: string; language: string; parameters: string[] }): Promise<WhatsAppResult> {
  const session = await guard();
  if (typeof session === "string") return { ok: false, error: session };
  const parsed = templateSchema.safeParse({ application_id: applicationId, ...template });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  let content: string;
  try {
    const found = (await listTemplates()).find((t) => t.name === d.name && t.language === d.language);
    if (!found || found.status.toUpperCase() !== "APPROVED") return { ok: false, error: "La plantilla no está aprobada en Whaapy" };
    if (templateVariableCount(found.content) !== d.parameters.length) return { ok: false, error: "Faltan variables de la plantilla" };
    content = renderTemplate(found.content, d.parameters);
  } catch (e) {
    return { ok: false, error: whaapyMessage(e) };
  }

  const supabase = await createClient();
  const ctx = await loadContext(supabase, d.application_id);
  if (typeof ctx === "string") return { ok: false, error: ctx };
  const conv = await ensureConversation(supabase, ctx);
  const result = await deliver(supabase, session, conv, { type: "template", body: content }, () =>
    sendTemplate(conv.phone_e164, { name: d.name, language: d.language, parameters: d.parameters }),
  );
  revalidatePath(`/candidatos/${applicationId}`);
  return result;
}

/** Whaapy puede tener el móvil con el 1 de antes de 2019 (+521…). */
async function findWhaapyConversation(phone: string): Promise<WhaapyConversation | null> {
  const found = await getConversationByPhone(phone);
  if (found || !/^\+52\d{10}$/.test(phone)) return found;
  return getConversationByPhone(`+521${phone.slice(3)}`);
}

/** Trae de Whaapy los últimos 100 mensajes con el candidato y guarda los que falten. */
export async function syncWhatsAppConversation(applicationId: string): Promise<WhatsAppResult> {
  const session = await guard();
  if (typeof session === "string") return { ok: false, error: session };
  if (!z.string().uuid().safeParse(applicationId).success) return { ok: false, error: "Postulación no válida" };

  const supabase = await createClient();
  const ctx = await loadContext(supabase, applicationId);
  if (typeof ctx === "string") return { ok: false, error: ctx };

  let remote: WhaapyConversation | null;
  let messages: Awaited<ReturnType<typeof listMessages>>["messages"];
  try {
    remote = await findWhaapyConversation(ctx.candidate.phone_e164);
    if (!remote) return { ok: false, error: "Whaapy todavía no tiene conversación con este número." };
    messages = (await listMessages(remote.id, { limit: 100 })).messages;
  } catch (e) {
    return { ok: false, error: whaapyMessage(e) };
  }

  const conv = await ensureConversation(supabase, ctx);
  if (!conv.whaapy_conversation_id) {
    const { error } = await supabase.from("wa_conversations").update({ whaapy_conversation_id: remote.id }).eq("id", conv.id);
    if (error && error.code !== UNIQUE_VIOLATION) return { ok: false, error: error.message };
  }

  const ids = messages.map((m) => m.id);
  const { data: known } = ids.length
    ? await supabase.from("wa_messages").select("whaapy_message_id").eq("conversation_id", conv.id).in("whaapy_message_id", ids)
    : { data: [] };
  const seen = new Set((known ?? []).map((k) => k.whaapy_message_id));
  const missing = messages.filter((m) => !seen.has(m.id) && m.messageType !== "reaction");

  const rows: TablesInsert<"wa_messages">[] = missing.map((m) => ({
    conversation_id: conv.id,
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    whaapy_message_id: m.id,
    type: mapMessageType(m.messageType),
    body: m.content,
    media_mime: m.mediaMimeType ?? null,
    status: m.direction === "inbound" ? "read" : mapStatus(m.status),
    sent_by: m.direction === "inbound" ? null : m.sentByAi ? "agent" : "recruiter",
    created_at: m.timestamp ?? m.createdAt,
  }));
  const { data: inserted, error } = rows.length ? await supabase.from("wa_messages").insert(rows).select("id, whaapy_message_id, type, direction") : { data: [], error: null };
  if (error) return { ok: false, error: error.code === UNIQUE_VIOLATION ? "Llegaron mensajes al mismo tiempo; vuelve a intentarlo." : error.message };

  // Ventana de 24 h y últimos movimientos según el historial.
  const lastInbound = messages.filter((m) => m.direction === "inbound").map((m) => m.timestamp ?? m.createdAt).sort().pop();
  const lastOutbound = messages.filter((m) => m.direction === "outbound").map((m) => m.timestamp ?? m.createdAt).sort().pop();
  const patch: Partial<Conversation> = {};
  if (lastInbound && (!conv.last_inbound_at || conv.last_inbound_at < lastInbound)) Object.assign(patch, { last_inbound_at: lastInbound, window_expires_at: windowExpiry(lastInbound) });
  if (lastOutbound && (!conv.last_outbound_at || conv.last_outbound_at < lastOutbound)) patch.last_outbound_at = lastOutbound;
  if (Object.keys(patch).length) await supabase.from("wa_conversations").update(patch).eq("id", conv.id);

  // Archivos entrantes: a wa-media por la cola, como los del webhook.
  const byId = new Map(missing.map((m) => [m.id, m]));
  const taskIds: string[] = [];
  for (const row of inserted ?? []) {
    const url = row.whaapy_message_id ? byId.get(row.whaapy_message_id)?.mediaUrl : null;
    if (url && row.direction === "inbound" && MEDIA_TYPES.includes(row.type)) {
      taskIds.push(await enqueue("wa_media_fetch", { message_id: row.id, url }, { dedupeKey: `wa_media:${row.id}` }));
    }
  }
  if (taskIds.length) {
    after(async () => {
      for (const id of taskIds) await runTaskNow(id).catch((e) => console.error("[whaapy] media", id, e));
    });
  }

  revalidatePath(`/candidatos/${applicationId}`);
  const n = inserted?.length ?? 0;
  return { ok: true, detail: n === 0 ? "Sin mensajes nuevos" : n === 1 ? "1 mensaje nuevo" : `${n} mensajes nuevos` };
}
