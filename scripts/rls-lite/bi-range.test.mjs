// Reportes por rango de fechas (migración 0033): las funciones bi_* filtran por periodo, sin rango
// dan lo mismo que las vistas v_bi_*, y respetan la misma visibilidad (el reclutador solo ve sus
// vacantes, el cliente y el anónimo nada).
import { boot, as, createUser, check, failed, errorOf } from "./harness.mjs";

const db = await boot();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

const CX = "a0000000-0000-4000-8000-000000000001";
const CY = "a0000000-0000-4000-8000-000000000002";
const PX = "b0000000-0000-4000-8000-000000000001";
const PY = "b0000000-0000-4000-8000-000000000002";
await db.exec(`
  insert into public.clients (id, name) values ('${CX}', 'Cliente X'), ('${CY}', 'Cliente Y');
  insert into public.job_profiles (id, client_id, title, status) values
    ('${PX}', '${CX}', 'Vacante X', 'active'),
    ('${PY}', '${CY}', 'Vacante Y', 'active');
`);
const admin = await createUser(db, { email: "admin@t", role: "admin" });
const A = await createUser(db, { email: "a@t", role: "recruiter" });
const cliente = await createUser(db, { email: "cx@t", role: "client", client_id: CX });
await as(db, admin, () => q(`select public.set_profile_recruiters($1, $2)`, [PX, [A.id]]));

let n = 0;
/** Postulación en la vacante dada, llegada en `applied` y descartada en `discardedAt` si viene. */
async function app(profile, applied, discardedAt = null) {
  n += 1;
  return as(db, "service", async () => {
    const [c] = await q(`insert into public.candidates (full_name, phone_e164) values ($1, $2) returning id`, [`P${n}`, `+5244920000${String(n).padStart(2, "0")}`]);
    const [a] = await q(`insert into public.applications (candidate_id, profile_id, applied_at, source_channel) values ($1, $2, $3, 'facebook') returning id`, [c.id, profile, applied]);
    if (discardedAt) {
      await q(`update public.applications set stage = 'discarded', discard_reason_key = 'no_response', discarded_at = $2 where id = $1`, [a.id, discardedAt]);
    }
    return a.id;
  });
}

await app(PX, "2026-10-05T15:00:00Z");
await app(PX, "2026-11-10T15:00:00Z");
await app(PX, "2026-11-12T15:00:00Z", "2026-11-13T15:00:00Z");
await app(PY, "2026-11-11T15:00:00Z");

const NOV = ["2026-11-01T06:00:00Z", "2026-12-01T06:00:00Z"];
const sum = (rows, col = "applications") => rows.reduce((s, r) => s + Number(r[col]), 0);

// --- sin rango = la vista
const viewCh = await as(db, admin, () => q(`select * from public.v_bi_channel`));
const fnCh = await as(db, admin, () => q(`select * from public.bi_channel()`));
check("sin fechas, bi_channel da lo mismo que v_bi_channel", sum(viewCh) === sum(fnCh) && sum(fnCh) === 4, `${sum(viewCh)} / ${sum(fnCh)}`);
const viewFunnel = await as(db, admin, () => q(`select * from public.v_bi_funnel`));
const fnFunnel = await as(db, admin, () => q(`select * from public.bi_funnel()`));
check("sin fechas, bi_funnel da lo mismo que v_bi_funnel", sum(viewFunnel) === sum(fnFunnel), `${sum(viewFunnel)} / ${sum(fnFunnel)}`);

// --- con rango
const novCh = await as(db, admin, () => q(`select * from public.bi_channel($1, $2)`, NOV));
check("noviembre: 3 postulaciones (la de octubre no entra)", sum(novCh) === 3, String(sum(novCh)));
const octCh = await as(db, admin, () => q(`select * from public.bi_channel($1, $2)`, ["2026-10-01T06:00:00Z", "2026-11-01T06:00:00Z"]));
check("octubre: 1 postulación", sum(octCh) === 1, String(sum(octCh)));
const novDisc = await as(db, admin, () => q(`select * from public.bi_discard_reasons($1, $2)`, NOV));
const octDisc = await as(db, admin, () => q(`select * from public.bi_discard_reasons($1, $2)`, ["2026-10-01T06:00:00Z", "2026-11-01T06:00:00Z"]));
check("el descarte cuenta en el mes en que se descartó", sum(novDisc) === 1 && sum(octDisc) === 0, `${sum(novDisc)} / ${sum(octDisc)}`);
const onlyFrom = await as(db, admin, () => q(`select * from public.bi_channel($1)`, ["2026-11-11T06:00:00Z"]));
check("solo 'desde': del 11 nov en adelante, 2", sum(onlyFrom) === 2, String(sum(onlyFrom)));

// --- visibilidad
const aCh = await as(db, A, () => q(`select * from public.bi_channel($1, $2)`, NOV));
check("el reclutador solo ve su vacante", aCh.length > 0 && aCh.every((r) => r.profile_id === PX) && sum(aCh) === 2, String(sum(aCh)));
const cCh = await as(db, cliente, () => q(`select * from public.bi_channel()`));
const cFunnel = await as(db, cliente, () => q(`select * from public.bi_funnel()`));
check("el cliente no ve nada", cCh.length === 0 && cFunnel.length === 0);
for (const fn of ["bi_funnel", "bi_channel", "bi_stage_durations", "bi_discard_reasons", "bi_prefilter_failures"]) {
  const err = await as(db, null, () => errorOf(() => q(`select * from public.${fn}()`)));
  check(`anónimo no puede llamar ${fn}`, !!err, err ?? "sin error");
}

console.log(failed() === 0 ? "\nTodas las verificaciones pasaron." : `\n${failed()} verificaciones fallaron.`);
process.exit(failed() === 0 ? 0 : 1);
