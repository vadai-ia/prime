"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { zonedToUtcIso } from "@/lib/domain/time";
import { createUploadTicket, isOwnUpload, moveUpload, removeFile, type UploadTicket } from "@/lib/uploads";

const BUCKET = "psychometrics";
const MAX_BYTES = 32 * 1024 * 1024; // límite del bucket

export type PsychActionState = { error?: string; ok?: boolean } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function ownApplication(supabase: Supabase, applicationId: string) {
  const { data } = await supabase.from("applications").select("id, candidate_id").eq("id", applicationId).maybeSingle();
  return data;
}

/** La evaluación vigente de la postulación (la más reciente). Psicotest no tiene API: todo esto es captura manual (plan §4.6). */
async function latestTest(supabase: Supabase, applicationId: string) {
  const { data } = await supabase
    .from("psychometric_tests")
    .select("id, status, report_file_path")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function done(applicationId: string): PsychActionState {
  revalidatePath(`/candidatos/${applicationId}`);
  revalidatePath("/candidatos");
  return { ok: true };
}

const sentSchema = z.object({
  application_id: z.string().uuid(),
  test_link: z.string().trim().url("El enlace de Psicotest no es válido"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha límite no válida").or(z.literal("")),
});

/** El reclutador crea la evaluación en Psicotest y registra aquí el enlace que le mandó al candidato. */
export async function savePsychSent(_prev: PsychActionState, formData: FormData): Promise<PsychActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = sentSchema.safeParse({ application_id: formData.get("application_id"), test_link: formData.get("test_link"), due_date: formData.get("due_date") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const supabase = await createClient();
  if (!(await ownApplication(supabase, d.application_id))) return { error: "Candidato no encontrado" };

  const due_at = d.due_date ? zonedToUtcIso(d.due_date, "23:59") : null;
  const current = await latestTest(supabase, d.application_id);
  // Una evaluación ya con resultado no se pisa: un enlace nuevo es una evaluación nueva.
  const { error } =
    current && current.status !== "parsed"
      ? await supabase.from("psychometric_tests").update({ test_link: d.test_link, due_at, status: current.report_file_path ? "completed" : "sent" }).eq("id", current.id)
      : await supabase.from("psychometric_tests").insert({ application_id: d.application_id, test_link: d.test_link, due_at, sent_at: new Date().toISOString(), status: "sent" });
  if (error) return { error: error.message };
  return done(d.application_id);
}

/** Paso 1 de la carga del reporte de Psicotest (PDF). */
export async function startPsychUpload(input: { applicationId: string; size: number; type: string }): Promise<UploadTicket> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  if (!z.string().uuid().safeParse(input.applicationId).success) return { error: "Datos no válidos" };

  const supabase = await createClient();
  if (!(await ownApplication(supabase, input.applicationId))) return { error: "Candidato no encontrado" };
  return createUploadTicket(BUCKET, session.userId, input, { mimes: ["application/pdf"], maxBytes: MAX_BYTES });
}

/** Paso 2: el PDF queda ligado a la evaluación vigente (o crea una). Cuando exista la lectura con IA, se encola aquí. */
export async function registerPsychReport(input: { applicationId: string; path: string }): Promise<PsychActionState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  if (!z.string().uuid().safeParse(input.applicationId).success || !isOwnUpload(input.path, session.userId)) return { error: "Archivo no válido. Vuelve a subirlo." };

  const supabase = await createClient();
  const application = await ownApplication(supabase, input.applicationId);
  if (!application) return { error: "Candidato no encontrado" };

  const moved = await moveUpload(BUCKET, input.path, `${application.candidate_id}/psychometric`);
  if ("error" in moved) return moved;

  const now = new Date().toISOString();
  const current = await latestTest(supabase, application.id);
  const { error } = current
    ? await supabase
        .from("psychometric_tests")
        .update({ report_file_path: moved.path, completed_at: now, ...(current.status === "parsed" ? {} : { status: "completed" as const }) })
        .eq("id", current.id)
    : await supabase.from("psychometric_tests").insert({ application_id: application.id, report_file_path: moved.path, completed_at: now, status: "completed" });
  if (error) {
    await removeFile(BUCKET, moved.path);
    return { error: error.message };
  }
  if (current?.report_file_path) await removeFile(BUCKET, current.report_file_path);
  return done(application.id);
}

const resultSchema = z.object({
  application_id: z.string().uuid(),
  verdict: z.enum(["fit", "fit_with_reservations", "not_recommended"], "Selecciona el veredicto"),
  fit_pct: z.coerce.number().int().min(0, "El ajuste va de 0 a 100").max(100, "El ajuste va de 0 a 100").or(z.literal("")),
});

/** Veredicto capturado por el reclutador tras leer el reporte. Deja la evaluación con resultado: es lo que ve el cliente en el portal. */
export async function savePsychResult(_prev: PsychActionState, formData: FormData): Promise<PsychActionState> {
  try {
    await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = resultSchema.safeParse({ application_id: formData.get("application_id"), verdict: formData.get("verdict"), fit_pct: formData.get("fit_pct") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const supabase = await createClient();
  if (!(await ownApplication(supabase, d.application_id))) return { error: "Candidato no encontrado" };

  const now = new Date().toISOString();
  const result = { verdict: d.verdict, fit_pct: d.fit_pct === "" ? null : d.fit_pct, status: "parsed" as const, parsed_at: now };
  const current = await latestTest(supabase, d.application_id);
  const { error } = current
    ? await supabase.from("psychometric_tests").update(result).eq("id", current.id)
    : await supabase.from("psychometric_tests").insert({ application_id: d.application_id, completed_at: now, ...result });
  if (error) return { error: error.message };
  return done(d.application_id);
}
