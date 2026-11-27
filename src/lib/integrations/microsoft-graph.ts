import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt, encryptionEnabled } from "@/lib/crypto";

// Outlook y Teams vía Microsoft Graph (plan §4.4, opción B): cada reclutador conecta su cuenta de
// Microsoft 365 desde "Mi cuenta" con OAuth delegado. Las entrevistas se crean en el calendario de
// quien las agenda (interviews.calendar_owner_id) con reunión de Teams, y Exchange manda la invitación
// desde su buzón. Tokens cifrados en user_integrations (provider = 'microsoft').
//
// Service role: solo para leer y refrescar el token del dueño del calendario, que puede no ser quien
// está en sesión (un admin reagenda la entrevista de un reclutador). No toca datos de candidatos.

const LOGIN = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";
/**
 * Grabación y transcripción de Teams (plan §12.24). Los dos permisos delegados necesitan consentimiento
 * de admin en Entra ID; hasta darlo, TEAMS_TRANSCRIPTS queda apagado: pedir un permiso sin consentimiento
 * haría fallar el refresh del token y, con él, agendar.
 */
export function teamsTranscriptsEnabled(): boolean {
  return process.env.TEAMS_TRANSCRIPTS === "1";
}
/**
 * Correo desde el Outlook de quien agenda (confirmación de entrevista, plan §12.26). Mail.Send
 * delegado con consentimiento de admin en Entra ID; mismo cuidado que arriba: sin el consentimiento,
 * OUTLOOK_MAIL_SEND queda apagado.
 */
export function outlookMailEnabled(): boolean {
  return process.env.OUTLOOK_MAIL_SEND === "1";
}
const SCOPES = [
  "openid",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  ...(teamsTranscriptsEnabled() ? ["OnlineMeetings.ReadWrite", "OnlineMeetingTranscript.Read.All"] : []),
  ...(outlookMailEnabled() ? ["Mail.Send"] : []),
];
// Login responde rápido; crear un evento con reunión de Teams puede tardar (sobre todo el primero de un buzón nuevo).
const LOGIN_TIMEOUT_MS = 15_000;
const GRAPH_TIMEOUT_MS = 40_000;

/** fetch con límite de tiempo; si se agota, dice en qué paso fue. */
async function timedFetch(url: string, init: RequestInit, ms: number, step: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new MicrosoftGraphError(`Microsoft no respondió en ${ms / 1000} s (${step}). Revisa en el calendario si el evento ya se creó antes de reintentar.`);
    }
    throw new MicrosoftGraphError(`No se pudo conectar con Microsoft (${step}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

/** Cookie con state, verificador PKCE y usuario mientras dura el ida y vuelta a Microsoft. */
export const OAUTH_COOKIE = "ms_oauth";

/**
 * Invitado que hace que Fireflies entre a la reunión (plan §4.3). Desde el 24 nov la transcripción es
 * la de Teams; Fireflies solo se invita si FIREFLIES_INVITEE está puesta (una cuenta con Fireflies).
 */
const FIREFLIES_BOT = process.env.FIREFLIES_INVITEE?.trim() || null;

export class MicrosoftGraphError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MicrosoftGraphError";
  }
}

const RECONNECT = "Tu conexión con Outlook venció o la revocaron. Vuelve a conectarla en Mi cuenta.";

export function microsoftEnabled(): boolean {
  return !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET && encryptionEnabled();
}

function tenant(): string {
  // "organizations" acepta cualquier cuenta de trabajo; con el tenant de Prime solo entran sus cuentas.
  return process.env.MICROSOFT_TENANT_ID || "organizations";
}

/** Tiene que coincidir con la URI registrada en Entra ID. */
export function redirectUri(origin: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || origin}/api/integrations/microsoft/callback`;
}

export function authorizeUrl({ state, codeChallenge, redirect }: { state: string; codeChallenge: string; redirect: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirect,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${LOGIN}/${tenant()}/oauth2/v2.0/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await timedFetch(`${LOGIN}/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: SCOPES.join(" "),
      ...body,
    }),
  }, LOGIN_TIMEOUT_MS, body.grant_type === "refresh_token" ? "renovar la conexión" : "iniciar sesión");
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const reason = json.error_description?.split("\r\n")[0] ?? json.error ?? `HTTP ${res.status}`;
    throw new MicrosoftGraphError(json.error === "invalid_grant" ? RECONNECT : `Microsoft rechazó el inicio de sesión: ${reason}`);
  }
  return json as TokenResponse;
}

export function exchangeCode({ code, verifier, redirect }: { code: string; verifier: string; redirect: string }) {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect });
}

/** Columnas de user_integrations a partir de la respuesta de Microsoft (tokens ya cifrados). */
export function integrationColumns(tokens: TokenResponse, accountEmail: string | null) {
  return {
    provider: "microsoft" as const,
    access_token_enc: encrypt(tokens.access_token),
    refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: (tokens.scope ?? SCOPES.join(" ")).split(" ").filter(Boolean),
    account_email: accountEmail,
  };
}

async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await graphResponse(token, path, init);
  if (res.status === 202 || res.status === 204) return null;
  return (await res.json()) as T;
}

async function graphResponse(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await timedFetch(
    `${GRAPH}${path}`,
    { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } },
    GRAPH_TIMEOUT_MS,
    `${init.method ?? "GET"} ${path.split("?")[0].replace(/\/events\/[^/]+/, "/events/…")}`,
  );
  if (res.status === 401) throw new MicrosoftGraphError(RECONNECT, 401);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (res.status === 404) throw new MicrosoftGraphError("El evento ya no existe en Outlook (¿lo borraron desde el calendario?).", 404);
    throw new MicrosoftGraphError(`Outlook respondió ${res.status}: ${json.error?.message || json.error?.code || (res.status === 503 ? "el servicio no está disponible (¿buzón recién creado?)" : "error desconocido")}`, res.status);
  }
  return res;
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const me = await graph<{ mail: string | null; userPrincipalName: string | null }>(accessToken, "/me?$select=mail,userPrincipalName");
  return me?.mail ?? me?.userPrincipalName ?? null;
}

/**
 * Token vigente del usuario, refrescado si está por vencer. null si nunca conectó Outlook.
 * Lanza MicrosoftGraphError si el refresh falla (revocado, contraseña cambiada, secreto vencido).
 */
export async function getAccessToken(userId: string): Promise<string | null> {
  if (!microsoftEnabled()) return null;
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("user_integrations")
    .select("id, access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (error) throw new MicrosoftGraphError(`No se pudo leer la conexión con Outlook: ${error.message}`);
  if (!row) return null;

  const fresh = row.expires_at && new Date(row.expires_at).getTime() - Date.now() > 2 * 60_000;
  if (fresh) return decrypt(row.access_token_enc);
  if (!row.refresh_token_enc) throw new MicrosoftGraphError(RECONNECT);

  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(row.refresh_token_enc) });
  const cols = integrationColumns(tokens, null);
  const { error: saveError } = await admin
    .from("user_integrations")
    .update({
      access_token_enc: cols.access_token_enc,
      refresh_token_enc: cols.refresh_token_enc ?? row.refresh_token_enc, // Microsoft no siempre rota el refresh token
      expires_at: cols.expires_at,
      scopes: cols.scopes,
    })
    .eq("id", row.id);
  if (saveError) throw new MicrosoftGraphError(`No se pudo guardar la conexión con Outlook: ${saveError.message}`);
  return tokens.access_token;
}

export type Attendee = { email: string; name?: string | null };

type EventInput = {
  /** Idempotencia en Graph: el mismo id no crea dos eventos si se reintenta. Usamos el id de la entrevista. */
  transactionId: string;
  subject: string;
  bodyHtml: string;
  startIso: string;
  durationMin: number;
  attendees: Attendee[];
  inviteFireflies: boolean;
};

/** "2026-10-21T16:00:00" en la zona de la app, como lo pide Graph junto con timeZone. */
function graphDate(iso: string, plusMin = 0) {
  const d = new Date(new Date(iso).getTime() + plusMin * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { dateTime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`, timeZone: TZ };
}

function attendeeList(attendees: Attendee[], inviteFireflies: boolean) {
  const seen = new Set<string>();
  const list = [...attendees, ...(inviteFireflies && FIREFLIES_BOT ? [{ email: FIREFLIES_BOT, name: "Fireflies" }] : [])];
  return list
    .filter((a) => {
      const key = a.email.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((a) => ({ emailAddress: { address: a.email.trim(), name: a.name ?? a.email }, type: "required" }));
}

type GraphEvent = { id: string; onlineMeeting?: { joinUrl?: string | null } | null; webLink?: string };

/** Evento en el calendario del dueño del token con reunión de Teams. Devuelve el id y el enlace. */
export async function createTeamsEvent(token: string, input: EventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  const event = await graph<GraphEvent>(token, "/me/events", {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: input.bodyHtml },
      start: graphDate(input.startIso),
      end: graphDate(input.startIso, input.durationMin),
      attendees: attendeeList(input.attendees, input.inviteFireflies),
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      allowNewTimeProposals: false,
      transactionId: input.transactionId,
    }),
  });
  if (!event) throw new MicrosoftGraphError("Outlook no devolvió el evento");

  let joinUrl = event.onlineMeeting?.joinUrl ?? null;
  // La reunión de Teams a veces se genera unos segundos después de crear el evento: se vuelve a
  // preguntar con espera creciente (en total ~6 s) antes de darla por perdida.
  for (const waitMs of JOIN_URL_RETRIES_MS) {
    if (joinUrl) break;
    await new Promise((r) => setTimeout(r, waitMs));
    const again = await graph<GraphEvent>(token, `/me/events/${encodeURIComponent(event.id)}?$select=id,onlineMeeting`);
    joinUrl = again?.onlineMeeting?.joinUrl ?? null;
  }
  return { eventId: event.id, joinUrl };
}

const JOIN_URL_RETRIES_MS = [0, 1000, 2000, 3000];

/**
 * Por qué un evento salió sin reunión de Teams: si el calendario no admite Teams (cuenta sin Teams en
 * su licencia o buzón recién creado) lo dice; si sí la admite, fue que Teams tardó en generarla.
 */
export async function teamsAllowedInCalendar(token: string): Promise<boolean | null> {
  try {
    const cal = await graph<{ allowedOnlineMeetingProviders?: string[] }>(token, "/me/calendar?$select=allowedOnlineMeetingProviders");
    return cal?.allowedOnlineMeetingProviders?.includes("teamsForBusiness") ?? null;
  } catch {
    return null;
  }
}

/** Manda un correo desde el buzón del dueño del token. No se guarda en Enviados. */
export async function sendMail(token: string, input: { to: Attendee[]; subject: string; html: string }): Promise<void> {
  await graph(token, "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.html },
        toRecipients: input.to.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? undefined } })),
      },
      saveToSentItems: false,
    }),
  });
}

/** Enlace de Teams del evento (null si Outlook no lo generó). */
export async function getEventJoinUrl(token: string, eventId: string): Promise<string | null> {
  const event = await graph<GraphEvent>(token, `/me/events/${encodeURIComponent(eventId)}?$select=id,onlineMeeting`);
  return event?.onlineMeeting?.joinUrl ?? null;
}

/**
 * Mueve el evento. Con `bodyHtml` también reescribe el cuerpo: la actualización que Exchange manda a
 * los invitados no siempre conserva el bloque de Teams, así que el cuerpo lleva el enlace explícito.
 */
export async function moveEvent(token: string, eventId: string, startIso: string, durationMin: number, bodyHtml?: string): Promise<void> {
  await graph(token, `/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      start: graphDate(startIso),
      end: graphDate(startIso, durationMin),
      ...(bodyHtml ? { body: { contentType: "HTML", content: bodyHtml } } : {}),
    }),
  });
}

/** Cancela el evento y Exchange avisa a los invitados. */
export async function cancelEvent(token: string, eventId: string, comment: string): Promise<void> {
  await graph(token, `/me/events/${encodeURIComponent(eventId)}/cancel`, { method: "POST", body: JSON.stringify({ comment }) });
}

// ── Grabación y transcripción de Teams (plan §12.24) ─────────────────────────────────────────────
// La reunión la crea Exchange al crear el evento; se localiza por su enlace. Solo el organizador (el
// dueño del calendario) puede activar la grabación automática y leer la transcripción.

type OnlineMeeting = { id: string; recordAutomatically?: boolean | null };

/** Reunión de Teams a partir de su enlace; null si Graph no la encuentra. */
export async function findOnlineMeeting(token: string, joinUrl: string): Promise<OnlineMeeting | null> {
  const filter = encodeURIComponent(`JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`);
  const res = await graph<{ value: OnlineMeeting[] }>(token, `/me/onlineMeetings?$filter=${filter}`);
  return res?.value?.[0] ?? null;
}

/**
 * Pide a Teams que grabe y transcriba en cuanto empiece la reunión. Devuelve false si no encontró la
 * reunión. La transcripción sale si la directiva de reuniones del inquilino la permite.
 */
export async function enableAutoRecording(token: string, joinUrl: string): Promise<boolean> {
  const meeting = await findOnlineMeeting(token, joinUrl);
  if (!meeting) return false;
  if (meeting.recordAutomatically) return true;
  await graph(token, `/me/onlineMeetings/${encodeURIComponent(meeting.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ recordAutomatically: true, allowTranscription: true }),
  });
  return true;
}

export type TeamsTranscript = { id: string; createdDateTime: string };

export async function listTranscripts(token: string, meetingId: string): Promise<TeamsTranscript[]> {
  const res = await graph<{ value: TeamsTranscript[] }>(token, `/me/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts`);
  return (res?.value ?? []).slice().sort((a, b) => a.createdDateTime.localeCompare(b.createdDateTime));
}

/** Contenido de una transcripción en WebVTT (`<v Nombre>texto</v>` por intervención). */
export async function transcriptVtt(token: string, meetingId: string, transcriptId: string): Promise<string> {
  const res = await graphResponse(token, `/me/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(transcriptId)}/content?$format=text/vtt`, {
    headers: { Accept: "text/vtt" },
  });
  return res.text();
}
