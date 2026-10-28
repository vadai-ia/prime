// Candidatos por vacante (0015 y 0029): el reclutador ve a todos los candidatos de las vacantes que
// trabaja; nada de las ajenas. Sin round robin. Portal, avisos y edición de datos.
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const CX = "a0000000-0000-4000-8000-000000000001";
const CY = "a0000000-0000-4000-8000-000000000002";
const PX = "b0000000-0000-4000-8000-000000000001";
const PY = "b0000000-0000-4000-8000-000000000002";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X'), ('${CY}', 'Cliente Y');
  insert into public.job_profiles (id, client_id, title, status) values ('${PX}', '${CX}', 'Perfil X', 'active'), ('${PY}', '${CY}', 'Perfil Y', 'active');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Andrea" });
const A = await createUser(db, { email: "a@t", role: "recruiter", full_name: "Reclutador A" });
const B = await createUser(db, { email: "b@t", role: "recruiter", full_name: "Reclutador B" });
const C = await createUser(db, { email: "c@t", role: "recruiter", full_name: "Reclutador C" });
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX, full_name: "Contacto X" });

let phoneSeq = 0;
const phone = () => `+52449100${String(++phoneSeq).padStart(4, "0")}`;
/** Alta como la hace el sistema (webhook / agente): service role, sin reclutador. */
async function inbound(profileId, fullName) {
  return as(db, "service", async () => {
    const [c] = await q(`insert into public.candidates (full_name, phone_e164) values ($1, $2) returning id`, [fullName, phone()]);
    const [a] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id, assigned_recruiter_id`, [c.id, profileId]);
    return { id: a.id, candidate_id: c.id, recruiter: a.assigned_recruiter_id };
  });
}

// --- A y B trabajan X; C trabaja Y
await as(db, admin, async () => {
  await q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id, B.id]]);
  await q(`select public.set_profile_recruiters($1, $2)`, [PY, [C.id]]);
});
const apps = [];
for (const n of ["Uno", "Dos", "Tres", "Cuatro"]) apps.push(await inbound(PX, n));
const onY = await inbound(PY, "De Y");
check("sin round robin: la postulación entra sin reclutador", apps.every((x) => x.recruiter === null) && onY.recruiter === null, apps.map((x) => x.recruiter).join());

const seen = (user) => as(db, user, async () => ({
  apps: (await q(`select id from public.applications`)).length,
  pipe: (await q(`select application_id from public.v_pipeline`)).length,
  cands: (await q(`select id from public.candidates`)).length,
  events: (await q(`select id from public.application_stage_events`)).length,
}));
const sa = await seen(A);
const sb = await seen(B);
const sc = await seen(C);
const sadm = await seen(admin);
check("admin ve las 5 postulaciones", sadm.apps === 5 && sadm.pipe === 5 && sadm.cands === 5, JSON.stringify(sadm));
check("A y B ven los 4 candidatos de X", sa.apps === 4 && sb.apps === 4, `A=${sa.apps} B=${sb.apps}`);
check("C ve solo el de Y", sc.apps === 1, `C=${sc.apps}`);
check("v_pipeline, candidatos y eventos siguen a la postulación", sa.pipe === 4 && sa.cands === 4 && sa.events === 4 && sc.pipe === 1 && sc.cands === 1, JSON.stringify({ sa, sc }));

const [x1, x2] = apps;
await as(db, A, async () => {
  const direct = await q(`select id from public.applications where id = $1`, [onY.id]);
  const cand = await q(`select id from public.candidates where id = $1`, [onY.candidate_id]);
  check("A: consulta directa de un candidato de Y no devuelve nada", direct.length === 0 && cand.length === 0);
  const e = await errorOf(() => q(`select public.set_application_stage($1, 'prefilter')`, [onY.id]));
  check("A no mueve de etapa un candidato de Y", !!e, e ?? "sin error");
  const ok = await q(`select (public.set_application_stage($1, 'prefilter', 'prueba')).stage as stage`, [x1.id]);
  check("A mueve de etapa a un candidato de X", ok[0]?.stage === "prefilter");
  const e2 = await errorOf(() => q(`update public.applications set assigned_recruiter_id = $1 where id = $2`, [B.id, x1.id]));
  check("A no asigna reclutador a un candidato", !!e2, e2 ?? "sin error");
  const found = await q(`select public.find_candidate_by_phone($1) as id`, ["+524491000003"]);
  check("find_candidate_by_phone resuelve el id para staff", !!found[0].id);
});
await as(db, B, async () => {
  const ok = await q(`select (public.set_application_stage($1, 'prefilter', 'prueba')).stage as stage`, [x2.id]);
  check("B también mueve candidatos de X", ok[0]?.stage === "prefilter");
});

// --- alta manual por reclutador: queda como quien lo capturó; no puede dar de alta en vacante ajena
await as(db, A, async () => {
  const id = (await q(`select gen_random_uuid() as id`))[0].id;
  const e1 = await errorOf(() => q(`insert into public.candidates (id, full_name, phone_e164) values ($1, 'Manual de A', $2)`, [id, phone()]));
  check("A crea candidato (sin returning)", !e1, e1 ?? "");
  const before = await q(`select id from public.candidates where id = $1`, [id]);
  check("antes de postularlo, A todavía no lo ve", before.length === 0);
  const app = await q(`insert into public.applications (candidate_id, profile_id, assigned_recruiter_id) values ($1, $2, $3) returning id, assigned_recruiter_id`, [id, PX, B.id]);
  check("alta manual queda con quien captura (aunque mande otro id)", app[0]?.assigned_recruiter_id === A.id);
  const after = await q(`update public.candidates set notes = 'ok' where id = $1 returning id`, [id]);
  check("ya postulado, A ve y edita a su candidato", after.length === 1);
  const e2 = await errorOf(() => q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [id, PY]));
  check("A no postula en una vacante que no trabaja", !!e2, e2 ?? "sin error");
  const del = await q(`delete from public.candidates where id = $1 returning id`, [id]);
  check("A no borra candidatos", del.length === 0);
});

// --- editar datos desde la ficha (0028): cualquiera de la vacante; C no; queda en el log
{
  const [own] = await q(`select a.id as app_id, a.candidate_id from public.applications a join public.candidates c on c.id = a.candidate_id where c.full_name = 'Manual de A'`);
  await as(db, C, async () => {
    const r = await q(`update public.candidates set phone_e164 = '+524490000000' where id = $1 returning id`, [own.candidate_id]);
    check("C (otra vacante) no edita al candidato de X", r.length === 0);
  });
  await as(db, B, async () => {
    const r = await q(`update public.candidates set notes = 'visto por B' where id = $1 returning id`, [own.candidate_id]);
    check("B edita al candidato que capturó A (misma vacante)", r.length === 1);
  });
  await as(db, A, async () => {
    const r = await q(`update public.candidates set curp = 'GOMA900101HAGRRN09' where id = $1 returning id`, [own.candidate_id]);
    check("A corrige la CURP de su candidato", r.length === 1);
    const e = await errorOf(() => q(`select public.log_audit('edit_candidate', 'application', $1, null, jsonb_build_object('candidate_id', $2::text, 'fields', jsonb_build_array('curp')))`, [own.app_id, own.candidate_id]));
    check("A registra la edición en el log", !e, e ?? "");
  });
  const [logged] = await q(`select count(*)::int as n from public.audit_log where action = 'edit_candidate' and user_id = $1`, [A.id]);
  check("el log de la edición queda con quien la hizo", logged.n === 1, String(logged.n));
}

// --- hijos de la postulación
await as(db, "service", async () => {
  await q(`insert into public.interviews (application_id, type, status) values ($1, 'prime', 'scheduled')`, [x1.id]);
  await q(`insert into public.psychometric_tests (application_id, status, verdict, fit_pct) values ($1, 'parsed', 'fit', 80)`, [x1.id]);
  await q(`insert into public.candidate_documents (candidate_id, application_id, document_type_key, status) values ($1, $2, 'ine', 'received')`, [x1.candidate_id, x1.id]);
  const [w] = await q(`insert into public.wa_conversations (candidate_id, application_id, phone_e164) select $1, $2, phone_e164 from public.candidates where id = $1 returning id`, [x1.candidate_id, x1.id]);
  await q(`insert into public.wa_messages (conversation_id, direction, body) values ($1, 'inbound', 'hola')`, [w.id]);
  const [i] = await q(`select id from public.interviews where application_id = $1`, [x1.id]);
  await q(`insert into public.interview_transcripts (interview_id, text) values ($1, 'transcripción')`, [i.id]);
});
const children = (user) => as(db, user, async () => [
  (await q(`select id from public.interviews`)).length,
  (await q(`select interview_id from public.interview_transcripts`)).length,
  (await q(`select id from public.psychometric_tests`)).length,
  (await q(`select id from public.candidate_documents`)).length,
  (await q(`select id from public.wa_conversations`)).length,
  (await q(`select id from public.wa_messages`)).length,
].join());
check("A y B ven entrevista, transcripción, psicométrico, documentos y WhatsApp", (await children(A)) === "1,1,1,1,1,1" && (await children(B)) === "1,1,1,1,1,1", `${await children(A)} / ${await children(B)}`);
check("C no ve nada de eso", (await children(C)) === "0,0,0,0,0,0", await children(C));
check("admin lo ve todo", (await children(admin)) === "1,1,1,1,1,1");
check("el cliente no lee transcripciones ni psicométricos", (await children(cliente)).split(",").slice(1, 3).join() === "0,0", await children(cliente));

// --- portal y Vo.Bo.: avisa a admins y a los reclutadores de la vacante, no a todo el staff
await as(db, "service", async () => {
  for (const s of ["cv_review", "prime_interview", "psychometric", "documents", "client_interview"]) await q(`select public.set_application_stage($1, $2::public.application_stage, null, null, 'system')`, [x1.id, s]);
});
await as(db, C, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("C no lee v_portal_applications de otra vacante", portal.length === 0, `${portal.length}`);
});
await as(db, A, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("A lee en v_portal_applications lo de su vacante", portal.length === 1 && portal[0].application_id === x1.id, `${portal.length}`);
  const e = await errorOf(() => q(`select public.notify_staff('other', 'spam')`));
  check("un usuario ya no puede llamar notify_staff", !!e, e ?? "sin error");
});
await as(db, cliente, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("cliente sigue viendo su portal", portal.length === 1);
  const r = await q(`select public.client_decide_application($1, 'approve', 'Nos gustó') as r`, [x1.id]);
  check("cliente da Vo.Bo.", r[0].r.stage === "hired");
});
const notes = await q(`select u.email from public.notifications n join public.users u on u.id = n.user_id where n.entity_id = $1 and n.kind = 'client_decision' order by u.email`, [x1.id]);
check("el Vo.Bo. avisa al admin y a los reclutadores de la vacante", notes.map((n) => n.email).join() === "a@t,admin@t,b@t", notes.map((n) => n.email).join());

// --- quitar a B de X: B deja de ver X; A sigue viendo todo; nada se reasigna
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));
check("B ya no ve nada de X", (await seen(B)).apps === 0);
check("A sigue viendo los 5 de X", (await seen(A)).apps === 5);
const touched = await q(`select count(*)::int as n from public.applications where profile_id = $1 and assigned_recruiter_id is not null`, [PX]);
check("quitar a alguien no reparte ni asigna a nadie", touched[0].n === 1, String(touched[0].n)); // solo la que capturó A

// --- relevo A→C en X: C ve todo, A nada
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [C.id]]));
check("relevo A→C: C ve X y Y", (await seen(C)).apps === 6, String((await seen(C)).apps));
check("A ya no ve nada", (await seen(A)).apps === 0);

// --- avisos de candidato nuevo: a todos los reclutadores de la vacante, menos a quien lo capturó
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id, B.id, C.id]]));
await q(`delete from public.notifications`);
await inbound(PY, "Nuevo de Y");
const fresh = await q(`select u.email from public.notifications n join public.users u on u.id = n.user_id where n.kind = 'candidate_assigned' order by u.email`);
check("candidato nuevo avisa a los 3 reclutadores de la vacante", fresh.map((n) => n.email).join() === "a@t,b@t,c@t", fresh.map((n) => n.email).join());

// --- BI hereda el alcance
const funnelA = await as(db, A, () => q(`select sum(applications)::int as n from public.v_bi_channel`));
const funnelAdmin = await as(db, admin, () => q(`select sum(applications)::int as n from public.v_bi_channel`));
check("v_bi_channel: A cuenta solo su vacante Y; admin todo", funnelA[0].n === 2 && funnelAdmin[0].n === 7, `A=${funnelA[0].n} admin=${funnelAdmin[0].n}`);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
