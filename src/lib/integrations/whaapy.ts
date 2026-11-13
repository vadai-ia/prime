import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente de la API de Whaapy (plan §4.1, docs.whaapy.com/api-reference). Solo servidor: la llave
// nunca sale al navegador. Enviar texto solo funciona dentro de la ventana de 24 h desde el último
// mensaje del candidato; fuera de ella Whaapy responde 131047 y hay que mandar plantilla.

const BASE = "https://api.whaapy.com";
const TIMEOUT_MS = 20_000;
/** Ventana de 24 h cerrada: solo se puede mandar plantilla. */
export const WINDOW_CLOSED_CODE = "131047";
/** Media entrante: Whaapy acepta documentos de hasta 100 MB (mismo límite que el bucket wa-media). */
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export function whaapyEnabled(): boolean {
  return !!process.env.WHAAPY_API_KEY;
}

export class WhaapyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "WhaapyError";
  }
  get windowClosed() {
    return this.code === WINDOW_CLOSED_CODE;
  }
}

type ErrorBody = { error?: unknown; message?: unknown; code?: unknown };

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const key = process.env.WHAAPY_API_KEY;
  if (!key) throw new WhaapyError("Falta WHAAPY_API_KEY en el servidor", 0);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new WhaapyError(e instanceof Error && e.name === "TimeoutError" ? "Whaapy no respondió a tiempo" : "No se pudo conectar con Whaapy", 0);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const b = (json ?? {}) as ErrorBody;
    const message = typeof b.message === "string" ? b.message : typeof b.error === "string" ? b.error : `Whaapy respondió ${res.status}`;
    throw new WhaapyError(message, res.status, b.code === undefined ? undefined : String(b.code));
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------

export type SendResult = { id: string; wamid: string | null; conversationId: string | null; status: string };

type SendResponse = {
  messages?: { id?: string; wamid?: string }[];
  data?: { id?: string; conversationId?: string; status?: string };
};

function sendResult(r: SendResponse): SendResult {
  const id = r.data?.id ?? r.messages?.[0]?.id;
  if (!id) throw new WhaapyError("Whaapy no devolvió el id del mensaje", 200);
  return { id, wamid: r.messages?.[0]?.wamid ?? null, conversationId: r.data?.conversationId ?? null, status: r.data?.status ?? "sent" };
}

/** Destino: la conversación de Whaapy si ya la conocemos, si no el teléfono. */
export type Target = { conversationId: string } | { to: string };

export async function sendText(target: Target, content: string): Promise<SendResult> {
  return sendResult(await call<SendResponse>("/messages/v1", { method: "POST", body: { ...target, content } }));
}

export async function sendTemplate(to: string, template: { name: string; language: string; parameters: string[] }): Promise<SendResult> {
  const components = template.parameters.length > 0 ? [{ type: "body", parameters: template.parameters.map((text) => ({ type: "text", text })) }] : [];
  return sendResult(
    await call<SendResponse>("/messages/v1", {
      method: "POST",
      body: { to, type: "template", template: { name: template.name, language: { code: template.language }, components } },
    }),
  );
}

// ---------------------------------------------------------------------------
// Leer
// ---------------------------------------------------------------------------

export type WhaapyConversation = { id: string; phoneNumber: string; contactName: string | null; status: string; lastMessageAt: string | null };

export type WhaapyMessage = {
  id: string;
  conversationId: string;
  content: string | null;
  messageType: string;
  direction: "inbound" | "outbound";
  status: string;
  sentByAi: boolean;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  timestamp: string;
  createdAt: string;
};

/** null si Whaapy no tiene conversación con ese número. */
export async function getConversationByPhone(phone: string): Promise<WhaapyConversation | null> {
  try {
    const r = await call<{ data: WhaapyConversation }>(`/conversations/v1/by-phone/${encodeURIComponent(phone)}`);
    return r.data;
  } catch (e) {
    if (e instanceof WhaapyError && e.status === 404) return null;
    throw e;
  }
}

/** Los más recientes primero (así responde Whaapy). Máximo 100 por página. */
export async function listMessages(conversationId: string, opts: { limit?: number; before?: string } = {}): Promise<{ messages: WhaapyMessage[]; hasMore: boolean; oldestId: string | null }> {
  const q = new URLSearchParams({ limit: String(Math.min(opts.limit ?? 100, 100)) });
  if (opts.before) q.set("before", opts.before);
  const r = await call<{ data: WhaapyMessage[]; meta?: { hasMore?: boolean; oldestMessageId?: string } }>(`/conversations/v1/${encodeURIComponent(conversationId)}/messages?${q}`);
  return { messages: r.data ?? [], hasMore: !!r.meta?.hasMore, oldestId: r.meta?.oldestMessageId ?? null };
}

export type WhaapyTemplate = { id: string; name: string; language: string; status: string; category: string; content: string | null };

export async function listTemplates(): Promise<WhaapyTemplate[]> {
  const r = await call<{ data: WhaapyTemplate[] }>("/templates/v1");
  return r.data ?? [];
}

/** Cuántas variables {{n}} lleva el texto de una plantilla (la más alta, como las numera Meta). */
export function templateVariableCount(content: string | null): number {
  let max = 0;
  for (const m of (content ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

export function renderTemplate(content: string | null, parameters: string[]): string {
  return (content ?? "").replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n: string) => parameters[Number(n) - 1] ?? all);
}

/**
 * Descarga un archivo entrante. La URL de Whaapy ya trae su token (24 h); la llave solo se manda
 * si el archivo vive en api.whaapy.com.
 */
export async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new WhaapyError("URL de archivo no válida", 400);
  const headers: Record<string, string> = {};
  if (u.hostname === "api.whaapy.com" && process.env.WHAAPY_API_KEY) headers.Authorization = `Bearer ${process.env.WHAAPY_API_KEY}`;
  const res = await fetch(u, { headers, cache: "no-store", signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new WhaapyError(`No se pudo descargar el archivo (${res.status})`, res.status);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_MEDIA_BYTES) throw new WhaapyError("El archivo pesa más de 100 MB", 413);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new WhaapyError("El archivo pesa más de 100 MB", 413);
  return { bytes, mime: (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim() };
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

function hmacMatches(body: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(signature.trim().replace(/^sha256=/, ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Firma HMAC-SHA256 en X-Webhook-Signature. Whaapy firma JSON.stringify(payload): se prueba con el
 * cuerpo tal cual llegó y, si no coincide, con el mismo JSON vuelto a serializar.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHAAPY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  if (hmacMatches(rawBody, signature, secret)) return true;
  try {
    return hmacMatches(JSON.stringify(JSON.parse(rawBody)), signature, secret);
  } catch {
    return false;
  }
}
