// Crea los usuarios de desarrollo (un admin, dos reclutadores, un cliente) con auth.admin,
// que es la única vía para escribir app_metadata, y reparte las vacantes de Telasist
// entre los dos reclutadores (plan §2.3). Idempotente.
//
//   npm run db:seed-users      (usa .env.local)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEV_CLIENT_ID = "a0000000-0000-4000-8000-000000000001"; // Telasist (seed.sql)
const PASSWORD = "Prime2026!";

const users = [
  { email: "admin@prime.local", full_name: "Andrea Lugo", role: "admin", client_id: null },
  { email: "reclutador@prime.local", full_name: "Roberto Reclutador", role: "recruiter", client_id: null },
  { email: "reclutadora@prime.local", full_name: "Lucía Reclutadora", role: "recruiter", client_id: null },
  { email: "cliente@prime.local", full_name: "Verónica (Telasist)", role: "client", client_id: DEV_CLIENT_ID },
];

async function findByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

for (const u of users) {
  const app_metadata = { role: u.role, client_id: u.client_id };
  const existing = await findByEmail(u.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata,
      user_metadata: { full_name: u.full_name },
      password: PASSWORD,
    });
    if (error) throw error;
    console.log(`actualizado  ${u.role.padEnd(9)} ${u.email}`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    console.log(`creado       ${u.role.padEnd(9)} ${u.email}`);
  }
}

const { data: mirror, error } = await admin.from("users").select("id, email, role, client_id, is_active");
if (error) throw error;
console.table(mirror.map(({ email, role, client_id, is_active }) => ({ email, role, client_id, is_active })));

// Vacantes de Telasist (seed.sql) repartidas entre los dos reclutadores; la 2 la comparten.
const idOf = (email) => mirror.find((u) => u.email === email)?.id;
const roberto = idOf("reclutador@prime.local");
const lucia = idOf("reclutadora@prime.local");
const TEAMS = {
  "b0000000-0000-4000-8000-000000000001": [roberto],
  "b0000000-0000-4000-8000-000000000002": [roberto, lucia],
  "b0000000-0000-4000-8000-000000000003": [lucia],
};
for (const [profileId, team] of Object.entries(TEAMS)) {
  const { error: teamError } = await admin.rpc("set_profile_recruiters", { p_profile_id: profileId, p_recruiter_ids: team });
  if (teamError) throw teamError;
}
const { data: teams } = await admin
  .from("job_profile_assignments")
  .select("job_profiles(title), users!job_profile_assignments_recruiter_id_fkey(email)");
console.table((teams ?? []).map((t) => ({ vacante: t.job_profiles?.title, reclutador: t.users?.email })));

console.log(`\nContraseña de todos: ${PASSWORD}`);
