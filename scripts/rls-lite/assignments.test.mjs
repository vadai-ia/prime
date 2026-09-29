// Asignación de reclutadores por vacante y visibilidad de perfiles y clientes (migración 0014, plan §2.3).
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Andrea" });
const A = await createUser(db, { email: "a@t", role: "recruiter", full_name: "Reclutador A" });
const B = await createUser(db, { email: "b@t", role: "recruiter", full_name: "Reclutador B" });

const CX = "a0000000-0000-4000-8000-000000000001";
const CY = "a0000000-0000-4000-8000-000000000002";
const PX = "b0000000-0000-4000-8000-000000000001";
const PY = "b0000000-0000-4000-8000-000000000002";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X'), ('${CY}', 'Cliente Y');
  insert into public.job_profiles (id, client_id, title, status) values ('${PX}', '${CX}', 'Perfil X', 'active'), ('${PY}', '${CY}', 'Perfil Y', 'active');
`);
const cliente = await createUser(db, { email: "c@t", role: "client", client_id: CX, full_name: "Contacto X" });
await createUser(db, { email: "cy@t", role: "client", client_id: CY, full_name: "Contacto Y" }); // existe para probar que A no lo ve

// --- admin asigna A→X, B→Y
await as(db, admin, async () => {
  const [r1] = await q(`select public.set_profile_recruiters($1, $2) as n`, [PX, [A.id]]);
  const [r2] = await q(`select public.set_profile_recruiters($1, $2) as n`, [PY, [B.id]]);
  check("admin asigna A→X y B→Y", r1.n === 1 && r2.n === 1);
});

const seen = async (user) => as(db, user, async () => ({
  profiles: (await q(`select title from public.job_profiles order by title`)).map((r) => r.title),
  clients: (await q(`select name from public.clients order by name`)).map((r) => r.name),
}));

let a = await seen(A);
let b = await seen(B);
check("A ve solo X y su cliente", a.profiles.join() === "Perfil X" && a.clients.join() === "Cliente X", JSON.stringify(a));
check("B ve solo Y y su cliente", b.profiles.join() === "Perfil Y" && b.clients.join() === "Cliente Y", JSON.stringify(b));

// --- consulta directa de Y bajo la sesión de A
await as(db, A, async () => {
  const p = await q(`select id from public.job_profiles where id = $1`, [PY]);
  const c = await q(`select id from public.clients where id = $1`, [CY]);
  const cfg = await q(`select profile_id from public.job_profile_ai_configs where profile_id = $1`, [PY]);
  check("A: consulta directa del perfil Y y su cliente no devuelve nada", p.length === 0 && c.length === 0 && cfg.length === 0);
  const upd = await q(`update public.job_profiles set title = 'hack' where id = $1 returning id`, [PY]);
  check("A no actualiza el perfil Y", upd.length === 0);
  const own = await q(`update public.job_profiles set work_zone = 'Centro' where id = $1 returning id`, [PX]);
  check("A sí actualiza su perfil X", own.length === 1);
  const users = (await q(`select email from public.users order by email`)).map((r) => r.email);
  check("A ve staff y el contacto de su cliente, no el de Y", users.join() === "a@t,admin@t,b@t,c@t", users.join());
});

// --- admin mueve A de X a Y: aplica en la siguiente consulta, mismo "JWT"
await as(db, admin, async () => {
  await q(`select public.set_profile_recruiters($1, $2)`, [PX, []]);
  await q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id, B.id]]);
});
a = await seen(A);
check("A movido de X a Y sin re-login", a.profiles.join() === "Perfil Y" && a.clients.join() === "Cliente Y", JSON.stringify(a));

// --- el reclutador no puede cambiar asignaciones
await as(db, A, async () => {
  const e1 = await errorOf(() => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));
  check("A no usa set_profile_recruiters", !!e1, e1 ?? "sin error");
  const e2 = await errorOf(() => q(`insert into public.job_profile_assignments (profile_id, recruiter_id) values ($1, $2)`, [PX, A.id]));
  check("A no inserta asignaciones directo", !!e2, e2 ?? "sin error");
  const del = await q(`delete from public.job_profile_assignments where recruiter_id = $1 returning profile_id`, [B.id]);
  check("A no borra asignaciones de B", del.length === 0);
  const delOwn = await q(`delete from public.job_profile_assignments where recruiter_id = $1 returning profile_id`, [A.id]);
  check("A no se quita a sí mismo", delOwn.length === 0);
  const mine = await q(`select profile_id from public.job_profile_assignments`);
  check("A lee solo sus propias asignaciones", mine.length === 1 && mine[0].profile_id === PY, JSON.stringify(mine));
  const hist = await q(`select id from public.job_profile_assignment_events`);
  check("A no lee el historial", hist.length === 0);
  const e3 = await errorOf(() => q(`insert into public.job_profiles (client_id, title) values ($1, 'Nueva')`, [CY]));
  check("A no crea vacantes", !!e3, e3 ?? "sin error");
  const e4 = await errorOf(() => q(`select public.log_audit('export', 'pipeline', null)`));
  check("A no puede exportar (log_audit export)", !!e4, e4 ?? "sin error");
  const e5 = await errorOf(() => q(`select public.log_audit('view_cv', 'candidate', gen_random_uuid())`));
  check("A sí registra otras acciones de auditoría", !e5, e5 ?? "");
  const perms = await q(`select app.has_permission('export') as ex, app.has_permission('view_blacklist') as bl, app.has_permission('view_inactive_candidates') as ina`);
  check("A sin permisos admin-only", !perms[0].ex && !perms[0].bl && !perms[0].ina);
});

// --- solo reclutadores activos se pueden asignar
await as(db, admin, async () => {
  const e = await errorOf(() => q(`select public.set_profile_recruiters($1, $2)`, [PX, [admin.id]]));
  check("no se asigna a un admin", !!e, e ?? "sin error");
  const e2 = await errorOf(() => q(`select public.set_profile_recruiters($1, $2)`, [PX, [cliente.id]]));
  check("no se asigna a un usuario cliente", !!e2, e2 ?? "sin error");
  const perms = await q(`select app.has_permission('export') as ex, app.has_permission('nope') as nope`);
  check("admin tiene export; permiso desconocido = false", perms[0].ex && !perms[0].nope);
  const e3 = await errorOf(() => q(`select public.log_audit('export', 'pipeline', null)`));
  check("admin sí exporta", !e3, e3 ?? "");
});

// --- desactivar a B lo saca de todo (con sesión de admin, como hace setUserActive)
await as(db, admin, () => q(`update public.users set is_active = false where id = $1`, [B.id]));
const left = await q(`select * from public.job_profile_assignments where recruiter_id = $1`, [B.id]);
check("desactivar a B borra sus asignaciones", left.length === 0);
b = await seen(B);
check("B desactivado ya no ve perfiles ni clientes", b.profiles.length === 0 && b.clients.length === 0, JSON.stringify(b));
await as(db, admin, async () => {
  const e = await errorOf(() => q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id, B.id]]));
  check("no se asigna a un reclutador inactivo", !!e, e ?? "sin error");
});

// --- historial
const hist = await as(db, admin, () => q(`
  select p.title, u.full_name as recruiter, e.action, e.source, act.full_name as actor
  from public.job_profile_assignment_events e
  join public.job_profiles p on p.id = e.profile_id
  join public.users u on u.id = e.recruiter_id
  left join public.users act on act.id = e.actor_user_id
  order by e.created_at, e.id`));
console.table(hist);
check("historial: 5 eventos con actor", hist.length === 5 && hist.every((h) => h.actor === "Andrea"), `${hist.length}`);
check("historial: la baja de B quedó como user_deactivated", hist.some((h) => h.recruiter === "Reclutador B" && h.action === "unassigned" && h.source === "user_deactivated"));

// --- admin y cliente
const ad = await seen(admin);
check("admin lee todos los perfiles y clientes", ad.profiles.length === 2 && ad.clients.length === 2);
const cl = await seen(cliente);
check("cliente sin cambios: su empresa y sus vacantes", cl.clients.join() === "Cliente X" && cl.profiles.join() === "Perfil X", JSON.stringify(cl));
await as(db, cliente, async () => {
  const asg = await q(`select * from public.job_profile_assignments`);
  check("cliente no lee asignaciones", asg.length === 0);
});
const anon = await seen(null);
check("anónimo no ve nada", anon.profiles.length === 0 && anon.clients.length === 0);

// --- cambio de rol recruiter → admin libera asignaciones
await db.query(`update auth.users set raw_app_meta_data = '{"role":"admin","client_id":null}' where id = $1`, [A.id]);
const afterRole = await q(`select * from public.job_profile_assignments where recruiter_id = $1`, [A.id]);
check("cambio de rol libera asignaciones", afterRole.length === 0);

// --- borrar un perfil o un usuario con asignaciones no truena por el historial
const C = await createUser(db, { email: "c2@t", role: "recruiter", full_name: "Reclutador C" });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [C.id]]));
const eDel = await errorOf(() => db.query(`delete from public.job_profiles where id = $1`, [PX]));
check("borrar un perfil con asignaciones funciona", !eDel, eDel ?? "");
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PY, [C.id]]));
const eDelU = await errorOf(() => db.query(`delete from auth.users where id = $1`, [C.id]));
check("borrar un usuario con asignaciones funciona", !eDelU, eDelU ?? "");

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
