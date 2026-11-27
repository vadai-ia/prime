"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, UnauthorizedError, type Session } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled } from "@/lib/ai/client";
import { enqueue, runTaskNow } from "@/lib/queue/run";
import { suggestionScoreKey } from "@/lib/queue/handlers";
import { triggerWhatsApp } from "@/lib/whatsapp/trigger";
import { enqueueFirstContact } from "@/lib/whatsapp/candidate-flows";
import { MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

// Candidatos sugeridos de otras vacantes (plan §12.25). Todo aquí es solo admin (suggest_candidates):
// las sugerencias muestran personas de vacantes y clientes que un reclutador no trabaja (§2.3).

export type SuggestionActionState = { error?: string; ok?: boolean; message?: string; applicationId?: string } | undefined;

const idSchema = z.string().uuid("Dato no válido");
/** Calificaciones que corren al mismo tiempo al buscar (Claude tarda 10 a 20 s por CV). */
const SCORE_CONCURRENCY = 6;

async function authorize(): Promise<Session | { error: string }> {
  try {
    return await assertPermission("suggest_candidates");
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
}

/**
 * "Buscar candidatos de otras vacantes": encola la búsqueda y la corre al responder, junto con la
 * calificación de cada sugerido. Lo que no alcance a calificarse aquí lo retoma la cola.
 */
export async function searchProfileSuggestions(profileId: string): Promise<SuggestionActionState> {
  const session = await authorize();
  if ("error" in session) return session;
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  if (!aiEnabled()) return { error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." };
  const id = idSchema.safeParse(profileId);
  if (!id.success) return { error: "Vacante no válida" };

  // Con la sesión del admin: si la vacante no existe, no se encola nada.
  const supabase = await createClient();
  const { data: profile } = await supabase.from("job_profiles").select("id, status, job_profile_ai_configs(id)").eq("id", id.data).maybeSingle();
  if (!profile) return { error: "Vacante no encontrada" };
  if (profile.status === "closed") return { error: "La vacante está cerrada" };
  if (!profile.job_profile_ai_configs) return { error: "Primero genera la evaluación de IA de la vacante (pestaña Evaluación IA): sin criterios del CV no hay con qué comparar." };

  let taskId: string;
  try {
    taskId = await enqueue("profile_suggestions", { profile_id: id.data }, { dedupeKey: `profile_suggestions:${id.data}` });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo iniciar la búsqueda" };
  }

  after(async () => {
    try {
      await runTaskNow(taskId);
      await scorePending(id.data);
    } catch (e) {
      console.error("[sugeridos]", id.data, e);
    }
  });

  revalidatePath(`/perfiles/${id.data}`);
  return { ok: true, message: "Buscando… la IA califica a cada candidato (unos 30 a 60 s). La lista se actualiza sola." };
}

/** Corre ya las calificaciones pendientes de la vacante, de SCORE_CONCURRENCY en SCORE_CONCURRENCY. */
async function scorePending(profileId: string) {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("profile_candidate_suggestions").select("id").eq("profile_id", profileId).in("status", ["pending", "failed"]);
  const keys = (rows ?? []).map((r) => suggestionScoreKey(r.id));
  if (keys.length === 0) return;
  const { data: tasks } = await admin.from("scheduled_tasks").select("id").in("dedupe_key", keys).eq("status", "pending");
  const queue = (tasks ?? []).map((t) => t.id);
  await Promise.all(
    Array.from({ length: Math.min(SCORE_CONCURRENCY, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await runTaskNow(next).catch((e) => console.error("[sugeridos] calificar", next, e));
      }
    }),
  );
}

/**
 * Traer a un sugerido a la vacante: postulación nueva con canal "Bolsa Prime" y la calificación que
 * ya hizo la IA. Desde ahí la ven los reclutadores de la vacante; la postulación original no cambia.
 */
export async function addSuggestion(suggestionId: string): Promise<SuggestionActionState> {
  const session = await authorize();
  if ("error" in session) return session;
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const id = idSchema.safeParse(suggestionId);
  if (!id.success) return { error: "Sugerencia no válida" };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("profile_candidate_suggestions")
    .select("id, status, profile_id, candidate_id, cv_score, cv_score_breakdown, cv_score_version, rationale, flags, scored_at, job_profiles(status)")
    .eq("id", id.data)
    .maybeSingle();
  if (!s) return { error: "Sugerencia no encontrada" };
  if (s.status === "added") return { error: "Ya está en la vacante" };
  if (s.job_profiles?.status === "closed") return { error: "La vacante está cerrada" };

  const scored = s.status === "scored";
  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      candidate_id: s.candidate_id,
      profile_id: s.profile_id,
      source_channel: "prime_pool",
      ...(scored
        ? {
            cv_score: s.cv_score,
            cv_score_breakdown: s.cv_score_breakdown,
            cv_score_version: s.cv_score_version,
            cv_scored_at: s.scored_at,
            cv_ai_rationale: s.rationale,
            ai_note: s.flags ? `Revisar: ${s.flags}` : null,
          }
        : {}),
    })
    .select("id")
    .single();
  if (error) {
    if (error.message === "candidate_blacklisted") return { error: "Esta persona está en la lista negra: no se puede postular." };
    if (error.code === "23505") return { error: "Ya está postulado a esta vacante." };
    return { error: error.message };
  }

  await supabase
    .from("profile_candidate_suggestions")
    .update({ status: "added", added_application_id: application.id, decided_by: session.userId, decided_at: new Date().toISOString() })
    .eq("id", s.id);

  // Mismo primer contacto que un alta: aviso de privacidad y la vacante nueva (plan §12.22).
  await triggerWhatsApp("primer contacto", (admin) => enqueueFirstContact(admin, application.id));

  revalidatePath(`/perfiles/${s.profile_id}`);
  revalidatePath("/candidatos");
  revalidatePath("/tablero");
  return { ok: true, message: "Agregado a la vacante.", applicationId: application.id };
}

/** "No me sirve": sale de la lista y no se vuelve a sugerir para esta vacante. */
export async function dismissSuggestion(suggestionId: string): Promise<SuggestionActionState> {
  const session = await authorize();
  if ("error" in session) return session;
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const id = idSchema.safeParse(suggestionId);
  if (!id.success) return { error: "Sugerencia no válida" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_candidate_suggestions")
    .update({ status: "dismissed", decided_by: session.userId, decided_at: new Date().toISOString() })
    .eq("id", id.data)
    .neq("status", "added")
    .select("profile_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Sugerencia no encontrada" };
  revalidatePath(`/perfiles/${data.profile_id}`);
  return { ok: true };
}
