"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { extractCv } from "@/lib/cv/extract";
import { aiEnabled } from "@/lib/ai/client";
import { enqueue, runTaskNow } from "@/lib/queue/run";
import type { CvFields } from "@/lib/cv/parse";
import { toE164Mx } from "@/lib/domain/phone";
import { CHANNEL_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/db/types";
import type { CandidateHistoryRow } from "@/lib/queries/types";

const BUCKET = "cvs";
const MAX_BYTES = 20 * 1024 * 1024; // mismo límite que el bucket

// Las subidas caen en uploads/{usuario}/ y se mueven a {candidato}/cv/ al guardar
const uploadPrefix = (userId: string) => `uploads/${userId}/`;
const isOwnUpload = (path: string, userId: string) => path.startsWith(uploadPrefix(userId)) && /^[\w/-]+\.pdf$/.test(path);

export type CvUploadTicket = { path: string; token: string } | { error: string };

/** Paso 1 de la carga: URL firmada para que el navegador suba el PDF directo a Storage (no pasa por el servidor). */
export async function startCvUpload(file: { size: number; type: string }): Promise<CvUploadTicket> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (file.type !== "application/pdf") return { error: "El CV debe ser un PDF" };
  if (!(file.size > 0 && file.size <= MAX_BYTES)) return { error: "El PDF no puede pesar más de 20 MB" };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const path = `${uploadPrefix(session.userId)}${randomUUID()}.pdf`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path: data.path, token: data.token };
}

export type CvReadResult = { fields: CvFields; pages: number; hasText: boolean } | { error: string };

/** Paso 2: lee el PDF ya subido y propone los campos del formulario. No guarda nada. */
export async function readCv(path: string): Promise<CvReadResult> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (!isOwnUpload(path, session.userId)) return { error: "Archivo no válido" };

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error) return { error: error.message };
  try {
    const cv = await extractCv(new Uint8Array(await data.arrayBuffer()));
    return { fields: cv.fields, pages: cv.pages, hasText: cv.text.length > 0 };
  } catch {
    return { error: "No se pudo leer el PDF. El archivo quedó adjunto; captura los datos a mano." };
  }
}

/** Mueve el CV a la carpeta del candidato y saca su texto. Si algo falla, el alta sigue con lo que haya. */
async function attachCv(uploadPath: string, candidateId: string): Promise<{ cv_file_path: string; cv_text: string | null }> {
  const storage = createAdminClient().storage.from(BUCKET);
  let cvText: string | null = null;
  const { data } = await storage.download(uploadPath);
  if (data) {
    try {
      cvText = (await extractCv(new Uint8Array(await data.arrayBuffer()))).text || null;
    } catch {
      cvText = null;
    }
  }
  const finalPath = `${candidateId}/cv/${randomUUID()}.pdf`;
  const { error } = await storage.move(uploadPath, finalPath);
  return { cv_file_path: error ? uploadPath : finalPath, cv_text: cvText };
}

export type CandidateFormState = { error?: string } | undefined;

const CHANNELS = Object.keys(CHANNEL_LABELS) as [Enums<"source_channel">, ...Enums<"source_channel">[]];
const blank = z.literal("");

const schema = z.object({
  profile_id: z.string().uuid("Selecciona la vacante"),
  source_channel: z.enum(CHANNELS, "Selecciona el canal"),
  full_name: z.string().trim().min(3, "Nombre completo requerido").max(120),
  phone: z.string().trim().min(1, "Teléfono requerido"),
  email: z.string().trim().email("Correo no válido").or(blank),
  municipality: z.string().trim().max(80),
  zone: z.string().trim().max(80),
  education_level: z.string().trim().max(120),
  age_reported: z.coerce.number().int().min(15, "Edad no válida").max(80, "Edad no válida").or(blank),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento no válida").or(blank),
  notes: z.string().trim().max(2000),
  cv_path: z.string(),
});

function blacklistMessage(role: string) {
  return role === "admin"
    ? "Esta persona está en la lista negra (por teléfono, CURP o correo). Quítala de la lista en Candidatos → Lista negra para registrarla."
    : "No se puede registrar a esta persona. Consulta con tu administrador.";
}

/** Alta individual: crea (o reutiliza por teléfono) al candidato, lo postula a la vacante en etapa Nuevo y adjunta el CV. */
export async function createCandidate(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, formData.get(k) ?? ""]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const phone = toE164Mx(d.phone);
  if (!phone) return { error: "Teléfono no válido. Escribe los 10 dígitos, con o sin +52." };
  if (d.cv_path && !isOwnUpload(d.cv_path, session.userId)) return { error: "El CV adjunto no es válido. Vuelve a subirlo." };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("job_profiles").select("id, status").eq("id", d.profile_id).maybeSingle();
  if (!profile) return { error: "Vacante no encontrada o no la tienes asignada" };
  if (profile.status === "closed") return { error: "La vacante está cerrada" };

  const details = {
    email: d.email || null,
    municipality: d.municipality || null,
    zone: d.zone || null,
    education_level: d.education_level || null,
    age_reported: d.age_reported === "" ? null : d.age_reported,
    birth_date: d.birth_date || null,
    notes: d.notes || null,
  };

  // Lista negra (solo admin la ve): al reclutador no se le dice el motivo. La base lo impide igual.
  const { data: blocked } = await supabase.rpc("is_blacklisted", { p_phone: phone, p_email: d.email || undefined });
  if (blocked) return { error: blacklistMessage(session.role) };

  // El teléfono es la identidad del candidato: si ya existe se reutiliza. El reclutador no ve candidatos
  // ajenos (plan §2.3), así que el id se resuelve con una RPC que solo devuelve eso.
  const { data: existingId, error: findError } = await supabase.rpc("find_candidate_by_phone", { p_phone: phone });
  if (findError) return { error: findError.message };

  const candidateId = existingId ?? randomUUID();
  if (!existingId) {
    // Sin .select(): hasta que exista la postulación, quien lo captura todavía no puede leerlo.
    const { error } = await supabase
      .from("candidates")
      .insert({ id: candidateId, full_name: d.full_name, first_name: d.full_name.split(/\s+/)[0] ?? null, phone_e164: phone, ...details });
    if (error) return { error: error.message };
  }

  // Alta manual: la postulación queda con quien la captura; si la captura un admin, entra al round robin de la vacante.
  const { data: application, error: appError } = await supabase
    .from("applications")
    .insert({ candidate_id: candidateId, profile_id: d.profile_id, source_channel: d.source_channel })
    .select("id")
    .single();
  if (appError) {
    if (appError.code === "23505") {
      return { error: session.role === "admin" ? "Este teléfono ya está postulado a esta vacante." : "Este teléfono ya está postulado a esta vacante. Si no lo ves en tu lista, lo lleva otro reclutador." };
    }
    if (appError.message === "candidate_blacklisted") return { error: blacklistMessage(session.role) };
    return { error: appError.code === "42501" ? "No tienes asignada esta vacante." : appError.message };
  }

  // Con la postulación creada el candidato ya es visible: se completan sus datos vacíos y se adjunta el CV.
  let patch: Partial<typeof details> & { cv_file_path?: string; cv_text?: string | null } = {};
  if (existingId) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("email, municipality, zone, education_level, age_reported, birth_date, notes")
      .eq("id", candidateId)
      .maybeSingle();
    if (existing) patch = Object.fromEntries(Object.entries(details).filter(([k, v]) => v !== null && existing[k as keyof typeof details] === null));
  }
  if (d.cv_path) patch = { ...patch, ...(await attachCv(d.cv_path, candidateId)) };
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("candidates").update(patch).eq("id", candidateId);
    if (error) return { error: `El candidato quedó postulado, pero no se guardaron su CV o sus datos: ${error.message}` };
  }

  // Score del CV por la cola (tasks.md §3): se encola ya autorizado el alta y se corre en cuanto se
  // responde (10 a 20 s de Claude; el reclutador ya está en la ficha). Si falla, el cron lo reintenta
  // y, si no se puede (falta el CV o los pesos), se califica desde la ficha.
  if (d.cv_path && aiEnabled()) {
    try {
      const taskId = await enqueue("cv_score", { application_id: application.id }, { dedupeKey: `cv_score:${application.id}` });
      after(() => runTaskNow(taskId).then(() => undefined, (e) => console.error("cv_score", application.id, e)));
    } catch (e) {
      console.error("cv_score", application.id, e);
    }
  }

  revalidatePath("/candidatos");
  revalidatePath("/tablero");
  revalidatePath(`/perfiles/${d.profile_id}`);
  redirect(`/candidatos/${application.id}`);
}

/** Al capturar el teléfono: si la persona ya está registrada, en qué vacantes y cuándo. No crea ni cambia nada. */
export async function checkCandidatePhone(rawPhone: string): Promise<CandidateHistoryRow[]> {
  try {
    await assertStaff();
  } catch {
    return [];
  }
  const phone = toE164Mx(rawPhone);
  if (!phone || MOCK) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("candidate_history_by_phone", { p_phone: phone });
  return data ?? [];
}
