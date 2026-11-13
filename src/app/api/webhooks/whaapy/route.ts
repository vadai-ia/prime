import { createHash } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/integrations/whaapy";
import { processWhaapyEvent, webhookExternalId } from "@/lib/whatsapp/ingest";
import { runTaskNow } from "@/lib/queue/run";

// Webhook de Whaapy (plan §4.1). Pública en el proxy (/api/webhooks/); la protege la firma HMAC.
// Cada aviso se guarda en webhook_events antes de procesarse: si llega repetido y ya se procesó,
// se contesta 200 sin tocar nada; si falló, Whaapy lo reintenta (3 veces) y se vuelve a procesar.
// Whaapy espera respuesta en 30 s y apaga el webhook tras 10 fallos seguidos.

export const maxDuration = 30;

const envelope = z.object({ event: z.string(), timestamp: z.string().optional(), data: z.unknown() });

export async function POST(request: NextRequest) {
  if (!process.env.WHAAPY_WEBHOOK_SECRET) return NextResponse.json({ error: "Falta WHAAPY_WEBHOOK_SECRET en el servidor" }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  let body: z.infer<typeof envelope>;
  try {
    body = envelope.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const receivedAt = new Date().toISOString();
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  const externalId = webhookExternalId(body.event, body.data, body.timestamp, digest);

  const { data: inserted, error: insertError } = await admin
    .from("webhook_events")
    .insert({ source: "whaapy", event_type: body.event, external_id: externalId, payload: JSON.parse(raw) as Json })
    .select("id, attempts")
    .single();

  let event = inserted;
  if (insertError?.code === "23505") {
    const { data: existing } = await admin.from("webhook_events").select("id, attempts, processed_at").eq("source", "whaapy").eq("external_id", externalId).single();
    if (!existing || existing.processed_at) return NextResponse.json({ received: true, duplicate: true });
    event = existing;
  } else if (insertError || !inserted) {
    console.error("[whaapy] webhook_events", insertError?.message);
    return NextResponse.json({ error: "No se pudo guardar el aviso" }, { status: 500 });
  }
  if (!event) return NextResponse.json({ received: true });

  try {
    const result = await processWhaapyEvent(admin, body.event, body.data, receivedAt);
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null, attempts: event.attempts + 1 })
      .eq("id", event.id);
    const taskId = result.mediaTaskId;
    if (taskId) after(() => runTaskNow(taskId).then(() => undefined, (e) => console.error("[whaapy] media", taskId, e)));
    return NextResponse.json({ received: true, detail: result.detail });
  } catch (e) {
    const message = e instanceof z.ZodError ? `Payload no esperado: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message}` : e instanceof Error ? e.message : String(e);
    console.error("[whaapy] webhook", body.event, message);
    await admin.from("webhook_events").update({ error: message.slice(0, 2000), attempts: event.attempts + 1 }).eq("id", event.id);
    // Un payload que no entendemos no se arregla reintentando: 200 para que Whaapy no apague el webhook.
    return NextResponse.json({ received: true, error: message }, { status: e instanceof z.ZodError ? 200 : 500 });
  }
}
