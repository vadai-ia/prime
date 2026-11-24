import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueRecurring } from "@/lib/queue/recurring";
import { runDueTasks } from "@/lib/queue/run";

// Vercel Cron una vez al día, 14:00 UTC = 8:00 en México (vercel.json; plan Hobby). Vercel manda `Authorization: Bearer <CRON_SECRET>`.
// Sin lógica de negocio: encola las tareas diarias que ya tocan y corre la cola (tasks.md §3 y §4).
// La ruta es pública en el proxy; la protege el secreto.

export const maxDuration = 60;
/** Vueltas extra que se encadena el cron cuando la cola no terminó en una (correos, WhatsApp del día). */
const MAX_HOPS = 6;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const started = Date.now();
  let queued: string[] = [];
  try {
    queued = await enqueueRecurring(createAdminClient());
  } catch (e) {
    console.error("[cron/tick] recurring", e);
  }
  const ran = await runDueTasks({ budgetMs: (maxDuration - 15) * 1000 });
  const failed = ran.filter((r) => !r.ok);
  if (failed.length > 0) console.error("[cron/tick] fallaron", failed);

  // Quedó trabajo que ya toca (se acabó el tiempo): otra vuelta en una invocación nueva, sin esperar
  // al cron de mañana. Encolar lo diario es idempotente, así que repetir la ruta es seguro.
  const hop = Number(request.nextUrl.searchParams.get("hop") ?? 0);
  const { count } = await createAdminClient()
    .from("scheduled_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString());
  const pending = count ?? 0;
  if (pending > 0 && hop < MAX_HOPS) {
    const next = new URL(request.nextUrl.pathname, request.nextUrl.origin);
    next.searchParams.set("hop", String(hop + 1));
    after(() =>
      fetch(next, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: "no-store", signal: AbortSignal.timeout(5_000) }).then(
        () => undefined,
        // El timeout es normal: solo hace falta que la otra vuelta arranque.
        (e) => (e instanceof Error && e.name === "TimeoutError" ? undefined : console.error("[cron/tick] siguiente vuelta", e)),
      ),
    );
  }

  return NextResponse.json({ queued, ran: ran.length, failed: failed.length, pending, hop, tasks: ran, ms: Date.now() - started });
}
