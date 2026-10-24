// Candidatos por reclutador (0015): round robin, aislamiento, reasignación, portal y notificaciones.
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
const name = (id) => ({ [A.id]: "A", [B.id]: "B", [C.id]: "C" })[id] ?? String(id);

let phoneSeq = 0;
const phone = () => `+52449100${String(++phoneSeq).padStart(4, "0")}`;
/** Alta como la hace el sistema (webhook / agente): service role, sin reclutador → round robin. */
async function inbound(profileId, fullName) {
  return as(db, "service", async () => {
    const [c] = await q(`insert into public.candidates (full_name, phone_e164) values ($1, $2) returning id`, [fullName, phone()]);
    const [a] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id, assigned_recruiter_id`, [c.id, profileId]);
    return { id: a.id, candidate_id: c.id, recruiter: a.assigned_recruiter_id };
  });
}

// --- sin reclutadores: queda sin asignar y solo lo ve el admin
const orphan = await inbound(PX, "Huérfano");
check("vacante sin reclutadores: postulación sin asignar", orphan.recruiter === null);

// --- A y B trabajan X: el huérfano se reparte al asignar; luego round robin alterna
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id, B.id]]));
const [o] = await q(`select assigned_recruiter_id from public.applications where id = $1`, [orphan.id]);
check("al asignar reclutadores se reparte lo pendiente", o.assigned_recruiter_id !== null, name(o.assigned_recruiter_id));

const apps = [];
for (const n of ["Uno", "Dos", "Tres", "Cuatro"]) apps.push(await inbound(PX, n));
const order = [o.assigned_recruiter_id, ...apps.map((x) => x.recruiter)].map(name).join("");
check("round robin alterna entre A y B", /^(AB)+A?$|^(BA)+B?$/.test(order), order);

// --- aislamiento: cada quien ve solo lo suyo, aun en la misma vacante
const mine = (user) => as(db, user, async () => ({
  apps: (await q(`select id from public.applications`)).length,
  pipe: (await q(`select application_id from public.v_pipeline`)).length,
  cands: (await q(`select id from public.candidates`)).length,
  events: (await q(`select id from public.application_stage_events`)).length,
}));
const ma = await mine(A);
const mb = await mine(B);
const mad = await mine(admin);
check("admin ve las 5 postulaciones", mad.apps === 5 && mad.pipe === 5 && mad.cands === 5, JSON.stringify(mad));
check("A y B se reparten 5 sin traslape", ma.apps + mb.apps === 5 && ma.apps >= 2 && mb.apps >= 2, `A=${ma.apps} B=${mb.apps}`);
check("v_pipeline, candidatos y eventos siguen a la postulación", ma.pipe === ma.apps && ma.cands === ma.apps && ma.events === ma.apps && mb.pipe === mb.apps, JSON.stringify({ ma, mb }));

const ofB = apps.find((x) => x.recruiter === B.id);
const ofA = apps.find((x) => x.recruiter === A.id);
await as(db, A, async () => {
  const direct = await q(`select id from public.applications where id = $1`, [ofB.id]);
  const cand = await q(`select id from public.candidates where id = $1`, [ofB.candidate_id]);
  check("A: consulta directa de un candidato de B no devuelve nada", direct.length === 0 && cand.length === 0);
  const e = await errorOf(() => q(`select public.set_application_stage($1, 'prefilter')`, [ofB.id]));
  check("A no mueve de etapa un candidato de B", !!e, e ?? "sin error");
  const ok = await q(`select (public.set_application_stage($1, 'prefilter', 'prueba')).stage as stage`, [ofA.id]);
  check("A mueve de etapa a su candidato", ok[0]?.stage === "prefilter");
  const e2 = await errorOf(() => q(`update public.applications set assigned_recruiter_id = $1 where id = $2`, [B.id, ofA.id]));
  check("A no reasigna a su candidato", !!e2, e2 ?? "sin error");
  const steal = await q(`update public.applications set assigned_recruiter_id = $1 where id = $2 returning id`, [A.id, ofB.id]);
  check("A no se roba un candidato de B", steal.length === 0);
  const found = await q(`select public.find_candidate_by_phone($1) as id`, ["+524491000003"]);
  check("find_candidate_by_phone resuelve el id para staff", !!found[0].id);
});

// --- alta manual por reclutador: el candidato es suyo; no puede dar de alta en vacante ajena
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

// --- hijos de la postulación
await as(db, "service", async () => {
  await q(`insert into public.interviews (application_id, type, status) values ($1, 'prime', 'scheduled')`, [ofB.id]);
  await q(`insert into public.psychometric_tests (application_id, status, verdict, fit_pct) values ($1, 'parsed', 'fit', 80)`, [ofB.id]);
  await q(`insert into public.candidate_documents (candidate_id, application_id, document_type_key, status) values ($1, $2, 'ine', 'received')`, [ofB.candidate_id, ofB.id]);
  const [w] = await q(`insert into public.wa_conversations (candidate_id, application_id, phone_e164) select $1, $2, phone_e164 from public.candidates where id = $1 returning id`, [ofB.candidate_id, ofB.id]);
  await q(`insert into public.wa_messages (conversation_id, direction, body) values ($1, 'inbound', 'hola')`, [w.id]);
  const [i] = await q(`select id from public.interviews where application_id = $1`, [ofB.id]);
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
check("B ve entrevista, transcripción, psicométrico, documentos y WhatsApp de su candidato", (await children(B)) === "1,1,1,1,1,1", await children(B));
check("A no ve nada de eso", (await children(A)) === "0,0,0,0,0,0", await children(A));
check("admin lo ve todo", (await children(admin)) === "1,1,1,1,1,1");
check("el cliente no lee transcripciones ni psicométricos", (await children(cliente)).split(",").slice(1, 3).join() === "0,0", await children(cliente));

// --- admin reasigna un candidato de B a A; a C (que no trabaja X) no se puede
await as(db, admin, async () => {
  const e = await errorOf(() => q(`update public.applications set assigned_recruiter_id = $1 where id = $2`, [C.id, ofB.id]));
  check("admin no asigna a alguien que no trabaja la vacante", !!e, e ?? "sin error");
  const r = await q(`update public.applications set assigned_recruiter_id = $1 where id = $2 returning assigned_at`, [A.id, ofB.id]);
  check("admin reasigna de B a A", r.length === 1 && r[0].assigned_at !== null);
});
check("tras reasignar, A lo ve y B ya no", (await children(A)) === "1,1,1,1,1,1" && (await children(B)) === "0,0,0,0,0,0");

// --- portal y Vo.Bo.: notifica a admins y al reclutador del candidato, no a todo el staff
await as(db, "service", async () => {
  for (const s of ["cv_review", "prime_interview", "psychometric", "documents", "client_interview"]) await q(`select public.set_application_stage($1, $2::public.application_stage, null, null, 'system')`, [ofA.id, s]);
});
await as(db, B, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("B ya no lee v_portal_applications de candidatos ajenos", portal.length === 0, `${portal.length}`);
});
await as(db, A, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("A lee en v_portal_applications solo lo suyo", portal.length === 1 && portal[0].application_id === ofA.id, `${portal.length}`);
  const e = await errorOf(() => q(`select public.notify_staff('other', 'spam')`));
  check("un usuario ya no puede llamar notify_staff", !!e, e ?? "sin error");
});
await as(db, cliente, async () => {
  const portal = await q(`select application_id from public.v_portal_applications`);
  check("cliente sigue viendo su portal", portal.length === 1);
  const r = await q(`select public.client_decide_application($1, 'approve', 'Nos gustó') as r`, [ofA.id]);
  check("cliente da Vo.Bo.", r[0].r.stage === "hired");
});
const notes = await q(`select u.email from public.notifications n join public.users u on u.id = n.user_id where n.entity_id = $1 and n.kind = 'client_decision' order by u.email`, [ofA.id]);
check("el Vo.Bo. avisa al admin y al reclutador asignado", notes.map((n) => n.email).join() === "a@t,admin@t", notes.map((n) => n.email).join());

// --- quitar a B de X: sus candidatos en proceso pasan a A; desactivar a A: quedan sin asignar
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));
const openOfB = await q(`select count(*)::int as n from public.applications where profile_id = $1 and assigned_recruiter_id = $2 and stage not in ('hired','discarded')`, [PX, B.id]);
check("al salir B de la vacante, no le queda nada en proceso", openOfB[0].n === 0);
check("B ya no ve nada de X", (await mine(B)).apps === 0);

// cambio atómico A→C: lo de A pasa a C (altas antes que bajas)
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [C.id]]));
const dist = await q(`select assigned_recruiter_id, count(*)::int as n from public.applications where profile_id = $1 and stage not in ('hired','discarded') group by 1`, [PX]);
check("relevo A→C: todo lo que está en proceso pasa a C", dist.length === 1 && dist[0].assigned_recruiter_id === C.id, JSON.stringify(dist.map((d) => [name(d.assigned_recruiter_id), d.n])));
const hiredStays = await q(`select assigned_recruiter_id from public.applications where id = $1`, [ofA.id]);
check("el contratado conserva a su reclutador histórico", hiredStays[0].assigned_recruiter_id === A.id);
check("pero A ya no lo ve (no trabaja la vacante)", (await mine(A)).apps === 0);

await as(db, admin, () => q(`update public.users set is_active = false where id = $1`, [C.id]));
const unassigned = await q(`select count(*)::int as n from public.applications where profile_id = $1 and assigned_recruiter_id is null and stage not in ('hired','discarded')`, [PX]);
check("desactivar al único reclutador deja lo pendiente sin asignar (lo ve el admin)", unassigned[0].n >= 4, `${unassigned[0].n}`);

// --- alta masiva en una sola sentencia rota el turno
await as(db, admin, async () => {
  await q(`update public.users set is_active = true where id = $1`, [C.id]);
  await q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id, B.id, C.id]]);
});
await as(db, "service", async () => {
  await q(`insert into public.candidates (id, full_name, phone_e164) select gen_random_uuid(), 'Lote ' || g, '+5244920000' || lpad(g::text, 2, '0') from generate_series(1, 6) g`);
  await q(`insert into public.applications (candidate_id, profile_id) select id, $1 from public.candidates where full_name like 'Lote %'`, [PY]);
});
const lot = await q(`select assigned_recruiter_id, count(*)::int as n from public.applications where profile_id = $1 group by 1`, [PY]);
check("lote de 6 en una sentencia: 2 para cada uno de 3", lot.length === 3 && lot.every((l) => l.n === 2), JSON.stringify(lot.map((l) => [name(l.assigned_recruiter_id), l.n])));

// --- BI hereda el alcance
const funnelA = await as(db, A, () => q(`select sum(applications)::int as n from public.v_bi_channel`));
const funnelAdmin = await as(db, admin, () => q(`select sum(applications)::int as n from public.v_bi_channel`));
check("v_bi_channel: A solo cuenta lo suyo; admin todo", funnelA[0].n === 2 && funnelAdmin[0].n === 12, `A=${funnelA[0].n} admin=${funnelAdmin[0].n}`);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
