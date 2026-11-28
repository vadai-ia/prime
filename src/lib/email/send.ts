import "server-only";

// Envío de los correos automáticos (plan §12.29). Sale desde el buzón compartido de Prime
// (`REPORTS_MAILBOX`, p. ej. reportes@primehrinnovation.com.mx) con Microsoft Graph y un token de la
// aplicación (client credentials). No depende de que alguien tenga su Outlook conectado. Exchange
// restringe la app a ese buzón (RBAC for Applications, `microsoft365-pasos.md`), así que no puede
// mandar como nadie más.
//
// Resend (la opción anterior, plan §12.23) queda como respaldo: solo se usa si no hay buzón de
// Outlook y sí están RESEND_API_KEY y RESEND_FROM.

const TIMEOUT_MS = 30_000;
const LOGIN = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

export class EmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailError";
  }
  /** 4xx salvo 429: el buzón, el permiso o el correo están mal; reintentar no sirve. */
  get permanent() {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

export type Attachment = { filename: string; content: Buffer };
type Message = { to: string[]; subject: string; html: string; attachments?: Attachment[]; replyTo?: string };

// ---------------------------------------------------------------------------
// Qué envío está activo
// ---------------------------------------------------------------------------

const mailbox = () => process.env.REPORTS_MAILBOX?.trim() || null;
// Client credentials necesita el inquilino de Prime; "organizations" o "common" no sirven aquí.
const tenant = () => {
  const t = process.env.MICROSOFT_TENANT_ID?.trim();
  return t && t !== "organizations" && t !== "common" ? t : null;
};

export function outlookReportsEnabled(): boolean {
  return !!mailbox() && !!tenant() && !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;
}

function resendEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;
}

export function emailEnabled(): boolean {
  return outlookReportsEnabled() || resendEnabled();
}

/** Para Configuración y los logs: desde dónde sale, o qué falta. */
export function emailStatus(): { configured: boolean; detail: string } {
  if (outlookReportsEnabled()) return { configured: true, detail: `Outlook, desde ${mailbox()}` };
  if (resendEnabled()) return { configured: true, detail: `Resend, desde ${process.env.RESEND_FROM}` };
  const missing = [!mailbox() && "REPORTS_MAILBOX", !tenant() && "MICROSOFT_TENANT_ID", !process.env.MICROSOFT_CLIENT_ID && "MICROSOFT_CLIENT_ID", !process.env.MICROSOFT_CLIENT_SECRET && "MICROSOFT_CLIENT_SECRET"].filter(Boolean);
  return { configured: false, detail: `Falta ${missing.join(", ")} (correo por Outlook desde reportes@)` };
}

export async function sendEmail(input: Message): Promise<{ id: string }> {
  if (input.to.length === 0) throw new EmailError("El correo no tiene destinatarios", 400);
  if (outlookReportsEnabled()) return sendWithGraph(input);
  if (resendEnabled()) return sendWithResend(input);
  throw new EmailError(emailStatus().detail, 400);
}

// ---------------------------------------------------------------------------
// Outlook (Microsoft Graph, token de aplicación)
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function timed(url: string, init: RequestInit, step: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new EmailError(timeout ? `Microsoft no respondió a tiempo (${step})` : `No se pudo conectar con Microsoft (${step})`, 0);
  }
}

async function appToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await timed(
    `${LOGIN}/${tenant()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
    "token de la aplicación",
  );
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const reason = json.error_description?.split("\r\n")[0] ?? json.error ?? `HTTP ${res.status}`;
    // 400/401: secreto vencido, inquilino equivocado o app sin consentimiento: reintentar no sirve.
    throw new EmailError(`Microsoft rechazó el token de la aplicación: ${reason}`, res.status >= 500 ? res.status : 400);
  }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function sendWithGraph(input: Message): Promise<{ id: string }> {
  const from = mailbox()!;
  const token = await appToken();
  const message = {
    subject: input.subject,
    body: { contentType: "HTML", content: input.html },
    toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
    ...(input.replyTo ? { replyTo: [{ emailAddress: { address: input.replyTo } }] } : {}),
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.filename,
            contentType: a.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
            contentBytes: a.content.toString("base64"),
          })),
        }
      : {}),
  };
  const res = await timed(
    `${GRAPH}/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // Se guarda en Enviados de reportes@: ahí queda la copia de lo que recibió cada cliente.
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
    "enviar correo",
  );
  if (res.status === 202) {
    // Graph no devuelve id del mensaje; report_runs guarda desde dónde salió y la hora.
    return { id: `outlook:${from}:${new Date().toISOString()}` };
  }
  if (res.status === 401) cachedToken = null;
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  const detail = json.error?.message || json.error?.code || `HTTP ${res.status}`;
  if (res.status === 403 || json.error?.code === "ErrorAccessDenied") {
    throw new EmailError(`La aplicación no tiene permiso para mandar desde ${from}. Falta Mail.Send de aplicación restringido a ese buzón (microsoft365-pasos.md). Detalle: ${detail}`, 403);
  }
  if (res.status === 404 || json.error?.code === "ErrorInvalidUser" || json.error?.code === "MailboxNotEnabledForRESTAPI") {
    throw new EmailError(`No existe el buzón ${from} o todavía no está listo (REPORTS_MAILBOX). Detalle: ${detail}`, 404);
  }
  throw new EmailError(`Outlook respondió ${res.status}: ${detail}`, res.status);
}

// ---------------------------------------------------------------------------
// Resend (respaldo)
// ---------------------------------------------------------------------------

async function sendWithResend(input: Message): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY!;
  const from = process.env.RESEND_FROM!;
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new EmailError(e instanceof Error && e.name === "TimeoutError" ? "Resend no respondió a tiempo" : "No se pudo conectar con Resend", 0);
  }
  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) throw new EmailError(body?.message ?? `Resend respondió ${res.status}`, res.status);
  if (!body?.id) throw new EmailError("Resend no devolvió el id del correo", 500);
  return { id: body.id };
}
