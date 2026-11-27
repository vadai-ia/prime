// Distintivo de contratado (migración 0034): lo pone y lo quita la base cuando una postulación entra
// o sale de Contratado; nadie lo escribe a mano y se ve en v_pipeline.
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const CX = "a0000000-0000-4000-8000-000000000001";
const PX = "b0000000-0000-4000-8000-000000000001";
const PY = "b0000000-0000-4000-8000-000000000002";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X');
  insert into public.job_profiles (id, client_id, title, status) values ('${PX}', '${CX}', 'Vacante X', 'active'), ('${PY}', '${CX}', 'Vacante Y', 'active');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin" });
const A = await createUser(db, { email: "a@t", role: "recruiter" });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));

const svc = (sql, params) => as(db, "service", () => q(sql, params));
const badge = async (id) => (await svc(`select hired_badge_at, hired_application_id from public.candidates where id = $1`, [id]))[0];
const stage = (app, to) => svc(`update public.applications set stage = $2::public.application_stage where id = $1`, [app, to]);

const [c] = await svc(`insert into public.candidates (full_name, phone_e164) values ('Ana', '+524493000001') returning id`);
const [a1] = await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PX]);
const [a2] = await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PY]);

check("sin contratar no hay distintivo", (await badge(c.id)).hired_badge_at === null);

await stage(a1.id, "hired");
let b = await badge(c.id);
check("al contratar se pone el distintivo con su postulación", b.hired_badge_at !== null && b.hired_application_id === a1.id);

// nadie lo escribe a mano: ni el reclutador al editar ni el service role
await as(db, A, () => q(`update public.candidates set hired_badge_at = null, hired_application_id = null, notes = 'editado' where id = $1`, [c.id]));
b = await badge(c.id);
check("editar al candidato no le quita el distintivo", b.hired_application_id === a1.id);
const [c2] = await svc(`insert into public.candidates (full_name, phone_e164, hired_badge_at) values ('Beto', '+524493000002', now()) returning id`);
check("no se puede dar de alta con distintivo", (await badge(c2.id)).hired_badge_at === null);
await svc(`update public.candidates set hired_badge_at = now() where id = $1`, [c2.id]);
check("no se puede poner a mano", (await badge(c2.id)).hired_badge_at === null);

// dos contrataciones: al cancelar una, queda la otra
await stage(a2.id, "hired");
await stage(a1.id, "client_interview");
b = await badge(c.id);
check("al cancelar una contratación queda la otra", b.hired_badge_at !== null && b.hired_application_id === a2.id);

// sale de Contratado: se quita
await stage(a2.id, "client_interview");
check("al cancelar la última se quita el distintivo", (await badge(c.id)).hired_badge_at === null);

await stage(a2.id, "hired");
await stage(a2.id, "discarded");
check("descartar desde Contratado también lo quita", (await badge(c.id)).hired_badge_at === null);

// borrar la postulación contratada no truena y quita el distintivo
await stage(a1.id, "hired");
const delErr = await errorOf(() => svc(`delete from public.applications where id = $1`, [a1.id]));
check("borrar la postulación contratada no falla", !delErr, delErr ?? "");
check("y quita el distintivo", (await badge(c.id)).hired_badge_at === null);

// se ve en v_pipeline (el reclutador ve su vacante)
const [a3] = await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c2.id, PX]);
await stage(a3.id, "hired");
const rows = await as(db, A, () => q(`select application_id, hired_badge_at, hired_application_id from public.v_pipeline where candidate_id = $1`, [c2.id]));
check("v_pipeline trae el distintivo", rows.length === 1 && rows[0].hired_badge_at !== null && rows[0].hired_application_id === a3.id);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
