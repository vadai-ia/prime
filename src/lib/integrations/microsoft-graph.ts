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
const SCOPES = ["openid", "email", "offline_access", "User.Read", "Calendars.ReadWrite"];
const TIMEOUT_MS = 15_000;
const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

/** Cookie con state, verificador PKCE y usuario mientras dura el ida y vuelta a Microsoft. */
export const OAUTH_COOKIE = "ms_oauth";

/** Invitado que hace que Fireflies entre a la reunión y la transcriba (plan §4.3). */
const FIREFLIES_BOT = "fred@fireflies.ai";

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
  const res = await fetch(`${LOGIN}/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: SCOPES.join(" "),
      ...body,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
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
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) throw new MicrosoftGraphError(RECONNECT, 401);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (res.status === 404) throw new MicrosoftGraphError("El evento ya no existe en Outlook (¿lo borraron desde el calendario?).", 404);
    throw new MicrosoftGraphError(`Outlook respondió ${res.status}: ${json.error?.message ?? json.error?.code ?? "error desconocido"}`, res.status);
  }
  if (res.status === 202 || res.status === 204) return null;
  return (await res.json()) as T;
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
  const list = [...attendees, ...(inviteFireflies ? [{ email: FIREFLIES_BOT, name: "Fireflies" }] : [])];
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
  if (!joinUrl) {
    // A veces la reunión de Teams se genera unos instantes después de crear el evento
    const again = await graph<GraphEvent>(token, `/me/events/${encodeURIComponent(event.id)}?$select=id,onlineMeeting`);
    joinUrl = again?.onlineMeeting?.joinUrl ?? null;
  }
  return { eventId: event.id, joinUrl };
}

export async function moveEvent(token: string, eventId: string, startIso: string, durationMin: number): Promise<void> {
  await graph(token, `/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({ start: graphDate(startIso), end: graphDate(startIso, durationMin) }),
  });
}

/** Cancela el evento y Exchange avisa a los invitados. */
export async function cancelEvent(token: string, eventId: string, comment: string): Promise<void> {
  await graph(token, `/me/events/${encodeURIComponent(eventId)}/cancel`, { method: "POST", body: JSON.stringify({ comment }) });
}
