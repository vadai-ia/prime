"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { asJson, type IntakeForm } from "@/lib/domain/json";
import { profileFromIntake } from "@/lib/domain/profile-from-intake";
import { formString as str, positionFromFormData } from "@/lib/domain/intake-form-data";
import { aiEnabled } from "@/lib/ai/client";
import { extractIntakeFromDocument, type IntakeDocument } from "@/lib/ai/tasks/extract-intake";

export type IntakeFormState = { error?: string } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Inserta la vacante del levantamiento y lo marca como generado. Devuelve el id del perfil. */
async function insertProfile(supabase: Supabase, intake: { id: string; form: IntakeForm }, clientId: string, userId: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE ?? "America/Mexico_City" }).format(new Date());
  const { data: profile, error } = await supabase
    .from("job_profiles")
    .insert(profileFromIntake(intake.form, { clientId, intakeId: intake.id, userId, today }))
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: linkError } = await supabase.from("job_intakes").update({ profile_id: profile.id, client_id: clientId, status: "generated" }).eq("id", intake.id);
  if (linkError) return { error: linkError.message };
  return { profileId: profile.id };
}

const schema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Nombre del puesto requerido"),
});

const recruiterIdsSchema = z.array(z.string().uuid());

/** Guarda el levantamiento (secciones I a VI) en job_intakes.form. Con intent=create_profile crea además la vacante. */
export async function saveIntake(_prev: IntakeFormState, formData: FormData): Promise<IntakeFormState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const parsed = schema.safeParse({ client_id: formData.get("client_id") ?? "", title: formData.get("title") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const form: IntakeForm = {
    company: { name: str(formData.get("company_name")), industry: str(formData.get("company_industry")), city: str(formData.get("company_city")), contact_name: str(formData.get("contact_name")), contact_title: str(formData.get("contact_title")), contact_email: str(formData.get("contact_email")), contact_phone: str(formData.get("contact_phone")) },
    ...positionFromFormData(formData, parsed.data.title),
  };

  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const createProfile = formData.get("intent") === "create_profile";
  // Crear la vacante es de admin: quien la crea decide qué reclutadores la trabajan (plan §2.3).
  if (createProfile && session.role !== "admin") return { error: "Solo un administrador crea la vacante. Guarda el levantamiento como borrador y pídele que la genere." };
  const clientId = parsed.data.client_id || null;
  if (createProfile && !clientId) return { error: "Para crear la vacante selecciona un cliente existente. Si es nuevo, dalo de alta primero o guarda como borrador." };

  const supabase = await createClient();
  const { data: intake, error } = await supabase
    .from("job_intakes")
    .insert({ client_id: clientId, form, status: "draft", created_by: session.userId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  let target = "/perfiles";
  if (createProfile && clientId) {
    const created = await insertProfile(supabase, { id: intake.id, form }, clientId, session.userId);
    if (!created.profileId) return { error: `El levantamiento se guardó como borrador, pero no se pudo crear la vacante: ${created.error}` };
    target = `/perfiles/${created.profileId}`;
    // Los reclutadores marcados al crear: la misma RPC de la pestaña Reclutadores (deja el historial). Si falla, la
    // vacante ya existe y se sigue a su ficha, donde la pestaña muestra que quedó sin reclutadores.
    const recruiters = recruiterIdsSchema.safeParse(formData.getAll("recruiter_ids"));
    if (recruiters.success && recruiters.data.length) {
      const { error: assignError } = await supabase.rpc("set_profile_recruiters", { p_profile_id: created.profileId, p_recruiter_ids: recruiters.data });
      if (assignError) console.error("set_profile_recruiters", assignError.message);
    }
    revalidatePath("/candidatos");
    revalidatePath("/tablero");
  }

  revalidatePath("/perfiles");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  redirect(target);
}

const profileSchema = z.object({
  intake_id: z.string().uuid(),
  client_id: z.string().uuid().optional().or(z.literal("")),
});

/** Crea la vacante de un levantamiento en borrador. Si el levantamiento no tenía cliente, se liga al que venga en el formulario. */
export async function createProfileFromIntake(_prev: IntakeFormState, formData: FormData): Promise<IntakeFormState> {
  let session;
  try {
    session = await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const parsed = profileSchema.safeParse({ intake_id: formData.get("intake_id"), client_id: formData.get("client_id") ?? "" });
  if (!parsed.success) return { error: "Datos no válidos" };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const supabase = await createClient();
  const { data: intake, error } = await supabase.from("job_intakes").select("id, client_id, profile_id, form").eq("id", parsed.data.intake_id).maybeSingle();
  if (error) return { error: error.message };
  if (!intake) return { error: "Levantamiento no encontrado" };
  if (intake.profile_id) redirect(`/perfiles/${intake.profile_id}`);

  const clientId = intake.client_id ?? (parsed.data.client_id || null);
  if (!clientId) return { error: "Selecciona el cliente de esta vacante" };

  const created = await insertProfile(supabase, { id: intake.id, form: asJson<IntakeForm>(intake.form, {}) }, clientId, session.userId);
  if (created.error) return { error: created.error };

  revalidatePath("/perfiles");
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/perfiles/${created.profileId}`);
}

/** Tope del descriptivo: cabe en el límite de las acciones del servidor (next.config.ts) y en el de Vercel (4.5 MB). */
const MAX_DESCRIPTION_BYTES = 4 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type JobDescriptionResult = { ok: true; form: Omit<IntakeForm, "company">; isJobDescription: boolean } | { ok: false; error: string };

/**
 * "Subir descriptivo" del levantamiento: Claude lee el D.P. (PDF o Word) y propone las secciones II a VII.
 * No guarda nada; el formulario solo llena lo que esté vacío y quien captura revisa antes de guardar.
 * El archivo no se conserva: el levantamiento guarda lo capturado, no el documento.
 */
export async function readJobDescription(formData: FormData): Promise<JobDescriptionResult> {
  try {
    await assertStaff();
  } catch (e) {
    return { ok: false, error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { ok: false, error: MOCK_WRITE_ERROR };
  if (!aiEnabled()) return { ok: false, error: "La IA no está configurada: falta ANTHROPIC_API_KEY en el servidor." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elige el archivo del descriptivo." };
  if (file.size > MAX_DESCRIPTION_BYTES) return { ok: false, error: "El archivo no puede pesar más de 4 MB." };

  const name = file.name.toLowerCase();
  let kind: IntakeDocument["kind"];
  if (file.type === "application/pdf" || name.endsWith(".pdf")) kind = "pdf";
  else if (file.type === DOCX_MIME || name.endsWith(".docx")) kind = "docx";
  else if (name.endsWith(".doc")) return { ok: false, error: "Es un Word antiguo (.doc). Ábrelo y guárdalo como .docx o como PDF." };
  else return { ok: false, error: "El descriptivo debe ser PDF o Word (.docx)." };

  const result = await extractIntakeFromDocument({ kind, bytes: Buffer.from(await file.arrayBuffer()), name: file.name });
  if (!result.ok) return result;
  return { ok: true, form: result.form, isJobDescription: result.isJobDescription };
}
