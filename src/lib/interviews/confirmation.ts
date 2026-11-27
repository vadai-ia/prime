import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken, MicrosoftGraphError, outlookMailEnabled, sendMail } from "@/lib/integrations/microsoft-graph";
import { fmtDateLong, fmtPhone, fmtTime } from "@/lib/format";

// Confirmación de entrevista agendada (plan §12.26): un correo a quien agendó, desde su propio Outlook,
// con fecha, hora, candidato, vacante, cliente y enlace de Teams. Lo encola scheduleInterview y corre
// al momento; si Outlook falla, la cola reintenta. El correo es interno (va al reclutador), así que
// sí lleva cliente y teléfono; el candidato nunca lo ve.

type Admin = ReturnType<typeof createAdminClient>;
type Outcome = { ok: true; detail?: string } | { ok: false; error: string; retry: boolean };

export function interviewConfirmationKey(interviewId: string): string {
  return `interview_confirm_email:${interviewId}`;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://app.primehrinnovation.com.mx";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendInterviewConfirmation(admin: Admin, interviewId: string): Promise<Outcome> {
  if (!outlookMailEnabled()) return { ok: false, error: "El correo por Outlook no está activado (OUTLOOK_MAIL_SEND=1 y Mail.Send en Entra ID).", retry: false };

  const { data: iv, error } = await admin
    .from("interviews")
    .select(
      "id, type, status, scheduled_at, duration_min, meeting_url, calendar_owner_id, client_interviewer_name, interviewer:users!interviews_interviewer_user_id_fkey(full_name), applications(id, candidates(full_name, phone_e164), job_profiles(title, clients(name)))",
    )
    .eq("id", interviewId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, retry: true };
  if (!iv) return { ok: true, detail: "La entrevista ya no existe" };
  if (iv.status !== "scheduled") return { ok: true, detail: `No se mandó: la entrevista está en ${iv.status}` };
  if (!iv.calendar_owner_id) return { ok: false, error: "La entrevista no tiene quién la agendó", retry: false };

  const { data: owner } = await admin.from("users").select("email, full_name").eq("id", iv.calendar_owner_id).maybeSingle();
  if (!owner?.email) return { ok: false, error: "Quien agendó no tiene correo en su cuenta", retry: false };

  const app = iv.applications;
  const candidate = app?.candidates?.full_name ?? "Candidato";
  const title = app?.job_profiles?.title ?? "Vacante";
  const client = app?.job_profiles?.clients?.name ?? "";
  const kind = iv.type === "prime" ? "Entrevista Prime" : "Entrevista con cliente";
  const when = iv.scheduled_at ? `${fmtDateLong(iv.scheduled_at)}, ${fmtTime(iv.scheduled_at)}` : "Sin fecha";
  const interviewer = iv.type === "prime" ? iv.interviewer?.full_name : iv.client_interviewer_name;

  const rows: [string, string][] = [
    ["Candidato", candidate],
    ["Teléfono", app?.candidates?.phone_e164 ? fmtPhone(app.candidates.phone_e164) : "—"],
    ["Vacante", client ? `${title} · ${client}` : title],
    ["Cuándo", `${when} (${iv.duration_min} min)`],
    ...(interviewer ? ([["Entrevista", interviewer]] as [string, string][]) : []),
  ];
  const html =
    `<p>Hola ${escapeHtml((owner.full_name ?? "").split(" ")[0] || "")}:</p>` +
    `<p>La <b>${kind.toLowerCase()}</b> quedó agendada correctamente y ya está en tu calendario de Outlook.</p>` +
    `<table cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:14px">` +
    rows.map(([k, v]) => `<tr><td style="color:#525252;padding-right:12px">${k}</td><td><b>${escapeHtml(v)}</b></td></tr>`).join("") +
    `</table>` +
    (iv.meeting_url ? `<p><a href="${escapeHtml(iv.meeting_url)}">Unirse a la reunión de Teams</a></p>` : "") +
    (app?.id ? `<p><a href="${appUrl()}/candidatos/${app.id}">Abrir la ficha del candidato</a></p>` : "") +
    `<p style="color:#525252;font-size:12px">Correo automático de Prime HR Innovation.</p>`;

  try {
    const token = await getAccessToken(iv.calendar_owner_id);
    if (!token) return { ok: false, error: "Quien agendó ya no tiene Outlook conectado", retry: false };
    await sendMail(token, { to: [{ email: owner.email, name: owner.full_name }], subject: `Agendada: ${kind} · ${candidate} · ${when}`, html });
    return { ok: true, detail: `enviado a ${owner.email}` };
  } catch (e) {
    if (e instanceof MicrosoftGraphError) {
      // 401/403: conexión vencida o falta el permiso Mail.Send; reintentar no lo arregla
      const permanent = e.status === 401 || e.status === 403;
      return { ok: false, error: e.message, retry: !permanent };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e), retry: true };
  }
}
