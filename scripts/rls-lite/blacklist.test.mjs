// Lista negra (migración 0021): solo el admin la ve y la maneja; la base impide que una persona
// marcada vuelva a postularse, y al reclutador no le dice el motivo.
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const CX = "a0000000-0000-4000-8000-000000000001";
const PX = "b0000000-0000-4000-8000-000000000001";
const PY = "b0000000-0000-4000-8000-000000000002";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X');
  insert into public.job_profiles (id, client_id, title, status) values ('${PX}', '${CX}', 'Perfil X', 'active'), ('${PY}', '${CX}', 'Perfil Y', 'active');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Andrea" });
const A = await createUser(db, { email: "a@t", role: "recruiter", full_name: "Reclutador A" });
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX, full_name: "Contacto X" });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]).then(() => q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id]])));

const PHONE = "+524491112233";
const { person, appX, hiredApp, other } = await as(db, "service", async () => {
  const [c] = await q(`insert into public.candidates (full_name, phone_e164, email, curp) values ('Persona Vetada', $1, 'vetada@correo.mx', 'AAAA000000HDFRRR01') returning id`, [PHONE]);
  const [x] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PX]);
  const [h] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PY]);
  await q(`update public.applications set stage = 'hired', hired_at = now() where id = $1`, [h.id]);
  const [o] = await q(`insert into public.candidates (full_name, phone_e164) values ('Otra Persona', '+524491112299') returning id`);
  return { person: c.id, appX: x.id, hiredApp: h.id, other: o.id };
});

// --- solo el admin marca
const recruiterErr = await as(db, A, () => errorOf(() => q(`select public.blacklist_candidate($1, 'theft', 'x')`, [person])));
check("el reclutador no puede marcar a nadie", !!recruiterErr, recruiterErr ?? "sin error");
const clientErr = await as(db, cliente, () => errorOf(() => q(`select public.blacklist_candidate($1, 'theft', 'x')`, [person])));
check("el cliente no puede marcar a nadie", !!clientErr, clientErr ?? "sin error");
const directErr = await as(db, admin, () => errorOf(() => q(`insert into public.candidate_blacklist (full_name, reason_key) values ('X', 'other')`)));
check("ni el admin escribe directo en la tabla (solo por RPC)", !!directErr, directErr ?? "sin error");

const [entry] = await as(db, admin, () => q(`select * from public.blacklist_candidate($1, 'abandonment', '  Dejó el puesto sin avisar  ')`, [person]));
check("el admin la marca con motivo, nota y quién", entry?.reason_key === "abandonment" && entry?.reason_note === "Dejó el puesto sin avisar" && entry?.added_by === admin.id && entry?.phone_e164 === PHONE, JSON.stringify(entry));
const [again] = await as(db, admin, () => q(`select * from public.blacklist_candidate($1, 'theft')`, [person]));
check("marcarla otra vez no duplica", again?.id === entry.id);

const stages = await as(db, "service", () => q(`select id, stage, discard_reason_key, discard_reason from public.applications where candidate_id = $1`, [person]));
const x = stages.find((r) => r.id === appX);
check("su postulación abierta queda descartada con motivo neutro", x?.stage === "discarded" && x?.discard_reason_key === "other" && x?.discard_reason === "Descartado por administración", JSON.stringify(x));
check("la contratación no se toca", stages.find((r) => r.id === hiredApp)?.stage === "hired");

// --- quién la ve
check("el admin ve la lista", (await as(db, admin, () => q(`select id from public.candidate_blacklist`))).length === 1);
check("el reclutador no ve la lista", (await as(db, A, () => q(`select id from public.candidate_blacklist`))).length === 0);
check("el cliente no ve la lista", (await as(db, cliente, () => q(`select id from public.candidate_blacklist`))).length === 0);

// --- no puede volver a postularse
const PZ = await as(db, admin, async () => {
  const [p] = await q(`insert into public.job_profiles (client_id, title, status) values ($1, 'Perfil Z', 'active') returning id`, [CX]);
  await q(`select public.set_profile_recruiters($1, $2)`, [p.id, [A.id]]);
  return p.id;
});
const blocked = await as(db, A, () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [person, PZ])));
check("el reclutador no puede postularla a otra vacante", blocked === "candidate_blacklisted", blocked ?? "sin error");
const blockedAdmin = await as(db, admin, () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [person, PZ])));
check("el admin tampoco, mientras siga en la lista", blockedAdmin === "candidate_blacklisted", blockedAdmin ?? "sin error");
const blockedService = await as(db, "service", () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [person, PZ])));
check("tampoco por service role (WhatsApp, carga masiva)", blockedService === "candidate_blacklisted", blockedService ?? "sin error");

// Otra persona con el mismo correo (otro teléfono) también queda bloqueada
const sameEmail = await as(db, "service", async () => {
  const [c] = await q(`insert into public.candidates (full_name, phone_e164, email) values ('Mismo Correo', '+524491112244', 'VETADA@correo.mx') returning id`);
  return errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [c.id, PZ]));
});
check("el mismo correo con otro teléfono también se bloquea", sameEmail === "candidate_blacklisted", sameEmail ?? "sin error");
const fine = await as(db, A, () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [other, PZ])));
check("a otra persona se le postula normal", !fine, fine ?? "");

// --- is_blacklisted: sí o no, sin motivo
check("is_blacklisted por teléfono, para el reclutador", (await as(db, A, () => q(`select public.is_blacklisted($1) as b`, [PHONE])))[0].b === true);
check("is_blacklisted por correo", (await as(db, A, () => q(`select public.is_blacklisted('+520000000000', 'vetada@CORREO.mx') as b`)))[0].b === true);
check("is_blacklisted de alguien limpio da false", (await as(db, A, () => q(`select public.is_blacklisted('+520000000000') as b`)))[0].b === false);
check("al cliente is_blacklisted siempre le dice false", (await as(db, cliente, () => q(`select public.is_blacklisted($1) as b`, [PHONE])))[0].b === false);
const anonErr = await as(db, null, () => errorOf(() => q(`select public.is_blacklisted($1)`, [PHONE])));
check("anónimo no puede consultar", !!anonErr, anonErr ?? "sin error");

// --- quitar de la lista
const unErr = await as(db, A, () => errorOf(() => q(`select public.unblacklist_candidate($1)`, [entry.id])));
check("el reclutador no puede quitarla", !!unErr, unErr ?? "sin error");
const [removed] = await as(db, admin, () => q(`select * from public.unblacklist_candidate($1, 'Aclarado con el cliente')`, [entry.id]));
check("el admin la quita y queda el historial", !!removed?.removed_at && removed?.removed_by === admin.id && removed?.removed_note === "Aclarado con el cliente");
const twice = await as(db, admin, () => errorOf(() => q(`select public.unblacklist_candidate($1)`, [entry.id])));
check("quitarla dos veces avisa", !!twice, twice ?? "sin error");
const ok = await as(db, A, () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [person, PZ])));
check("ya fuera de la lista se puede postular", !ok, ok ?? "");
check("la postulación descartada no se reabrió", (await as(db, "service", () => q(`select stage from public.applications where id = $1`, [appX])))[0].stage === "discarded");
const [back] = await as(db, admin, () => q(`select * from public.blacklist_candidate($1, 'misconduct')`, [person]));
check("se puede volver a marcar (registro nuevo)", back?.id && back.id !== entry.id);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
