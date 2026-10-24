// Arnés de RLS sin Docker: Postgres en WASM (PGlite) con los stubs mínimos de Supabase
// (roles anon/authenticated/service_role, auth.users, auth.uid(), auth.jwt()). Carga las
// migraciones del repo tal cual (menos 0012, que necesita el esquema storage) y deja
// probar políticas cambiando de rol y de claims como lo hace PostgREST.
//
//   npm run db:rls-lite
//
// No sustituye a db:rls-check (que prueba contra Supabase real con supabase-js); cubre lo
// mismo a nivel SQL y corre en segundos en cualquier máquina.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const MANUAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../supabase/manual");
// lo que se pega en el SQL Editor después de 01 y 03, en orden
const MANUAL_AFTER_0013 = ["04_asignacion_reclutadores_y_alcance.sql", "05_captura_manual.sql", "06_catalogos.sql", "07_cancelar_contratacion.sql", "08_microsoft_teams.sql", "09_lista_negra.sql", "10_cola_de_tareas.sql", "11_permanencia_inactivos_avisos.sql"];

const STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
`;

// RLS_LITE_VIA_MANUAL=1 arma la base como la arma el usuario: migraciones hasta 0013 y luego los
// archivos que se pegan en el SQL Editor (cada uno dos veces, para probar que son re-ejecutables).
export async function boot({ upTo = "9999", skip = ["0012"] } = {}) {
  const viaManual = process.env.RLS_LITE_VIA_MANUAL === "1" && upTo > "0013";
  if (viaManual) upTo = "0013";
  const db = new PGlite();
  await db.exec(STUBS);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const n = f.slice(0, 4);
    if (n > upTo || skip.includes(n)) continue;
    let sql = readFileSync(join(MIGRATIONS, f), "utf8");
    sql = sql.replace(/create extension if not exists pgcrypto;/g, "");
    try {
      await db.exec(sql);
    } catch (e) {
      console.error(`FALLÓ ${f}: ${e.message}`);
      throw e;
    }
  }
  if (viaManual) {
    for (const name of MANUAL_AFTER_0013) {
      const manual = readFileSync(join(MANUAL_DIR, name), "utf8");
      await db.exec(manual);
      await db.exec(manual);
    }
  }
  return db;
}

/** Corre fn con la sesión de un usuario (rol authenticated + claims del JWT). user = null → anónimo; "service" → service_role. */
export async function as(db, user, fn) {
  if (user === "service") {
    await db.exec(`set role service_role; select set_config('request.jwt.claims', '', false);`);
  } else {
    const claims = user ? JSON.stringify({ sub: user.id, role: "authenticated", app_metadata: { role: user.role, client_id: user.client_id ?? null } }) : "";
    await db.exec(`set role ${user ? "authenticated" : "anon"}; select set_config('request.jwt.claims', '${claims}', false);`);
  }
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

export async function createUser(db, { email, role, client_id = null, full_name = "" }) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email, JSON.stringify({ role, client_id }), JSON.stringify({ full_name })],
  );
  return { id: rows[0].id, email, role, client_id };
}

let failures = 0;
export function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}
export const failed = () => failures;

/** Devuelve el mensaje de error si la consulta falla, o null. */
export async function errorOf(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}
