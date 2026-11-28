"use server";

import { assertAdmin, UnauthorizedError } from "@/lib/dal";
import { emailEnabled, emailStatus, sendEmail } from "@/lib/email/send";

export type TestEmailState = { error?: string; message?: string } | undefined;

/**
 * Configuración → Integraciones (solo admin): manda un correo de prueba al admin en sesión desde el
 * buzón de reportes, para confirmar que Outlook ya manda sin esperar al cron de las 8:00.
 */
export async function sendTestEmail(): Promise<TestEmailState> {
  let email: string | null;
  try {
    ({ email } = await assertAdmin());
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (!email) return { error: "Tu cuenta no tiene correo." };
  if (!emailEnabled()) return { error: emailStatus().detail };
  try {
    await sendEmail({
      to: [email],
      subject: "Prueba de correos automáticos · Prime HR Innovation",
      html:
        "<p>Si te llegó este correo, los reportes automáticos ya pueden salir.</p>" +
        `<p style="color:#525252;font-size:12px">Enviado ${new Date().toLocaleString("es-MX", { timeZone: process.env.APP_TIMEZONE || "America/Mexico_City" })} · ${emailStatus().detail}.</p>`,
    });
    return { message: `Enviado a ${email}. Revisa tu bandeja (y la de no deseados).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
