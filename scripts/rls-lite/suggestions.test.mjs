// Candidatos sugeridos de otras vacantes (migración 0032): solo el admin ve y decide las sugerencias,
// y la búsqueda deja fuera a la lista negra, a quien sigue en proceso y a quien trabaja por Prime.
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const CX = "a0000000-0000-4000-8000-000000000001";
const CY = "a0000000-0000-4000-8000-000000000002";
const PX = "b0000000-0000-4000-8000-000000000001"; // la vacante que busca
const PY = "b0000000-0000-4000-8000-000000000002"; // otra vacante, de otro cliente
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X'), ('${CY}', 'Telasist');
  insert into public.job_profiles (id, client_id, title, status, requirements, activities) values
    ('${PX}', '${CX}', 'Vendedor de mostrador', 'active', '{"experience": "1 año en ventas"}', '{"Atender clientes en mostrador"}'),
    ('${PY}', '${CY}', 'Ejecutivo telefónico', 'active', '{}', '{}');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin", full_name: "Andrea" });
const A = await createUser(db, { email: "a@t", role: "recruiter", full_name: "Reclutador A" });
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX, full_name: "Contacto X" });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]).then(() => q(`select public.set_profile_recruiters($1, $2)`, [PY, [A.id]])));

const VENDEDOR = "Vendedor de mostrador con tres años en ventas y atención a clientes.";
let n = 0;
/** Persona con una postulación en PY en la etapa dada. */
async function person(name, cv, stage = "discarded") {
  n += 1;
  return as(db, "service", async () => {
    const [c] = await q(`insert into public.candidates (full_name, phone_e164, cv_text) values ($1, $2, $3) returning id`, [name, `+5244910000${String(n).padStart(2, "0")}`, cv]);
    const [a] = await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2) returning id`, [c.id, PY]);
    if (stage !== "new") await q(`update public.applications set stage = $2::public.application_stage, hired_at = case when $2::text = 'hired' then now() end where id = $1`, [a.id, stage]);
    return { id: c.id, app: a.id };
  });
}

const discarded = await person("Descartada en Telasist", VENDEDOR);
const inProcess = await person("Sigue en proceso", VENDEDOR, "prefilter");
const working = await person("Trabajando por Prime", VENDEDOR, "hired");
const left = await person("Contratado que se fue", VENDEDOR, "hired");
const vetada = await person("En lista negra", VENDEDOR);
const contador = await person("Contador", "Contador público, cierres contables, SAT y nóminas.");
const already = await person("Ya postulado aquí", VENDEDOR);

await as(db, "service", async () => {
  await q(
    `insert into public.placement_followups (application_id, checkpoint_days, due_at, outcome) values ($1, 30, current_date, 'left')
     on conflict (application_id, checkpoint_days) do update set outcome = 'left'`,
    [left.app],
  );
  await q(`insert into public.applications (candidate_id, profile_id) values ($1, $2)`, [already.id, PX]);
});
await as(db, admin, () => q(`select public.blacklist_candidate($1, 'theft', 'x')`, [vetada.id]));

// --- quién entra a la búsqueda
const pool = await as(db, "service", () => q(`select * from public.suggestion_pool($1, 12)`, [PX]));
const ids = new Set(pool.map((r) => r.candidate_id));
check("entra quien fue descartado en otro cliente", ids.has(discarded.id));
check("entra el contratado que ya se fue", ids.has(left.id));
check("no entra quien sigue en proceso", !ids.has(inProcess.id));
check("no entra quien trabaja por Prime", !ids.has(working.id));
check("no entra la lista negra", !ids.has(vetada.id));
check("no entra quien ya está postulado a esta vacante", !ids.has(already.id));
check("no entra un CV que no se parece a la vacante", !ids.has(contador.id));
check("trae su postulación más reciente de origen", pool.find((r) => r.candidate_id === discarded.id)?.source_application_id === discarded.app);
check("solo esos dos", pool.length === 2, JSON.stringify(pool));

// --- solo la cola (service role) busca
const adminCall = await as(db, admin, () => errorOf(() => q(`select * from public.suggestion_pool($1, 12)`, [PX])));
check("ni el admin llama la búsqueda directo (va por la cola)", !!adminCall, adminCall ?? "sin error");
const recruiterCall = await as(db, A, () => errorOf(() => q(`select * from public.suggestion_pool($1, 12)`, [PX])));
check("el reclutador no puede buscar", !!recruiterCall, recruiterCall ?? "sin error");

// --- quién ve las sugerencias
await as(db, "service", () =>
  q(`insert into public.profile_candidate_suggestions (profile_id, candidate_id, source_application_id, match_rank) select $1, candidate_id, source_application_id, match_rank from public.suggestion_pool($1, 12)`, [PX]),
);
check("el admin ve las sugerencias", (await as(db, admin, () => q(`select id from public.profile_candidate_suggestions`))).length === 2);
check("el reclutador de la vacante no las ve", (await as(db, A, () => q(`select id from public.profile_candidate_suggestions`))).length === 0);
check("el cliente no las ve", (await as(db, cliente, () => q(`select id from public.profile_candidate_suggestions`))).length === 0);

const recruiterInsert = await as(db, A, () => errorOf(() => q(`insert into public.profile_candidate_suggestions (profile_id, candidate_id) values ($1, $2)`, [PX, contador.id])));
check("el reclutador no crea sugerencias", !!recruiterInsert, recruiterInsert ?? "sin error");
const adminInsert = await as(db, admin, () => errorOf(() => q(`insert into public.profile_candidate_suggestions (profile_id, candidate_id) values ($1, $2)`, [PX, contador.id])));
check("ni el admin las crea a mano (las crea la cola)", !!adminInsert, adminInsert ?? "sin error");

const recruiterUpdate = await as(db, A, () => q(`update public.profile_candidate_suggestions set status = 'dismissed' returning id`));
check("el reclutador no las descarta", recruiterUpdate.length === 0);
const adminUpdate = await as(db, admin, () => q(`update public.profile_candidate_suggestions set status = 'dismissed', decided_by = auth.uid(), decided_at = now() where candidate_id = $1 returning id`, [left.id]));
check("el admin las descarta", adminUpdate.length === 1);

// --- no se repiten
const again = await as(db, "service", () => q(`select * from public.suggestion_pool($1, 12)`, [PX]));
check("buscar de nuevo no repite a los ya sugeridos (ni a los descartados)", again.length === 0, JSON.stringify(again));

// --- traer a alguien: postulación normal, la ve el reclutador de la vacante
const brought = await as(db, admin, () => q(`insert into public.applications (candidate_id, profile_id, source_channel) values ($1, $2, 'prime_pool') returning id`, [discarded.id, PX]));
check("el admin lo trae a la vacante (Bolsa Prime)", brought.length === 1);
check("desde ahí lo ve el reclutador de la vacante", (await as(db, A, () => q(`select id from public.applications where id = $1`, [brought[0].id]))).length === 1);
const blockedBring = await as(db, admin, () => errorOf(() => q(`insert into public.applications (candidate_id, profile_id, source_channel) values ($1, $2, 'prime_pool')`, [vetada.id, PX])));
check("la lista negra no se puede traer", blockedBring === "candidate_blacklisted", blockedBring ?? "sin error");

const perm = await as(db, admin, () => q(`select app.has_permission('suggest_candidates') as ok`));
const permA = await as(db, A, () => q(`select app.has_permission('suggest_candidates') as ok`));
check("permiso suggest_candidates: admin sí, reclutador no", perm[0].ok === true && permA[0].ok === false);

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
