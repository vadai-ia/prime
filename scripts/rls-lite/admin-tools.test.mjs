// Migraciones 0023 y 0024: avisos automáticos (asignado, entrevista, documento, intento de lista
// negra), captura de permanencia, base de inactivos (solo admin) y quién conectó su Outlook.
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
const svc = (sql, params) => as(db, "service", () => q(sql, params));

const CX = "a0000000-0000-4000-8000-000000000001";
const PX = "b0000000-0000-4000-8000-000000000001";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Telasist');
  insert into public.job_profiles (id, client_id, title, status) values ('${PX}', '${CX}', 'Cobranza', 'active');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Andrea" });
const A = await createUser(db, { email: "a@t", role: "recruiter", full_name: "Reclutador A" });
const B = await createUser(db, { email: "b@t", role: "recruiter", full_name: "Reclutador B" });
const C = await createUser(db, { email: "c@t", role: "recruiter", full_name: "Reclutador C" }); // no trabaja la vacante
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX, full_name: "Contacto X" });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));

const notes = (kind) => svc(`select user_id, title, body, href, entity_id from public.notifications where kind = $1 order by created_at`, [kind]);
const person = (name, phone) => svc(`insert into public.candidates (full_name, phone_e164) values ($1, $2) returning id`, [name, phone]).then((r) => r[0].id);

// --- candidato nuevo (0029: sin round robin, avisa a los reclutadores de la vacante)
const c1 = await person("Ana Nueva", "+524491000001");
const [app1] = await as(db, admin, () => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id, assigned_recruiter_id`, [c1, PX]));
let assigned = await notes("candidate_assigned");
check("el admin captura: nadie queda asignado y A recibe el aviso", app1.assigned_recruiter_id === null && assigned.length === 1 && assigned[0].user_id === A.id && assigned[0].title === "Nuevo candidato: Ana Nueva" && assigned[0].body === "Cobranza · Telasist", JSON.stringify(assigned));

const c2 = await person("Beto Manual", "+524491000002");
const [app2] = await as(db, A, () => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id, assigned_recruiter_id`, [c2, PX]));
assigned = await notes("candidate_assigned");
check("si lo captura el reclutador, queda como quien lo capturó y no se avisa a sí mismo", app2.assigned_recruiter_id === A.id && assigned.length === 1, JSON.stringify(assigned));

await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id, B.id]]));
assigned = await notes("candidate_assigned");
check("sumar a B a la vacante no manda avisos de candidatos", assigned.length === 1, JSON.stringify(assigned));

// --- entrevista agendada: admins y los reclutadores de la vacante, menos quien la agenda
await as(db, A, () => q(`insert into public.interviews (application_id, type, scheduled_at) values ($1, 'prime', '2026-10-22 17:00:00+00')`, [app2.id]));
const iv = await notes("interview_scheduled");
const ivTo = iv.map((n) => n.user_id).sort().join();
check("entrevista agendada: avisa al admin y a B, no a quien la agendó", iv.length === 2 && ivTo === [admin.id, B.id].sort().join() && iv[0].title === "Entrevista Prime agendada: Beto Manual", JSON.stringify(iv));
check("con la hora de México", iv[0]?.body === "22/10/2026 11:00 · Cobranza · Telasist", iv[0]?.body);

// --- documento recibido
await as(db, A, () => q(`insert into public.candidate_documents (candidate_id, application_id, document_type_key, status, received_via) values ($1, $2, 'ine', 'received', 'upload')`, [c2, app2.id]));
const docs = await notes("document_received");
check("documento recibido: avisa al admin y a B con el tipo", docs.length === 2 && docs.some((n) => n.user_id === admin.id) && docs.some((n) => n.user_id === B.id) && docs[0].body === "INE (frente y reverso) · Cobranza · Telasist", JSON.stringify(docs));

// --- intento de registrar a alguien de la lista negra
const vetada = await person("Persona Vetada", "+524491000009");
await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [vetada, PX]);
await as(db, admin, () => q(`select public.blacklist_candidate($1, 'theft')`, [vetada]));
const [tryA] = await as(db, A, () => q(`select public.report_blacklist_attempt('+524491000009', null, $1) as n`, [PX]));
const bl = await notes("blacklist_attempt");
check("intento de lista negra: avisa a los admins con quién y dónde", tryA.n === 1 && bl.length === 1 && bl[0].user_id === admin.id && bl[0].body === "Reclutador A · Cobranza · Telasist" && bl[0].href === "/candidatos/lista-negra", JSON.stringify(bl));
const [tryAgain] = await as(db, A, () => q(`select public.report_blacklist_attempt('+524491000009') as n`));
check("reintentar en la misma hora no repite el aviso", tryAgain.n === 0);
const [clean] = await as(db, A, () => q(`select public.report_blacklist_attempt('+524491000077') as n`));
check("un teléfono que no está en la lista no avisa nada", clean.n === 0);
const [fromClient] = await as(db, cliente, () => q(`select public.report_blacklist_attempt('+524491000009') as n`));
check("el cliente no puede disparar el aviso", fromClient.n === 0);

// --- permanencia
await svc(`update public.applications set stage = 'hired', hired_at = now() - interval '100 days', start_date = current_date - 100 where id = $1`, [app2.id]);
const fus = await svc(`select id, checkpoint_days from public.placement_followups where application_id = $1 order by checkpoint_days`, [app2.id]);
const [f30, f90, f180] = fus.map((f) => f.id);
const [r30] = await as(db, A, () => q(`select outcome, recorded_by, notes from public.record_placement_followup($1, 'active', null, null, '  Todo bien  ')`, [f30]));
check("el reclutador captura Sigue a 30 días", r30.outcome === "active" && r30.recorded_by === A.id && r30.notes === "Todo bien", JSON.stringify(r30));
const otherRec = await as(db, C, () => errorOf(() => q(`select public.record_placement_followup($1, 'active')`, [f90])));
check("un reclutador de otra vacante no la captura", !!otherRec, otherRec ?? "sin error");
const fromClientF = await as(db, cliente, () => errorOf(() => q(`select public.record_placement_followup($1, 'active')`, [f90])));
check("el cliente no la captura", !!fromClientF, fromClientF ?? "sin error");
const noDate = await as(db, A, () => errorOf(() => q(`select public.record_placement_followup($1, 'left')`, [f90])));
check("Se fue sin fecha no se guarda", !!noDate, noDate ?? "sin error");
const pendingErr = await as(db, A, () => errorOf(() => q(`select public.record_placement_followup($1, 'pending')`, [f90])));
check("no se puede regresar a pendiente", !!pendingErr, pendingErr ?? "sin error");
await as(db, A, () => q(`select public.record_placement_followup($1, 'left', current_date - 10, 'Mejor oferta')`, [f90]));
const after = await svc(`select checkpoint_days, outcome, left_reason from public.placement_followups where application_id = $1 order by checkpoint_days`, [app2.id]);
check("Se fue a 90 días cierra también el de 180", after[0].outcome === "active" && after[1].outcome === "left" && after[2].outcome === "left" && after[2].left_reason === "Mejor oferta", JSON.stringify(after));
check("el corte de 180 sigue siendo el mismo registro", fus.length === 3 && !!f180);

// --- base de inactivos
const c3 = await person("Carla Descartada", "+524491000003");
const [app3] = await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c3, PX]);
await svc(`update public.applications set stage = 'discarded', discard_reason_key = 'salary' where id = $1`, [app3.id]);
const c4 = await person("Diego Contratado", "+524491000004");
const [app4] = await svc(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c4, PX]);
await svc(`update public.applications set stage = 'hired', hired_at = now() where id = $1`, [app4.id]);

const inactive = await as(db, admin, () => q(`select candidate_id, full_name, last_stage, last_discard_reason_key, was_hired, applications_count from public.v_inactive_candidates order by full_name`));
const names = inactive.map((r) => r.full_name);
check("el admin ve a la descartada", names.includes("Carla Descartada"), names.join(", "));
check("y a quien se contrató y se fue", names.includes("Beto Manual") && inactive.find((r) => r.full_name === "Beto Manual")?.was_hired === true, names.join(", "));
check("no a quien sigue en proceso ni a quien sigue trabajando", !names.includes("Ana Round Robin") && !names.includes("Diego Contratado"), names.join(", "));
check("no a quien está en la lista negra (aunque su postulación quedó descartada)", !names.includes("Persona Vetada"), names.join(", "));
check("trae la última vacante y el motivo", inactive.find((r) => r.full_name === "Carla Descartada")?.last_discard_reason_key === "salary");
check("el reclutador no ve la base de inactivos", (await as(db, A, () => q(`select candidate_id from public.v_inactive_candidates`))).length === 0);
check("el cliente tampoco", (await as(db, cliente, () => q(`select candidate_id from public.v_inactive_candidates`))).length === 0);

// --- quién conectó su Outlook
await svc(`insert into public.user_integrations (user_id, provider, access_token_enc, account_email) values ($1, 'microsoft', 'secreto', 'a@prime.mx')`, [A.id]);
const ints = await as(db, admin, () => q(`select * from public.list_user_integrations()`));
check("el admin ve quién conectó, con el correo", ints.length === 1 && ints[0].user_id === A.id && ints[0].account_email === "a@prime.mx", JSON.stringify(ints));
check("sin tokens", ints.length === 1 && !("access_token_enc" in ints[0]));
const recInts = await as(db, A, () => errorOf(() => q(`select * from public.list_user_integrations()`)));
check("el reclutador no puede listar", !!recInts, recInts ?? "sin error");

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
