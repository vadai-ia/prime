// Corre el cron de la cola a mano contra la app local (o la que diga APP_URL), como lo haría
// Vercel cada minuto. Uso: npm run queue:tick  (con npm run dev corriendo). Con --watch repite cada minuto.
const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("Falta CRON_SECRET en .env (cualquier texto largo; el mismo que en Vercel).");
  process.exit(1);
}

async function tick() {
  const res = await fetch(`${base}/api/cron/tick`, { headers: { Authorization: `Bearer ${secret}` } }).catch((e) => {
    if (e?.cause?.code !== "ECONNREFUSED") throw e;
    console.error(`No hay app en ${base}: deja corriendo npm run dev y usa otra terminal para el tick.`);
    return null;
  });
  if (!res) return;
  const body = await res.json().catch(() => ({}));
  const when = new Date().toLocaleTimeString("es-MX");
  if (!res.ok) return console.error(`${when} · ${res.status}`, body);
  console.log(`${when} · encoladas ${body.queued?.length ?? 0} · corridas ${body.ran} · fallidas ${body.failed} · ${body.ms} ms`);
  for (const t of body.tasks ?? []) console.log(`   ${t.ok ? "ok  " : "FAIL"} ${t.type} ${t.detail ?? t.error ?? ""}`);
}

await tick();
if (process.argv.includes("--watch")) setInterval(tick, 60_000);
