// Recorre todas las rutas con cada rol y verifica que rendericen (200) sin
// errores de servidor. Pensado para MOCK_DATA=1 contra la base local.
//   node --env-file=.env.local scripts/smoke-pages.mjs   (o con variables inline)

import { createClient } from "@supabase/supabase-js";

const APP = process.env.SMOKE_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = process.env.SMOKE_PASSWORD ?? "Prime2026!";
const COOKIE = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

const STAFF_ROUTES = [
  "/tablero",
  "/clientes",
  "/clientes/a0000000-0000-4000-8000-000000000001",
  "/perfiles",
  "/perfiles/p-cobranza",
  "/perfiles/p-diseno",
  "/perfiles/p-auxiliar",
  "/perfiles/levantamiento",
  "/candidatos",
  "/candidatos?view=lista",
  "/candidatos?stage=discarded&view=kanban",
  "/candidatos?profile=p-cobranza&q=ana",
  "/candidatos/app-01",
  "/candidatos/app-02",
  "/candidatos/app-03",
  "/candidatos/app-07",
  "/candidatos/app-08",
  "/candidatos/app-09",
  "/candidatos/app-10",
  "/candidatos/app-13",
  "/candidatos/app-24",
  "/entrevistas",
  "/reportes",
  "/reportes?client=a0000000-0000-4000-8000-000000000001&profile=p-cobranza",
];
const ADMIN_ROUTES = ["/configuracion", "/clientes/nuevo"];
const CLIENT_ROUTES = ["/portal", "/portal/candidatos", "/portal/candidatos?stage=hired", "/portal/candidatos/app-02", "/portal/candidatos/app-01", "/portal/candidatos/app-04", "/portal/semanal"];

// Solo en respuestas 200: el payload RSC de toda página incluye el texto del not-found boundary, así que no sirve como marcador.
const ERROR_MARKERS = ["Application error", "Internal Server Error", "Unhandled Runtime Error", "\"digest\""];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

async function cookieFor(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  if (value.length <= 3180) return `${COOKIE}=${value}`;
  return value.match(/.{1,3180}/g).map((chunk, i) => `${COOKIE}.${i}=${chunk}`).join("; ");
}

async function visit(path, cookie) {
  const res = await fetch(APP + path, { redirect: "manual", headers: { cookie } });
  const body = await res.text();
  const marker = res.status === 200 ? ERROR_MARKERS.find((m) => body.includes(m)) : undefined;
  return { status: res.status, marker, location: res.headers.get("location") ?? "" };
}

for (const [email, routes, label] of [
  ["admin@prime.local", [...STAFF_ROUTES, ...ADMIN_ROUTES], "admin"],
  ["reclutador@prime.local", STAFF_ROUTES, "recruiter"],
  ["cliente@prime.local", CLIENT_ROUTES, "client"],
]) {
  const cookie = await cookieFor(email);
  for (const path of routes) {
    const r = await visit(path, cookie);
    check(`${label} ${path}`, r.status === 200 && !r.marker, `${r.status}${r.marker ? " · " + r.marker : ""}${r.location ? " → " + r.location : ""}`);
  }
  // recruiter no debe entrar a configuración; client no debe ver rutas de Prime
  if (label === "recruiter") {
    for (const p of ADMIN_ROUTES) {
      const r = await visit(p, cookie);
      check(`recruiter ${p} redirige`, r.status === 307, `${r.status} ${r.location}`);
    }
  }
  if (label === "client") {
    const r = await visit("/candidatos", cookie);
    check("client /candidatos redirige a /portal", r.status === 307 && r.location.endsWith("/portal"), `${r.status} ${r.location}`);
  }
}

// 404 esperados
{
  const cookie = await cookieFor("admin@prime.local");
  const r = await visit("/candidatos/no-existe", cookie);
  check("ficha inexistente → 404", r.status === 404, `${r.status}`);
}

console.log(failures === 0 ? "\nTodas las páginas renderizan." : `\n${failures} páginas fallaron.`);
process.exit(failures === 0 ? 0 : 1);
