// Prueba de humo de auth end-to-end contra `next dev`:
// entra con supabase-js, arma la cookie que espera @supabase/ssr y pide páginas
// con cada rol para verificar proxy.ts + dal.ts + RLS en el render.
//   npm run smoke   (requiere supabase start, db:seed-users y next dev en :3000)

import { createClient } from "@supabase/supabase-js";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Prime2026!";

const ref = new URL(url).hostname.split(".")[0];
const COOKIE = `sb-${ref}-auth-token`;

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
  if (value.length > 3180) {
    // @supabase/ssr parte cookies largas en chunks .0, .1, …
    const chunks = value.match(/.{1,3180}/g);
    return chunks.map((chunk, i) => `${COOKIE}.${i}=${chunk}`).join("; ");
  }
  return `${COOKIE}=${value}`;
}

async function get(path, cookie) {
  const res = await fetch(APP + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", body };
}

// Sin sesión
{
  const r = await get("/tablero");
  check("sin sesión: /tablero → /login", r.status === 307 && r.location.includes("/login"), `${r.status} ${r.location}`);
  const l = await get("/login");
  check("sin sesión: /login responde 200", l.status === 200 && l.body.includes("Equipo Prime"), `${l.status}`);
  const p = await get("/portal");
  check("sin sesión: /portal → /login", p.status === 307 && p.location.includes("/login"), `${p.status} ${p.location}`);
}

// Admin
{
  const cookie = await cookieFor("admin@prime.local");
  const t = await get("/tablero", cookie);
  check("admin: /tablero 200 con contenido", t.status === 200 && t.body.includes("Requiere tu atención"), `${t.status}`);
  check("admin: sidebar muestra Configuración", t.body.includes("Configuración"));
  const p = await get("/portal", cookie);
  check("admin: /portal → /tablero", p.status === 307 && p.location.endsWith("/tablero"), `${p.status} ${p.location}`);
  const l = await get("/login", cookie);
  check("admin: /login → /tablero", l.status === 307 && l.location.endsWith("/tablero"), `${l.status} ${l.location}`);
}

// Reclutador
{
  const cookie = await cookieFor("reclutador@prime.local");
  const t = await get("/tablero", cookie);
  check("recruiter: /tablero 200", t.status === 200 && t.body.includes("Reclutador"), `${t.status}`);
  check("recruiter: sin Configuración en el menú", !t.body.includes("Configuración"));
}

// Cliente
{
  const cookie = await cookieFor("cliente@prime.local");
  const p = await get("/portal", cookie);
  check("client: /portal 200 con su empresa", p.status === 200 && p.body.includes("Telasist"), `${p.status}`);
  const t = await get("/tablero", cookie);
  check("client: /tablero → /portal", t.status === 307 && t.location.endsWith("/portal"), `${t.status} ${t.location}`);
  const r = await get("/", cookie);
  check("client: / → /portal", r.status === 307 && r.location.endsWith("/portal"), `${r.status} ${r.location}`);
}

console.log(failures === 0 ? "\nSmoke test OK." : `\n${failures} verificaciones fallaron.`);
process.exit(failures === 0 ? 0 : 1);
