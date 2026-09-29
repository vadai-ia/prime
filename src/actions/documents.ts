"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff, UnauthorizedError } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";
import { createUploadTicket, isOwnUpload, moveUpload, removeFile, type UploadTicket } from "@/lib/uploads";

const BUCKET = "documents";
const MAX_BYTES = 20 * 1024 * 1024; // límite del bucket
const MIMES = { pdf: ["application/pdf"], image: ["image/jpeg", "image/png", "image/webp"] } as const;

export type DocumentActionState = { error?: string; ok?: boolean } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** La postulación leída con la sesión del usuario: si RLS no la devuelve, el candidato no es suyo. */
async function ownApplication(supabase: Supabase, applicationId: string) {
  const { data } = await supabase.from("applications").select("id, candidate_id").eq("id", applicationId).maybeSingle();
  return data;
}

const startSchema = z.object({ applicationId: z.string().uuid(), documentTypeKey: z.string().min(1), size: z.number(), type: z.string() });

/** Paso 1 de la carga manual de un documento del expediente (INE, CURP, constancia…). */
export async function startDocumentUpload(input: { applicationId: string; documentTypeKey: string; size: number; type: string }): Promise<UploadTicket> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos no válidos" };

  const supabase = await createClient();
  if (!(await ownApplication(supabase, parsed.data.applicationId))) return { error: "Candidato no encontrado" };
  const { data: docType } = await supabase.from("document_types").select("accepts").eq("key", parsed.data.documentTypeKey).maybeSingle();
  if (!docType) return { error: "Tipo de documento no válido" };

  const mimes = docType.accepts.flatMap((a) => (a === "pdf" || a === "image" ? [...MIMES[a]] : []));
  return createUploadTicket(BUCKET, session.userId, parsed.data, { mimes, maxBytes: MAX_BYTES });
}

const registerSchema = z.object({ applicationId: z.string().uuid(), documentTypeKey: z.string().min(1), path: z.string(), mime: z.string(), size: z.number() });

/** Paso 2: el archivo ya está en Storage; se mueve a la carpeta del candidato y queda como "recibido" por carga manual. */
export async function registerDocument(input: { applicationId: string; documentTypeKey: string; path: string; mime: string; size: number }): Promise<DocumentActionState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success || !isOwnUpload(parsed.data.path, session.userId)) return { error: "Archivo no válido. Vuelve a subirlo." };
  const d = parsed.data;

  const supabase = await createClient();
  const application = await ownApplication(supabase, d.applicationId);
  if (!application) return { error: "Candidato no encontrado" };

  const moved = await moveUpload(BUCKET, d.path, `${application.candidate_id}/${d.documentTypeKey}`);
  if ("error" in moved) return moved;

  const { error } = await supabase.from("candidate_documents").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    document_type_key: d.documentTypeKey,
    file_path: moved.path,
    mime: d.mime,
    size_bytes: d.size,
    status: "received",
    received_via: "upload",
  });
  if (error) {
    await removeFile(BUCKET, moved.path);
    // índice único: un solo documento vigente por tipo y candidato
    return { error: error.code === "23505" ? "Ya hay un documento vigente de este tipo. Recházalo antes de subir otro." : error.message };
  }

  revalidatePath(`/candidatos/${d.applicationId}`);
  revalidatePath("/candidatos");
  return { ok: true };
}

const reviewSchema = z
  .object({
    application_id: z.string().uuid(),
    document_id: z.string().uuid(),
    decision: z.enum(["validate", "reject"]),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.decision === "validate" || (v.reason && v.reason.length >= 3), { message: "Escribe el motivo del rechazo", path: ["reason"] });

/** Validar o rechazar un documento recibido. Al rechazar queda el motivo y se puede subir otro. */
export async function reviewDocument(_prev: DocumentActionState, formData: FormData): Promise<DocumentActionState> {
  let session;
  try {
    session = await assertStaff();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };
  const parsed = reviewSchema.safeParse({
    application_id: formData.get("application_id"),
    document_id: formData.get("document_id"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const patch =
    d.decision === "validate"
      ? { status: "validated" as const, validated_by: session.userId, validated_at: new Date().toISOString(), rejected_reason: null }
      : { status: "rejected" as const, rejected_reason: d.reason ?? null, validated_by: null, validated_at: null };
  const { data, error } = await supabase.from("candidate_documents").update(patch).eq("id", d.document_id).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Documento no encontrado" };

  revalidatePath(`/candidatos/${d.application_id}`);
  revalidatePath("/candidatos");
  return { ok: true };
}
