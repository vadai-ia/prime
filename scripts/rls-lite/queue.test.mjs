// Cola de tareas (migraciones 0010 y 0022): tomar, reintentar con backoff, recuperar colgadas,
// fallar sin reintentar con aviso al admin, reintentar/cancelar solo admin, avisos de permanencia.
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
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));

// --- tomar: solo las que ya tocan, y nadie más que el service role
const [due] = await svc(`select public.enqueue_task('cv_score', '{"application_id":"x"}') as id`);
const [later] = await svc(`select public.enqueue_task('cv_score', '{}', now() + interval '1 hour') as id`);
const recruiterClaim = await as(db, A, () => errorOf(() => q(`select * from public.claim_scheduled_tasks(10, 'w')`)));
check("un reclutador no puede tomar tareas", !!recruiterClaim, recruiterClaim ?? "sin error");
const claimed = await svc(`select id, status, attempts, locked_by from public.claim_scheduled_tasks(10, 'w1')`);
check("toma solo la que ya toca", claimed.length === 1 && claimed[0].id === due.id && claimed[0].status === "running" && claimed[0].attempts === 1 && claimed[0].locked_by === "w1", JSON.stringify(claimed));
check("no la vuelve a tomar mientras corre", (await svc(`select id from public.claim_scheduled_tasks(10, 'w2')`)).length === 0);

// --- falla con reintento: backoff de 2^intentos minutos
const [retried] = await svc(`select status, last_error, run_at > now() + interval '90 seconds' as later from public.finish_scheduled_task($1, false, 'timeout')`, [due.id]);
check("falla y vuelve a pendiente con espera", retried.status === "pending" && retried.last_error === "timeout" && retried.later, JSON.stringify(retried));

// --- colgada: running con lock viejo se recupera
await svc(`update public.scheduled_tasks set status = 'running', locked_at = now() - interval '11 minutes', run_at = now() where id = $1`, [due.id]);
const stale = await svc(`select id, attempts from public.claim_scheduled_tasks(10, 'w3')`);
check("una tarea colgada más de 10 minutos se vuelve a tomar", stale.length === 1 && stale[0].id === due.id && stale[0].attempts === 2, JSON.stringify(stale));
await svc(`update public.scheduled_tasks set locked_at = now() - interval '5 minutes' where id = $1`, [due.id]);
check("una que lleva 5 minutos corriendo no se toca", (await svc(`select id from public.claim_scheduled_tasks(10, 'w4')`)).length === 0);

// --- p_only: correr una tarea concreta al encolarla
const [now1] = await svc(`select public.enqueue_task('followups_due', '{}') as id`);
const [now2] = await svc(`select public.enqueue_task('followups_due', '{}', now(), 'otra') as id`);
const only = await svc(`select id from public.claim_scheduled_tasks(1, 'w5', $1)`, [now2.id]);
check("p_only toma exactamente esa tarea", only.length === 1 && only[0].id === now2.id);
await svc(`select public.finish_scheduled_task($1, true)`, [now2.id]);
check("terminada queda done", (await svc(`select status from public.scheduled_tasks where id = $1`, [now2.id]))[0].status === "done");

// --- falla definitiva sin reintentar, con aviso a los admins (no a los reclutadores)
await svc(`select id from public.claim_scheduled_tasks(1, 'w6', $1)`, [now1.id]);
const [dead] = await svc(`select status from public.finish_scheduled_task($1, false, 'La vacante no tiene pesos', false)`, [now1.id]);
check("p_retry = false falla al primer intento", dead.status === "failed");
const notes = await svc(`select user_id, kind, body, href from public.notifications where entity_id = $1`, [now1.id]);
check("avisa a los admins con el error", notes.length === 1 && notes[0].user_id === admin.id && notes[0].kind === "task_failed" && notes[0].body.includes("La vacante no tiene pesos") && notes[0].href === "/configuracion#tareas", JSON.stringify(notes));

// --- agotar intentos también falla y avisa
const [maxed] = await svc(`select public.enqueue_task('cv_score', '{}') as id`);
await svc(`update public.scheduled_tasks set max_attempts = 1 where id = $1`, [maxed.id]);
await svc(`select id from public.claim_scheduled_tasks(1, 'w7', $1)`, [maxed.id]);
const [gone] = await svc(`select status from public.finish_scheduled_task($1, false, 'boom')`, [maxed.id]);
check("al agotar intentos queda failed", gone.status === "failed");

// --- reintentar y cancelar: solo admin
const recRetry = await as(db, A, () => errorOf(() => q(`select public.retry_scheduled_task($1)`, [now1.id])));
check("el reclutador no puede reintentar", !!recRetry, recRetry ?? "sin error");
const [again] = await as(db, admin, () => q(`select status, attempts, last_error from public.retry_scheduled_task($1)`, [now1.id]));
check("el admin reintenta: pendiente, 0 intentos, sin error", again.status === "pending" && again.attempts === 0 && again.last_error === null, JSON.stringify(again));
const retryPending = await as(db, admin, () => errorOf(() => q(`select public.retry_scheduled_task($1)`, [now1.id])));
check("no se reintenta una que ya está pendiente", !!retryPending);
const [cancelled] = await as(db, admin, () => q(`select status from public.cancel_scheduled_task($1)`, [later.id]));
check("el admin cancela una pendiente", cancelled.status === "cancelled");
const recCancel = await as(db, B, () => errorOf(() => q(`select public.cancel_scheduled_task($1)`, [now1.id])));
check("el reclutador no puede cancelar", !!recCancel, recCancel ?? "sin error");
check("el admin ve la cola; el reclutador no", (await as(db, admin, () => q(`select id from public.scheduled_tasks`))).length >= 4 && (await as(db, A, () => q(`select id from public.scheduled_tasks`))).length === 0);

// --- avisos de permanencia
const app = await svc(
  `with c as (insert into public.candidates (full_name, phone_e164) values ('Ana Contratada', '+524491000001') returning id)
   insert into public.applications (candidate_id, profile_id) select id, $1 from c returning id, assigned_recruiter_id`,
  [PX],
);
await svc(`update public.applications set stage = 'hired', hired_at = now() - interval '31 days', start_date = current_date - 31 where id = $1`, [app[0].id]);
const fus = await svc(`select checkpoint_days, due_at <= current_date as due from public.placement_followups where application_id = $1 order by checkpoint_days`, [app[0].id]);
check("al contratar hay tres cortes y el de 30 ya venció", fus.length === 3 && fus[0].due && !fus[1].due, JSON.stringify(fus));
const recNotify = await as(db, A, () => errorOf(() => q(`select public.notify_followups_due()`)));
check("un usuario no puede disparar los avisos", !!recNotify, recNotify ?? "sin error");
const [sent] = await svc(`select public.notify_followups_due() as n`);
check("avisa el corte vencido", sent.n === 1, `${sent.n}`);
const who = await svc(`select user_id, title from public.notifications where kind = 'followup_due' order by user_id`);
const ids = who.map((r) => r.user_id).sort();
check("le llega al reclutador del candidato y a los admins, no a otro reclutador", ids.length === 2 && ids.includes(admin.id) && ids.includes(A.id) && !ids.includes(B.id), JSON.stringify(who));
check("el aviso dice el corte y el nombre", who[0].title === "Seguimiento de 30 días: ¿sigue Ana Contratada?", who[0].title);
const [twice] = await svc(`select public.notify_followups_due() as n`);
check("no repite el aviso al día siguiente", twice.n === 0, `${twice.n}`);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
