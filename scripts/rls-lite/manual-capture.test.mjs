// Captura manual (migración 0016): historial de la persona y escritura de entrevistas,
// documentos y psicométrico por el reclutador dueño del candidato.
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
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX, full_name: "Contacto X" });
await as(db, admin, async () => {
  await q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]);
  await q(`select public.set_profile_recruiters($1, $2)`, [PY, [B.id]]);
});

// La misma persona postulada a X (vacante de A) y a Y (vacante de B)
const PHONE = "+524491234567";
const { person, appX, appY } = await as(db, "service", async () => {
  const [c] = await q(`insert into public.candidates (full_name, phone_e164) values ('Persona Repetida', $1) returning id`, [PHONE]);
  const [x] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PX]);
  const [y] = await q(`insert into public.applications (candidate_id, profile_id, applied_at) values ($1, $2, now() - interval '60 days') returning id`, [c.id, PY]);
  await q(`select public.set_application_stage($1, 'discarded', 'No le interesó', 'withdrew', 'system')`, [y.id]);
  return { person: c.id, appX: x.id, appY: y.id };
});

// --- historial
await as(db, A, async () => {
  const h = await q(`select * from public.candidate_history_by_phone($1)`, [PHONE]);
  check("A ve las 2 postulaciones de la persona, la más reciente primero", h.length === 2 && h[0].application_id === appX, `${h.length}`);
  const other = h.find((r) => r.application_id === appY);
  check("de la ajena ve vacante, cliente, etapa y motivo", other?.profile_title === "Perfil Y" && other?.client_name === "Cliente Y" && other?.stage === "discarded" && other?.discard_reason_key === "withdrew", JSON.stringify(other));
  check("is_mine marca solo la suya", h.find((r) => r.application_id === appX)?.is_mine === true && other?.is_mine === false);
  const direct = await q(`select id from public.applications where id = $1`, [appY]);
  check("el historial no le abre la postulación ajena", direct.length === 0);
  const none = await q(`select * from public.candidate_history_by_phone('+520000000000')`);
  check("teléfono desconocido: historial vacío", none.length === 0);
});
await as(db, cliente, async () => {
  const h = await q(`select * from public.candidate_history_by_phone($1)`, [PHONE]);
  check("el cliente no obtiene historial", h.length === 0, `${h.length}`);
});
const anonErr = await as(db, null, () => errorOf(() => q(`select * from public.candidate_history_by_phone($1)`, [PHONE])));
check("anónimo no puede llamar el historial", !!anonErr, anonErr ?? "sin error");

// --- entrevistas a mano
await as(db, A, async () => {
  const [iv] = await q(
    `insert into public.interviews (application_id, type, status, scheduled_at, platform, meeting_url, interviewer_user_id, calendar_owner_id)
     values ($1, 'prime', 'scheduled', now() + interval '2 days', 'meet', 'https://meet.google.com/abc', $2, $2) returning id`,
    [appX, A.id],
  );
  check("A agenda una entrevista de su candidato", !!iv?.id);
  const re = await q(`update public.interviews set scheduled_at = now() + interval '3 days', status = 'scheduled' where id = $1 returning id`, [iv.id]);
  check("A la reagenda", re.length === 1);
  const done = await q(`update public.interviews set status = 'completed', summary = 'Buena actitud', score = 80 where id = $1 returning status`, [iv.id]);
  check("A la marca realizada con notas (estado completed)", done[0]?.status === "completed");
  const e = await errorOf(() => q(`insert into public.interviews (application_id, type) values ($1, 'prime')`, [appY]));
  check("A no agenda sobre un candidato ajeno", !!e, e ?? "sin error");
});
await as(db, B, async () => {
  const seen = await q(`select id from public.interviews where application_id = $1`, [appX]);
  check("B no ve la entrevista del candidato de A", seen.length === 0);
});

// --- regresar de etapa (botón de la ficha y arrastre en el tablero usan la misma RPC)
await as(db, A, async () => {
  await q(`select public.set_application_stage($1, 'prefilter', 'Movido en el tablero')`, [appX]);
  await q(`select public.set_application_stage($1, 'cv_review', 'Movido en el tablero')`, [appX]);
  const back = await q(`select (public.set_application_stage($1, 'prefilter', 'Regresó de CV evaluado (tablero)')).stage as stage`, [appX]);
  check("A regresa a su candidato una etapa", back[0]?.stage === "prefilter");
  const ev = await q(`select from_stage, to_stage, reason, actor_type from public.application_stage_events where application_id = $1 order by created_at desc, id desc limit 1`, [appX]);
  check("el regreso queda en la línea de tiempo con origen, destino y motivo", ev[0]?.from_stage === "cv_review" && ev[0]?.to_stage === "prefilter" && /Regresó/.test(ev[0]?.reason ?? "") && ev[0]?.actor_type === "recruiter", JSON.stringify(ev[0]));
  const e = await errorOf(() => q(`select public.set_application_stage($1, 'new')`, [appY]));
  check("A no mueve en el tablero un candidato ajeno", !!e, e ?? "sin error");
});

// --- documentos y psicométrico a mano
await as(db, A, async () => {
  const [d] = await q(
    `insert into public.candidate_documents (candidate_id, application_id, document_type_key, file_path, mime, size_bytes, status, received_via)
     values ($1, $2, 'ine', 'x/ine/a.jpg', 'image/jpeg', 1000, 'received', 'upload') returning id`,
    [person, appX],
  );
  check("A registra un documento subido a mano", !!d?.id);
  const dup = await errorOf(() => q(`insert into public.candidate_documents (candidate_id, application_id, document_type_key, status, received_via) values ($1, $2, 'ine', 'received', 'upload')`, [person, appX]));
  check("no caben dos documentos vigentes del mismo tipo", /duplicate|unique/i.test(dup ?? ""), dup ?? "sin error");
  const rej = await q(`update public.candidate_documents set status = 'rejected', rejected_reason = 'Ilegible' where id = $1 returning id`, [d.id]);
  check("A lo rechaza con motivo", rej.length === 1);
  const again = await errorOf(() => q(`insert into public.candidate_documents (candidate_id, application_id, document_type_key, status, received_via) values ($1, $2, 'ine', 'received', 'upload')`, [person, appX]));
  check("tras rechazarlo se puede subir otro", !again, again ?? "");
  const val = await q(`update public.candidate_documents set status = 'validated', validated_by = $2, validated_at = now() where candidate_id = $1 and status = 'received' returning id`, [person, A.id]);
  check("A valida el documento nuevo", val.length === 1);

  const [t] = await q(`insert into public.psychometric_tests (application_id, test_link, sent_at, status) values ($1, 'https://psicotest.mx/e/1', now(), 'sent') returning id`, [appX]);
  const up = await q(`update public.psychometric_tests set report_file_path = 'x/r.pdf', completed_at = now(), status = 'parsed', verdict = 'fit', fit_pct = 85, parsed_at = now() where id = $1 returning id`, [t.id]);
  check("A registra envío, reporte y veredicto del psicométrico", up.length === 1);
  const e = await errorOf(() => q(`insert into public.psychometric_tests (application_id, status) values ($1, 'sent')`, [appY]));
  check("A no registra psicométrico de un candidato ajeno", !!e, e ?? "sin error");
});
// B comparte a la persona (postulación en Y), así que sí ve sus documentos; el psicométrico es por postulación
await as(db, B, async () => {
  const docs = await q(`select id from public.candidate_documents where candidate_id = $1`, [person]);
  const psych = await q(`select id from public.psychometric_tests`);
  check("B comparte a la persona: ve sus documentos, no el psicométrico de la otra vacante", docs.length === 2 && psych.length === 0, `docs=${docs.length} psych=${psych.length}`);
});

// --- cancelar contratación (0018): limpia lo que Contratado fijó, conserva la línea de tiempo
await as(db, "service", async () => {
  await q(`select public.set_application_stage($1, 'hired', 'Vo.Bo. del cliente', null, 'client')`, [appX]);
  await q(`update public.applications set client_decision = 'approve', client_decision_at = now(), start_date = current_date + 7 where id = $1`, [appX]);
});
const hired = await q(`select hired_at, start_date, client_decision, (select count(*)::int from public.placement_followups where application_id = $1 and outcome = 'pending') as pending from public.applications where id = $1`, [appX]);
check("contratado: fecha, decisión del cliente y 3 seguimientos pendientes", hired[0].hired_at !== null && hired[0].client_decision === "approve" && hired[0].pending === 3, JSON.stringify(hired[0]));
await as(db, A, async () => {
  const back = await q(`select (public.set_application_stage($1, 'client_interview', 'Declinó la oferta')).stage as stage`, [appX]);
  check("A cancela la contratación de su candidato", back[0]?.stage === "client_interview");
});
const after = await q(`select hired_at, start_date, client_decision, client_decision_at, (select count(*)::int from public.placement_followups where application_id = $1) as followups from public.applications where id = $1`, [appX]);
check("se limpian fecha de contratación, ingreso, decisión del cliente y seguimientos", after[0].hired_at === null && after[0].start_date === null && after[0].client_decision === null && after[0].client_decision_at === null && after[0].followups === 0, JSON.stringify(after[0]));
const trail = await q(`select from_stage, to_stage, reason from public.application_stage_events where application_id = $1 order by created_at desc, id desc limit 2`, [appX]);
check("la línea de tiempo conserva el Vo.Bo. y el regreso con motivo", trail[0]?.from_stage === "hired" && trail[0]?.reason === "Declinó la oferta" && trail[1]?.to_stage === "hired", JSON.stringify(trail));
await as(db, "service", async () => {
  await q(`select public.set_application_stage($1, 'hired', null, null, 'system')`, [appX]);
  await q(`select public.set_application_stage($1, 'discarded', 'Se fue al mes', 'withdrew', 'system')`, [appX]);
});
const left = await q(`select hired_at from public.applications where id = $1`, [appX]);
check("contratado → descartado (se fue) conserva la fecha de contratación para BI", left[0].hired_at !== null);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
