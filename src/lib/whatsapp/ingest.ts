import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, Tables } from "@/lib/db/types";
import { toE164Mx } from "@/lib/domain/phone";
import { enqueue } from "@/lib/queue/run";

// Lo que hace cada evento del webhook de Whaapy con wa_conversations y wa_messages
// (plan §4.1, docs.whaapy.com/api-reference/webhooks/payloads). Corre con service role desde
// /api/webhooks/whaapy: aquí no hay sesión. Un número que no es de ningún candidato no abre
// conversación (wa_conversations.candidate_id es obligatorio) ni da de alta a nadie.

type Admin = ReturnType<typeof createAdminClient>;
type Conversation = Tables<"wa_conversations">;
type MessageType = Enums<"wa_message_type">;
export type MessageStatus = Enums<"wa_message_status">;

export type IngestResult = { detail: string; mediaTaskId?: string };

const UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------------------
// Mapeos (también los usa la sincronización manual en src/actions/whatsapp.ts)
// ---------------------------------------------------------------------------

export function mapMessageType(type: string | null | undefined): MessageType {
  switch (type) {
    case "image":
    case "sticker":
      return "image";
    case "document":
      return "document";
    case "audio":
    case "voice":
      return "audio";
    case "video":
      return "video";
    case "template":
      return "template";
    case "interactive":
    case "button":
      return "interactive";
    default:
      return "text";
  }
}

export function mapStatus(status: string | null | undefined): MessageStatus {
  return status === "delivered" || status === "read" || status === "failed" || status === "sent" ? status : "sent";
}

const RANK: Record<MessageStatus, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 1 };

/** Los avisos pueden llegar en desorden: un "entregado" no debe pisar un "leído". */
export function statusAdvances(current: MessageStatus, next: MessageStatus): boolean {
  if (next === "failed") return current === "queued" || current === "sent";
  return RANK[next] > RANK[current];
}

export const MEDIA_TYPES: readonly MessageType[] = ["image", "document", "audio", "video"];

const WINDOW_MS = 24 * 60 * 60 * 1000;
export const windowExpiry = (lastInboundIso: string) => new Date(new Date(lastInboundIso).getTime() + WINDOW_MS).toISOString();

function isoFrom(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  // Meta manda segundos Unix como texto; Whaapy, ISO 8601.
  const d = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

const mediaPart = z.object({ caption: z.string(), mime_type: z.string(), filename: z.string() }).partial();
const reply = z.object({ id: z.string(), title: z.string() }).partial();

const receivedSchema = z.object({
  whaapy_message_id: z.string(),
  conversation_id: z.string().nullish(),
  contact_id: z.string().nullish(),
  media_url: z.string().nullish(),
  transcription: z.string().nullish(),
  message: z.object({
    from: z.string(),
    id: z.string().nullish(),
    timestamp: z.string().nullish(),
    type: z.string(),
    text: z.object({ body: z.string() }).partial().nullish(),
    image: mediaPart.nullish(),
    video: mediaPart.nullish(),
    document: mediaPart.nullish(),
    audio: mediaPart.nullish(),
    sticker: mediaPart.nullish(),
    button: z.object({ text: z.string(), payload: z.string() }).partial().nullish(),
    interactive: z
      .object({ type: z.string(), button_reply: reply, list_reply: reply, nfm_reply: z.object({ body: z.string() }).partial() })
      .partial()
      .nullish(),
    location: z.object({ name: z.string(), address: z.string(), latitude: z.number(), longitude: z.number() }).partial().nullish(),
  }),
});

const sentSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string().nullish(),
  to: z.string().nullish(),
  type: z.string().nullish(),
  content: z.string().nullish(),
  sent_by_ai: z.boolean().nullish(),
  timestamp: z.string().nullish(),
});

const statusSchema = z.object({
  message_id: z.string().nullish(),
  wamid: z.string().nullish(),
  error: z.object({ code: z.union([z.string(), z.number()]), title: z.string(), message: z.string() }).partial().nullish(),
});

const conversationSchema = z.object({
  conversation_id: z.string(),
  phone_number: z.string().nullish(),
  reason: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Conversaciones
// ---------------------------------------------------------------------------

async function findConversation(admin: Admin, whaapyId: string | null | undefined, phone: string | null): Promise<Conversation | null> {
  if (whaapyId) {
    const { data } = await admin.from("wa_conversations").select("*").eq("whaapy_conversation_id", whaapyId).maybeSingle();
    if (data) return data;
  }
  if (!phone) return null;
  const { data } = await admin
    .from("wa_conversations")
    .select("*")
    .eq("phone_e164", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data && whaapyId && !data.whaapy_conversation_id) {
    await admin.from("wa_conversations").update({ whaapy_conversation_id: whaapyId }).eq("id", data.id);
    return { ...data, whaapy_conversation_id: whaapyId };
  }
  return data;
}

/** Abre la conversación de un candidato que escribe por primera vez. null si el número no es de nadie. */
async function openConversation(admin: Admin, whaapyId: string | null | undefined, phone: string): Promise<Conversation | null> {
  const { data: candidate } = await admin.from("candidates").select("id").eq("phone_e164", phone).maybeSingle();
  if (!candidate) return null;
  const { data: application } = await admin
    .from("applications")
    .select("id")
    .eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from("wa_conversations")
    .insert({ candidate_id: candidate.id, application_id: application?.id ?? null, phone_e164: phone, whaapy_conversation_id: whaapyId ?? null, flow: "manual", status: "open" })
    .select("*")
    .single();
  // Otro aviso la abrió al mismo tiempo (una sola abierta por número).
  if (error?.code === UNIQUE_VIOLATION) return findConversation(admin, whaapyId, phone);
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function inboundBody(m: z.infer<typeof receivedSchema>["message"], transcription: string | null | undefined): string | null {
  if (m.text?.body) return m.text.body;
  const media = m.image ?? m.video ?? m.document ?? m.audio ?? m.sticker;
  if (m.type === "audio" && transcription) return transcription;
  if (media?.caption) return media.caption;
  if (m.interactive?.button_reply?.title) return m.interactive.button_reply.title;
  if (m.interactive?.list_reply?.title) return m.interactive.list_reply.title;
  if (m.interactive?.nfm_reply?.body) return m.interactive.nfm_reply.body;
  if (m.button?.text) return m.button.text;
  if (m.location) return ["Ubicación", m.location.name, m.location.address].filter(Boolean).join(" · ");
  if (m.type === "document" && m.document?.filename) return m.document.filename;
  return null;
}

async function onReceived(admin: Admin, raw: unknown, receivedAt: string): Promise<IngestResult> {
  const d = receivedSchema.parse(raw);
  const phone = toE164Mx(d.message.from.startsWith("+") ? d.message.from : `+${d.message.from}`);
  if (!phone) return { detail: `Número no válido: ${d.message.from}` };

  const conv = (await findConversation(admin, d.conversation_id, phone)) ?? (await openConversation(admin, d.conversation_id, phone));
  if (!conv) return { detail: `El número ${phone} no es de ningún candidato; no se guardó` };

  const type = mapMessageType(d.message.type);
  const at = isoFrom(d.message.timestamp ?? undefined, receivedAt);
  const reply = d.message.interactive?.button_reply ?? d.message.interactive?.list_reply;
  const media = d.message.image ?? d.message.video ?? d.message.document ?? d.message.audio ?? d.message.sticker;

  const { data: message, error } = await admin
    .from("wa_messages")
    .insert({
      conversation_id: conv.id,
      direction: "inbound",
      whaapy_message_id: d.whaapy_message_id,
      wamid: d.message.id ?? null,
      type,
      body: inboundBody(d.message, d.transcription),
      interactive_payload: reply?.id ? { reply_id: reply.id, title: reply.title ?? null } : d.message.button?.payload ? { reply_id: d.message.button.payload, title: d.message.button.text ?? null } : null,
      media_mime: media?.mime_type ?? null,
      status: "read",
      created_at: at,
    })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { detail: "Mensaje ya guardado" };
  if (error) throw new Error(error.message);

  const isNewer = !conv.last_inbound_at || conv.last_inbound_at < at;
  const reopen = conv.status === "closed_success" || conv.status === "expired" || conv.status === "closed_rule";
  if (isNewer || reopen) {
    const patch = { ...(isNewer ? { last_inbound_at: at, window_expires_at: windowExpiry(at) } : {}), ...(reopen ? { status: "open" as const } : {}) };
    const { error: convError } = await admin.from("wa_conversations").update(patch).eq("id", conv.id);
    // Reabrir choca si ya hay otra abierta con ese número: se guarda al menos la ventana.
    if (convError?.code === UNIQUE_VIOLATION && isNewer) await admin.from("wa_conversations").update({ last_inbound_at: at, window_expires_at: windowExpiry(at) }).eq("id", conv.id);
  }
  if (d.contact_id) await admin.from("candidates").update({ whaapy_contact_id: d.contact_id }).eq("id", conv.candidate_id).is("whaapy_contact_id", null);

  let mediaTaskId: string | undefined;
  if (d.media_url && MEDIA_TYPES.includes(type)) {
    mediaTaskId = await enqueue("wa_media_fetch", { message_id: message.id, url: d.media_url }, { dedupeKey: `wa_media:${message.id}` });
  }
  return { detail: `Mensaje de ${phone} guardado`, mediaTaskId };
}

/**
 * Mensaje que salió del número de Prime. Si lo mandamos nosotros (src/actions/whatsapp.ts) ya existe
 * su fila, o una en cola sin id de Whaapy que se reclama aquí. Si no, lo mandó una persona desde el
 * inbox de Whaapy: se guarda y se pausa a Vale en esa conversación.
 */
async function onSent(admin: Admin, raw: unknown, receivedAt: string): Promise<IngestResult> {
  const d = sentSchema.parse(raw);
  const { data: existing } = await admin.from("wa_messages").select("id, status").eq("whaapy_message_id", d.message_id).maybeSingle();
  if (existing) {
    if (statusAdvances(existing.status, "sent")) await admin.from("wa_messages").update({ status: "sent" }).eq("id", existing.id);
    return { detail: "Mensaje propio confirmado" };
  }

  const phone = d.to ? toE164Mx(d.to) : null;
  const conv = await findConversation(admin, d.conversation_id, phone);
  if (!conv) return { detail: "Mensaje a un número sin conversación en Prime; no se guardó" };

  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: queued } = await admin
    .from("wa_messages")
    .select("id")
    .eq("conversation_id", conv.id)
    .eq("direction", "outbound")
    .eq("status", "queued")
    .is("whaapy_message_id", null)
    .gte("created_at", since)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (queued) {
    await admin.from("wa_messages").update({ whaapy_message_id: d.message_id, status: "sent" }).eq("id", queued.id).is("whaapy_message_id", null);
    return { detail: "Mensaje propio confirmado" };
  }

  const at = isoFrom(d.timestamp ?? undefined, receivedAt);
  const { error } = await admin.from("wa_messages").insert({
    conversation_id: conv.id,
    direction: "outbound",
    whaapy_message_id: d.message_id,
    type: mapMessageType(d.type),
    body: d.content ?? null,
    status: "sent",
    sent_by: d.sent_by_ai ? "agent" : "recruiter",
    created_at: at,
  });
  if (error?.code === UNIQUE_VIOLATION) return { detail: "Mensaje ya guardado" };
  if (error) throw new Error(error.message);

  const fromInbox = !d.sent_by_ai;
  await admin
    .from("wa_conversations")
    .update({ last_outbound_at: at, ...(fromInbox ? { ai_paused: true, paused_by: null } : {}) })
    .eq("id", conv.id);
  return { detail: fromInbox ? "Mensaje desde el inbox de Whaapy; Vale en pausa" : "Mensaje de la IA de Whaapy guardado" };
}

async function onStatus(admin: Admin, raw: unknown, next: MessageStatus): Promise<IngestResult> {
  const d = statusSchema.parse(raw);
  const byWhaapy = d.message_id ? await admin.from("wa_messages").select("id, status").eq("whaapy_message_id", d.message_id).maybeSingle() : null;
  const row = byWhaapy?.data ?? (d.wamid ? (await admin.from("wa_messages").select("id, status").eq("wamid", d.wamid).maybeSingle()).data : null);
  if (!row) return { detail: "Mensaje desconocido; se ignora" };
  if (!statusAdvances(row.status, next)) return { detail: `Sin cambio (${row.status})` };
  const error = next === "failed" && d.error ? [d.error.code, d.error.message ?? d.error.title].filter(Boolean).join(" · ") : null;
  await admin
    .from("wa_messages")
    .update({ status: next, ...(d.wamid ? { wamid: d.wamid } : {}), ...(error ? { error: error.slice(0, 500) } : {}) })
    .eq("id", row.id);
  return { detail: `Mensaje ${next}` };
}

async function onConversation(admin: Admin, raw: unknown, event: string): Promise<IngestResult> {
  const d = conversationSchema.parse(raw);
  const phone = d.phone_number ? toE164Mx(d.phone_number) : null;
  const conv = await findConversation(admin, d.conversation_id, phone);
  if (!conv) return { detail: "Conversación sin candidato en Prime; se ignora" };

  let patch: Partial<Conversation> | null = null;
  if (event === "conversation.assigned") patch = { status: "handoff", ai_paused: true, paused_by: null };
  else if (event === "conversation.unassigned") patch = { status: "open", ai_paused: false, paused_by: null };
  else if (event === "conversation.closed") patch = { status: d.reason === "timeout" ? "expired" : "closed_success" };
  else if (event === "conversation.reopened") patch = { status: "open" };
  if (!patch) return { detail: "Conversación vinculada" };

  const { error } = await admin.from("wa_conversations").update(patch).eq("id", conv.id);
  if (error?.code === UNIQUE_VIOLATION) return { detail: "Ya hay otra conversación abierta con este número; no se reabrió" };
  if (error) throw new Error(error.message);
  return { detail: `Conversación: ${patch.status}` };
}

/** Procesa un evento ya verificado. Los que no usamos (contactos, etapas, envíos masivos) se ignoran. */
export async function processWhaapyEvent(admin: Admin, event: string, data: unknown, receivedAt: string): Promise<IngestResult> {
  switch (event) {
    case "message.received":
      return onReceived(admin, data, receivedAt);
    case "message.sent":
      return onSent(admin, data, receivedAt);
    case "message.delivered":
      return onStatus(admin, data, "delivered");
    case "message.read":
      return onStatus(admin, data, "read");
    case "message.failed":
      return onStatus(admin, data, "failed");
    case "conversation.created":
    case "conversation.reopened":
    case "conversation.assigned":
    case "conversation.unassigned":
    case "conversation.closed":
      return onConversation(admin, data, event);
    default:
      return { detail: `Evento ${event} sin uso en Prime; se ignora` };
  }
}

/** Id para no procesar dos veces el mismo aviso (webhook_events.external_id). */
export function webhookExternalId(event: string, data: unknown, timestamp: string | undefined, fallback: string): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const id = d.whaapy_message_id ?? d.message_id ?? d.wamid;
  if (typeof id === "string") return `${event}:${id}`;
  if (typeof d.conversation_id === "string") return `${event}:${d.conversation_id}:${timestamp ?? fallback}`;
  return `${event}:${fallback}`;
}
