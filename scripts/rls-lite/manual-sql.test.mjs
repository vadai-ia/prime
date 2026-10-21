// Los archivos que se pegan en el SQL Editor (supabase/manual/04_*.sql y 05_*.sql) tienen que poder
// correrse más de una vez y sobre una base a medias, sin tocar datos. Aquí se prueba cada caso.
import { readFileSync, existsSync } from "node:fs";
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const MANUAL = readFileSync(new URL("../../supabase/manual/04_asignacion_reclutadores_y_alcance.sql", import.meta.url), "utf8");
const MANUAL_05 = readFileSync(new URL("../../supabase/manual/05_captura_manual.sql", import.meta.url), "utf8");
const MANUAL_06 = readFileSync(new URL("../../supabase/manual/06_catalogos.sql", import.meta.url), "utf8");
const MANUAL_07 = readFileSync(new URL("../../supabase/manual/07_cancelar_contratacion.sql", import.meta.url), "utf8");
const MANUAL_08 = readFileSync(new URL("../../supabase/manual/08_microsoft_teams.sql", import.meta.url), "utf8");
const MANUAL_09 = readFileSync(new URL("../../supabase/manual/09_lista_negra.sql", import.meta.url), "utf8");
const MANUAL_10 = readFileSync(new URL("../../supabase/manual/10_cola_de_tareas.sql", import.meta.url), "utf8");
const PX = "b0000000-0000-4000-8000-000000000001";

async function fresh() {
  const db = await boot({ upTo: "0013" });
  await db.exec(`
    insert into public.clients (id, name) values ('a0000000-0000-4000-8000-000000000001', 'Telasist');
    insert into public.job_profiles (id, client_id, title, status) values ('${PX}', 'a0000000-0000-4000-8000-000000000001', 'Cobranza', 'active');
  `);
  return db;
}

/** Corre el archivo y devuelve el checklist del final. */
async function runManual(db, sql = MANUAL) {
  const results = await db.exec(sql);
  return results[results.length - 1].rows;
}
const allOk = (rows, min = 16) => rows.length >= min && rows.every((r) => r.estado === "ok");
const missing = (rows) => rows.filter((r) => r.estado !== "ok").map((r) => r.objeto).join(" | ");

// --- A. base en 0013, dos veces seguidas
{
  const db = await fresh();
  const first = await runManual(db);
  check("A · primera corrida sobre 0013: checklist completo", allOk(first), missing(first));
  const again = await errorOf(() => runManual(db));
  check("A · segunda corrida no falla", !again, again ?? "");
  check("A · checklist sigue completo", allOk(await runManual(db)));
}

// --- B. base donde ya se aplicó la primera versión (no re-ejecutable) y ya hay datos
const OLD = process.env.OLD_MANUAL_04;
if (OLD && existsSync(OLD)) {
  const db = await fresh();
  await db.exec(readFileSync(OLD, "utf8"));
  const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Admin" });
  const r1 = await createUser(db, { email: "r1@t", role: "recruiter", full_name: "R1" });
  const r2 = await createUser(db, { email: "r2@t", role: "recruiter", full_name: "R2" });
  await as(db, admin, () => db.query(`select public.set_profile_recruiters($1, $2)`, [PX, [r1.id, r2.id]]));
  await as(db, "service", async () => {
    await db.query(`insert into public.candidates (full_name, phone_e164) select 'C' || g, '+52449300000' || g from generate_series(1, 4) g`);
    await db.query(`insert into public.applications (candidate_id, profile_id) select id, $1 from public.candidates`, [PX]);
  });
  const snapshot = () => db.query(`select
      (select count(*)::int from public.job_profile_assignments) as teams,
      (select count(*)::int from public.job_profile_assignment_events) as events,
      (select string_agg(assigned_recruiter_id::text, ',' order by id) from public.applications) as owners,
      (select string_agg(turn_seq::text, ',' order by recruiter_id) from public.job_profile_assignments) as turns`).then((r) => JSON.stringify(r.rows[0]));
  const before = await snapshot();

  const dup = await errorOf(() => db.exec(readFileSync(OLD, "utf8")));
  await db.exec("rollback"); // aquí hay una sola conexión; el SQL Editor descarta la suya y el efecto es el mismo
  check("B · la versión anterior sí falla al repetirse (el error que viste)", /assignment_action.*already exists/.test(dup ?? ""), dup ?? "sin error");
  check("B · y esa corrida fallida no cambió nada", (await snapshot()) === before);

  const rows = await runManual(db);
  check("B · la versión nueva corre encima de la anterior: checklist completo", allOk(rows), missing(rows));
  check("B · asignaciones, historial, candidatos repartidos y turnos intactos", (await snapshot()) === before, `${before} → ${await snapshot()}`);
  const seen = await as(db, r1, () => db.query(`select count(*)::int as n from public.applications`));
  check("B · el reclutador sigue viendo solo sus 2 candidatos", seen.rows[0].n === 2, `${seen.rows[0].n}`);
} else {
  console.log("     (caso B omitido: define OLD_MANUAL_04 con la ruta de la versión anterior del archivo)");
}

// --- C. base a medias: solo existen los tipos y una tabla
{
  const db = await fresh();
  await db.exec(`
    create type public.assignment_action as enum ('assigned', 'unassigned');
    create type public.assignment_source as enum ('manual', 'user_deactivated', 'role_changed');
    create table public.job_profile_assignments (
      profile_id uuid not null references public.job_profiles (id) on delete cascade,
      recruiter_id uuid not null references public.users (id) on delete cascade,
      assigned_by uuid references public.users (id) on delete set null,
      assigned_at timestamptz not null default now(),
      primary key (profile_id, recruiter_id)
    );
  `);
  const rows = await runManual(db);
  check("C · base a medias: la corrida la completa", allOk(rows), missing(rows));
}

// --- D. archivo 05 (captura manual): dos veces, y avisa si se corre sin el 04
{
  const db = await fresh();
  await runManual(db);
  const first = await runManual(db, MANUAL_05);
  check("D · 05 sobre una base con el 04: checklist completo", allOk(first, 4), missing(first));
  const again = await errorOf(() => runManual(db, MANUAL_05));
  check("D · 05 por segunda vez no falla", !again, again ?? "");
  const iv = await errorOf(() => db.query(`select 'completed'::public.interview_status`));
  check("D · el estado completed ya existe", !iv, iv ?? "");

  const bare = await fresh();
  const rows = await runManual(bare, MANUAL_05).catch((e) => e.message);
  check("D · 05 sin el 04: no deja nada roto y el checklist lo dice", typeof rows === "string" || rows.some((r) => r.estado === "FALTA"), typeof rows === "string" ? rows : missing(rows));
}

// --- E. archivo 06 (catálogos): una base armada solo con archivos manuales no trae la semilla
{
  const db = await boot({ upTo: "0013" });
  await runManual(db);
  await runManual(db, MANUAL_05);
  const before = await db.query(`select count(*)::int as n from public.document_types`);
  check("E · sin el 06 el catálogo del expediente está vacío (lo que pasó en la base real)", before.rows[0].n === 0, `${before.rows[0].n}`);
  const first = await runManual(db, MANUAL_06);
  check("E · 06: checklist completo", allOk(first, 3), missing(first));
  await db.query(`update public.document_types set label = 'INE editada' where key = 'ine'`);
  const again = await runManual(db, MANUAL_06);
  const ine = await db.query(`select label from public.document_types where key = 'ine'`);
  const total = await db.query(`select (select count(*) from public.document_types)::int as docs, (select count(*) from public.wa_templates)::int as tpl`);
  check("E · 06 por segunda vez: mismo catálogo, sin duplicar", allOk(again, 3) && total.rows[0].docs === 10 && total.rows[0].tpl === 6 && ine.rows[0].label.startsWith("INE ("), JSON.stringify(total.rows[0]));
}

// --- F. archivo 07 (cancelar contratación): dos veces
{
  const db = await boot({ upTo: "0013" });
  await runManual(db);
  await runManual(db, MANUAL_05);
  await runManual(db, MANUAL_06);
  const first = await runManual(db, MANUAL_07);
  check("F · 07: checklist completo", allOk(first, 2), missing(first));
  const again = await errorOf(() => runManual(db, MANUAL_07));
  check("F · 07 por segunda vez no falla", !again, again ?? "");
}

// --- G. archivo 08 (Teams y Microsoft): dos veces, y la entrevista nueva sale en Teams
{
  const db = await fresh();
  await runManual(db);
  await runManual(db, MANUAL_05);
  await runManual(db, MANUAL_06);
  await runManual(db, MANUAL_07);
  await db.exec(`
    insert into public.candidates (id, full_name, phone_e164) values ('c0000000-0000-4000-8000-000000000001', 'Ana', '+524493000001');
    insert into public.applications (id, candidate_id, profile_id) values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '${PX}');
    insert into public.interviews (application_id, type) values ('d0000000-0000-4000-8000-000000000001', 'prime');
  `);
  const first = await runManual(db, MANUAL_08);
  check("G · 08: checklist completo", allOk(first, 4), missing(first));
  const again = await errorOf(() => runManual(db, MANUAL_08));
  check("G · 08 por segunda vez no falla", !again, again ?? "");
  await db.exec(`insert into public.interviews (application_id, type) values ('d0000000-0000-4000-8000-000000000001', 'client')`);
  const platforms = await db.query(`select string_agg(platform::text, ',' order by created_at, type) as p from public.interviews`);
  check("G · la entrevista vieja de Meet pasa a Teams y la nueva sale en Teams", platforms.rows[0].p === "teams,teams", platforms.rows[0].p);
  const user = await createUser(db, { email: "r@t", role: "recruiter", full_name: "R" });
  const saved = await errorOf(() => db.query(`insert into public.user_integrations (user_id, provider, access_token_enc) values ($1, 'microsoft', 'x')`, [user.id]));
  check("G · user_integrations acepta microsoft", !saved, saved ?? "");
}

// --- H. archivo 09 (lista negra): dos veces, con un registro de por medio
{
  const db = await fresh();
  for (const sql of [MANUAL, MANUAL_05, MANUAL_06, MANUAL_07, MANUAL_08]) await runManual(db, sql);
  const first = await runManual(db, MANUAL_09);
  check("H · 09: checklist completo", allOk(first, 5), missing(first));
  const admin = await createUser(db, { email: "admin9@t", role: "admin", full_name: "Admin" });
  const [c] = (await db.query(`insert into public.candidates (full_name, phone_e164) values ('Vetada', '+524493000009') returning id`)).rows;
  await as(db, admin, () => db.query(`select public.blacklist_candidate($1, 'other')`, [c.id]));
  const again = await errorOf(() => runManual(db, MANUAL_09));
  check("H · 09 por segunda vez no falla", !again, again ?? "");
  const kept = await db.query(`select count(*)::int as n from public.candidate_blacklist where removed_at is null`);
  check("H · 09 por segunda vez conserva la lista", kept.rows[0].n === 1, `${kept.rows[0].n}`);
}

// --- I. archivo 10 (cola de tareas): dos veces, con tareas en la cola de por medio
{
  const db = await fresh();
  for (const sql of [MANUAL, MANUAL_05, MANUAL_06, MANUAL_07, MANUAL_08, MANUAL_09]) await runManual(db, sql);
  await db.exec(`insert into public.scheduled_tasks (type) values ('cv_score'), ('followups_due')`);
  const first = await runManual(db, MANUAL_10);
  check("I · 10: checklist completo", allOk(first, 5), missing(first));
  const again = await errorOf(() => runManual(db, MANUAL_10));
  check("I · 10 por segunda vez no falla", !again, again ?? "");
  check("I · 10 por segunda vez sigue completo", allOk(await runManual(db, MANUAL_10), 5));
  const kept = await db.query(`select count(*)::int as n from public.scheduled_tasks where status = 'pending'`);
  check("I · las tareas que ya estaban se quedan", kept.rows[0].n === 2, `${kept.rows[0].n}`);
}

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
