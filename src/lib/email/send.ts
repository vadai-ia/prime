import "server-only";

// Envío por Resend (plan §6.6, tasks.md §3) con su API REST: sin SDK. El remitente es una dirección
// del dominio ya verificado en Resend (RESEND_FROM, p. ej. "Prime HR Innovation <recursoshumanos@…>").

const TIMEOUT_MS = 20_000;

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;
}

export class EmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailError";
  }
  /** 4xx salvo 429: el correo o la llave están mal; reintentar no sirve. */
  get permanent() {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

export type Attachment = { filename: string; content: Buffer };

export async function sendEmail(input: { to: string[]; subject: string; html: string; attachments?: Attachment[]; replyTo?: string }): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new EmailError("Faltan RESEND_API_KEY o RESEND_FROM en el servidor", 400);
  if (input.to.length === 0) throw new EmailError("El correo no tiene destinatarios", 400);

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
