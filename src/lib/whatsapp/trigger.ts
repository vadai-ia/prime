import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { whaapyEnabled } from "@/lib/integrations/whaapy";
import { runTaskNow } from "@/lib/queue/run";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Encola un mensaje automático de WhatsApp desde una Server Action ya autorizada y lo corre al
 * responder, sin esperar al cron. Lo que pasó en la pantalla ya quedó guardado: un fallo aquí no lo
 * deshace (si falla al mandar, la cola lo reintenta y queda en Configuración → Logs).
 */
export async function triggerWhatsApp(label: string, enqueueTask: (admin: Admin) => Promise<string | null>): Promise<void> {
  if (!whaapyEnabled()) return;
  try {
    const taskId = await enqueueTask(createAdminClient());
    if (taskId) after(() => runTaskNow(taskId).then(() => undefined, (e) => console.error(`[whaapy] ${label}`, taskId, e)));
  } catch (e) {
    console.error(`[whaapy] no se pudo encolar ${label}`, e);
  }
}
