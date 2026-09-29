// Prueba de políticas RLS con los usuarios de desarrollo (admin, dos reclutadores, cliente).
//   npm run db:rls-check   (requiere supabase start + db:seed-users)
//
// Crea datos de prueba con service role, entra con cada rol y verifica
// qué ve y qué puede hacer cada uno. Sale con código 1 si algo falla.
//
// Asignación que deja db:seed-users (plan §2.3): Roberto → vacantes 1 y 2 · Lucía → 2 y 3.
// Los candidatos de prueba entran a la vacante 1, así que el round robin se los da a Roberto.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Prime2026!";
const CLIENT_ID = "a0000000-0000-4000-8000-000000000001";
const PROFILE_ID = "b0000000-0000-4000-8000-000000000001";
const PROFILE_LUCIA = "b0000000-0000-4000-8000-000000000003";

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

async function login(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// ---------------------------------------------------------------------------
// Datos de prueba (service role)
// ---------------------------------------------------------------------------
const phones = ["+5214491000001", "+5214491000002", "+5214491000003"];
await admin.from("candidates").delete().in("phone_e164", phones);

const { data: cands, error: candErr } = await admin
  .from("candidates")
  .insert([
    { full_name: "Ana Prueba", first_name: "Ana", phone_e164: phones[0] },
    { full_name: "Beto Prueba", first_name: "Beto", phone_e164: phones[1] },
    { full_name: "Carla Prueba", first_name: "Carla", phone_e164: phones[2] },
  ])
  .select("id, full_name");
if (candErr) throw candErr;

const { data: apps, error: appErr } = await admin
  .from("applications")
  .insert(cands.map((c) => ({ candidate_id: c.id, profile_id: PROFILE_ID, source_channel: "pandape" })))
  .select("id, candidate_id, stage");
if (appErr) throw appErr;
const [appNew, appPsych, appClientInterview] = apps;

// Ana se queda en new; Beto avanza a psychometric; Carla llega a client_interview.
for (const [app, stages] of [
  [appPsych, ["prefilter", "cv_review", "prime_interview", "psychometric"]],
  [appClientInterview, ["prefilter", "cv_review", "prime_interview", "psychometric", "documents", "client_interview"]],
]) {
  for (const stage of stages) {
    const { error } = await admin.rpc("set_application_stage", {
      p_application_id: app.id,
      p_to_stage: stage,
      p_actor_type: "system",
    });
    if (error) throw error;
  }
}

await admin.from("psychometric_tests").insert({
  application_id: appPsych.id,
  status: "parsed",
  verdict: "fit",
  fit_pct: 82,
  report_file_path: "psychometrics/secreto.pdf",
});

const { data: events } = await admin
  .from("application_stage_events")
  .select("to_stage")
  .eq("application_id", appClientInterview.id)
  .order("created_at");
check("trigger registra la línea de tiempo", events?.length === 7, `${events?.length} eventos (esperados 7)`);

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------
{
  const c = await login("admin@prime.local");
  const { data: pipe } = await c.from("v_pipeline").select("application_id").eq("profile_id", PROFILE_ID);
  check("admin ve v_pipeline", pipe?.length === 3, `${pipe?.length} filas`);

  const { data: users } = await c.from("users").select("id");
  check("admin ve todos los usuarios", users?.length === 4, `${users?.length}`);

  const { error: runsErr } = await c.from("ai_runs").select("id").limit(1);
  check("admin lee ai_runs", !runsErr, runsErr?.message);

  const { error: roleErr } = await c.from("users").update({ role: "admin" }).eq("email", "reclutador@prime.local");
  check("admin NO cambia role directo (solo app_metadata)", !!roleErr, roleErr?.message ?? "sin error");

  const { data: funnel, error: funnelErr } = await c.from("v_bi_funnel").select("*").eq("profile_id", PROFILE_ID);
  check("admin lee v_bi_funnel", !funnelErr && (funnel?.length ?? 0) > 0, funnelErr?.message ?? `${funnel?.length} filas`);

  const { data: profiles } = await c.from("job_profiles").select("id");
  check("admin lee todas las vacantes", profiles?.length === 3, `${profiles?.length}`);

  const { data: assigned } = await c.from("v_pipeline").select("assigned_recruiter_name").eq("profile_id", PROFILE_ID);
  check("round robin: los 3 candidatos de la vacante 1 quedaron con Roberto", assigned?.every((r) => r.assigned_recruiter_name === "Roberto Reclutador"), JSON.stringify(assigned));

  const { data: history } = await c.from("job_profile_assignment_events").select("action, actor_user_id").eq("profile_id", PROFILE_ID);
  check("admin lee el historial de asignaciones", (history?.length ?? 0) > 0, `${history?.length}`);

  const { error: exportErr } = await c.rpc("log_audit", { p_action: "export", p_entity_type: "pipeline", p_entity_id: PROFILE_ID });
  check("admin puede exportar", !exportErr, exportErr?.message);
  await c.auth.signOut();
}

// ---------------------------------------------------------------------------
// recruiter
// ---------------------------------------------------------------------------
{
  const c = await login("reclutador@prime.local");
  const { data: pipe } = await c.from("v_pipeline").select("application_id, psych_verdict").eq("profile_id", PROFILE_ID);
  check("recruiter ve v_pipeline", pipe?.length === 3, `${pipe?.length} filas`);

  const { data: runs } = await c.from("ai_runs").select("id");
  check("recruiter NO ve ai_runs", (runs?.length ?? 0) === 0);

  const { data: moved, error: moveErr } = await c.rpc("set_application_stage", {
    p_application_id: appNew.id,
    p_to_stage: "prefilter",
    p_reason: "prueba RLS",
  });
  check("recruiter mueve etapa vía RPC", !moveErr && moved?.stage === "prefilter", moveErr?.message);

  const { data: ev } = await c
    .from("application_stage_events")
    .select("actor_type, reason")
    .eq("application_id", appNew.id)
    .eq("to_stage", "prefilter")
    .maybeSingle();
  check("evento trae actor recruiter y motivo", ev?.actor_type === "recruiter" && ev?.reason === "prueba RLS", JSON.stringify(ev));

  const { error: clientsInsErr } = await c.from("clients").insert({ name: "No debería" });
  check("recruiter NO crea clientes", !!clientsInsErr);

  const { data: tpl } = await c.from("wa_templates").select("id");
  check("recruiter lee wa_templates", (tpl?.length ?? 0) === 6, `${tpl?.length}`);

  const { error: decideErr } = await c.rpc("client_decide_application", {
    p_application_id: appClientInterview.id,
    p_decision: "approve",
  });
  check("recruiter NO usa client_decide_application", !!decideErr, decideErr?.message);

  const { data: profiles } = await c.from("job_profiles").select("id").order("id");
  check("recruiter ve solo sus vacantes asignadas (1 y 2)", profiles?.length === 2 && !profiles.some((p) => p.id === PROFILE_LUCIA), JSON.stringify(profiles));

  const { data: direct } = await c.from("job_profiles").select("id").eq("id", PROFILE_LUCIA);
  check("recruiter: consulta directa de una vacante ajena no devuelve nada", (direct?.length ?? 0) === 0);

  const { error: selfAssignErr } = await c.rpc("set_profile_recruiters", { p_profile_id: PROFILE_LUCIA, p_recruiter_ids: [] });
  check("recruiter NO cambia asignaciones (RPC)", !!selfAssignErr, selfAssignErr?.message);

  const { data: me } = await c.auth.getUser();
  const { error: insertErr } = await c.from("job_profile_assignments").insert({ profile_id: PROFILE_LUCIA, recruiter_id: me.user.id });
  check("recruiter NO se asigna solo (insert directo)", !!insertErr, insertErr?.message);

  const { error: profileErr } = await c.from("job_profiles").insert({ client_id: CLIENT_ID, title: "No debería" });
  check("recruiter NO crea vacantes", !!profileErr);

  const { error: exportErr } = await c.rpc("log_audit", { p_action: "export", p_entity_type: "pipeline", p_entity_id: PROFILE_ID });
  check("recruiter NO puede exportar", !!exportErr, exportErr?.message);

  const { error: reassignErr } = await c.from("applications").update({ assigned_recruiter_id: null }).eq("id", appNew.id);
  check("recruiter NO reasigna candidatos", !!reassignErr, reassignErr?.message);
  await c.auth.signOut();
}

// ---------------------------------------------------------------------------
// segunda reclutadora: misma empresa, otras vacantes. No ve los candidatos de Roberto.
// ---------------------------------------------------------------------------
{
  const c = await login("reclutadora@prime.local");
  const { data: pipe } = await c.from("v_pipeline").select("application_id");
  check("reclutadora NO ve candidatos de otro reclutador en v_pipeline", (pipe?.length ?? 0) === 0, `${pipe?.length}`);

  const { data: apps } = await c.from("applications").select("id").eq("profile_id", PROFILE_ID);
  const { data: cands } = await c.from("candidates").select("id").in("phone_e164", phones);
  check("reclutadora: consulta directa de postulaciones y candidatos ajenos no devuelve nada", (apps?.length ?? 0) === 0 && (cands?.length ?? 0) === 0);

  const { data: portal } = await c.from("v_portal_applications").select("application_id");
  check("reclutadora NO lee candidatos ajenos por las vistas del portal", (portal?.length ?? 0) === 0, `${portal?.length}`);

  const { data: profiles } = await c.from("job_profiles").select("id");
  check("reclutadora ve sus vacantes (2 y 3) y no la 1", profiles?.length === 2 && !profiles.some((p) => p.id === PROFILE_ID), JSON.stringify(profiles));

  const { data: clients } = await c.from("clients").select("id");
  check("reclutadora ve solo los clientes de sus vacantes", clients?.length === 1 && clients[0].id === CLIENT_ID);

  // el admin la mueve a la vacante 1: aplica en la siguiente consulta, sin volver a entrar
  const { data: me } = await c.auth.getUser();
  const { data: roberto } = await admin.from("users").select("id").eq("email", "reclutador@prime.local").single();
  await admin.rpc("set_profile_recruiters", { p_profile_id: PROFILE_ID, p_recruiter_ids: [roberto.id, me.user.id] });
  const { data: after } = await c.from("job_profiles").select("id").eq("id", PROFILE_ID);
  check("asignación nueva aplica sin re-login", after?.length === 1);
  const { data: stillNone } = await c.from("applications").select("id").eq("profile_id", PROFILE_ID);
  check("compartir la vacante no le muestra los candidatos de Roberto", (stillNone?.length ?? 0) === 0, `${stillNone?.length}`);
  await admin.rpc("set_profile_recruiters", { p_profile_id: PROFILE_ID, p_recruiter_ids: [roberto.id] });
  await c.auth.signOut();
}

// ---------------------------------------------------------------------------
// client
// ---------------------------------------------------------------------------
{
  const c = await login("cliente@prime.local");

  const { data: pipe } = await c.from("v_pipeline").select("application_id");
  check("client NO ve v_pipeline", (pipe?.length ?? 0) === 0, `${pipe?.length}`);

  const { data: portal, error: portalErr } = await c.from("v_portal_applications").select("application_id, stage, psych_verdict");
  const stages = (portal ?? []).map((r) => r.stage).sort();
  check(
    "client ve solo etapa ≥ psychometric en v_portal_applications",
    !portalErr && stages.join(",") === "client_interview,psychometric",
    portalErr?.message ?? stages.join(","),
  );
  check("portal expone verdict sin archivo", portal?.some((r) => r.psych_verdict === "fit") && !("report_file_path" in (portal?.[0] ?? {})));

  const { data: directApps } = await c.from("applications").select("id, stage");
  check("client select directo en applications solo visibles", directApps?.length === 2, `${directApps?.length}`);

  const { data: cands } = await c.from("candidates").select("full_name");
  check("client ve candidatos solo de postulaciones visibles", cands?.length === 2 && !cands.some((x) => x.full_name === "Ana Prueba"), JSON.stringify(cands));

  const { data: psych } = await c.from("psychometric_tests").select("id");
  check("client NO lee psychometric_tests", (psych?.length ?? 0) === 0);

  const { data: wa } = await c.from("wa_conversations").select("id");
  check("client NO lee wa_conversations", (wa?.length ?? 0) === 0);

  const { data: users } = await c.from("users").select("email");
  check("client solo se ve a sí mismo en users", users?.length === 1 && users[0].email === "cliente@prime.local", JSON.stringify(users));

  const { data: clients } = await c.from("clients").select("id");
  check("client ve solo su empresa", clients?.length === 1 && clients[0].id === CLIENT_ID);

  const { data: upd } = await c.from("applications").update({ ai_note: "hack" }).eq("id", appClientInterview.id).select("id");
  check("client NO actualiza applications", (upd?.length ?? 0) === 0);

  const { error: earlyErr } = await c.rpc("client_decide_application", {
    p_application_id: appPsych.id,
    p_decision: "approve",
  });
  check("client NO decide fuera de client_interview", !!earlyErr, earlyErr?.message);

  const { data: decided, error: decideErr } = await c.rpc("client_decide_application", {
    p_application_id: appClientInterview.id,
    p_decision: "approve",
    p_comment: "Nos gustó",
  });
  check("client da Vo.Bo. vía RPC", !decideErr && decided?.stage === "hired", decideErr?.message ?? JSON.stringify(decided));

  const { data: hiredEv } = await admin
    .from("application_stage_events")
    .select("actor_type, reason, from_stage")
    .eq("application_id", appClientInterview.id)
    .eq("to_stage", "hired")
    .maybeSingle();
  check("evento del Vo.Bo. trae actor client", hiredEv?.actor_type === "client" && hiredEv?.from_stage === "client_interview", JSON.stringify(hiredEv));

  const { data: fups } = await admin.from("placement_followups").select("checkpoint_days, due_at").eq("application_id", appClientInterview.id).order("checkpoint_days");
  check("al contratar se programan 3 seguimientos (30/90/180)", fups?.map((f) => f.checkpoint_days).join(",") === "30,90,180", JSON.stringify(fups));

  const { data: notes } = await admin.from("notifications").select("user_id, kind, title").eq("entity_id", appClientInterview.id).eq("kind", "client_decision");
  check("el Vo.Bo. avisa al admin y al reclutador del candidato (no a todo el staff)", (notes?.length ?? 0) === 2, `${notes?.length} · ${notes?.[0]?.title ?? ""}`);

  const { data: clientNotes } = await c.from("notifications").select("id");
  check("client NO ve notificaciones del staff", (clientNotes?.length ?? 0) === 0);

  const { error: enqueueErr } = await c.rpc("enqueue_task", { p_type: "wa_send", p_payload: {} });
  check("client NO encola tareas", !!enqueueErr, enqueueErr?.message);
  await c.auth.signOut();
}

// ---------------------------------------------------------------------------
// anónimo
// ---------------------------------------------------------------------------
{
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await c.from("clients").select("id");
  check("anónimo no ve nada", (data?.length ?? 0) === 0);
  const { data: tpl } = await c.from("document_types").select("key");
  check("anónimo no ve document_types", (tpl?.length ?? 0) === 0);
}

// recruiter recibe y marca leída la notificación del Vo.Bo.
{
  const c = await login("reclutador@prime.local");
  const { data: mine } = await c.from("notifications").select("id, kind, read_at").eq("entity_id", appClientInterview.id);
  check("recruiter ve la notificación del Vo.Bo.", mine?.length === 1 && mine[0].read_at === null, JSON.stringify(mine));
  const { data: marked, error: markErr } = await c.rpc("mark_notifications_read", { p_ids: mine?.map((n) => n.id) ?? [] });
  check("recruiter marca leída su notificación", !markErr && marked === 1, markErr?.message ?? `${marked}`);
  const { data: fupsAsRecruiter } = await c.from("placement_followups").select("id").eq("application_id", appClientInterview.id);
  check("recruiter lee los seguimientos", fupsAsRecruiter?.length === 3, `${fupsAsRecruiter?.length}`);
  await c.auth.signOut();
}

// limpieza
await admin.from("notifications").delete().in("entity_id", apps.map((a) => a.id));
await admin.from("candidates").delete().in("phone_e164", phones);

console.log(failures === 0 ? "\nTodas las verificaciones pasaron." : `\n${failures} verificaciones fallaron.`);
process.exit(failures === 0 ? 0 : 1);
