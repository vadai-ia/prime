import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164Mx } from "@/lib/domain/phone";
import { isValidAge, type CvFields } from "@/lib/cv/parse";
import { runAi } from "../run";
import { CvExtractOutput } from "../schemas";
import { EFFORT, PROMPT_VERSION, SYSTEM } from "../prompts/cv-extract";

/** `ageIgnored`: la edad que dice el CV cuando queda fuera de 18 a 80 (no se llena; se le avisa al reclutador). */
export type CvExtractResult = { ok: true; fields: CvFields; isCv: boolean; ageIgnored: number | null } | { ok: false; error: string };

/**
 * Lee los datos de contacto de un CV ya subido a Storage (alta individual y carga masiva). Claude lee el
 * PDF directo, también escaneado. Solo propone: el reclutador los revisa antes de dar de alta. Quien la
 * llama ya validó que el archivo es una subida suya.
 * `uploadId` es el uuid del archivo: identifica la llamada en ai_runs mientras no hay candidato.
 */
export async function extractCvContact(path: string, uploadId: string): Promise<CvExtractResult> {
  const { data, error } = await createAdminClient().storage.from("cvs").download(path);
  if (error || !data) return { ok: false, error: "No se encontró el PDF subido." };
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");

  const result = await runAi(
    { kind: "cv_extract", promptVersion: PROMPT_VERSION, effort: EFFORT, system: SYSTEM, schema: CvExtractOutput, maxTokens: 4000 },
    {
      entity: { type: "cv_upload", id: uploadId },
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }, title: "CV" },
        { type: "text", text: "Copia los datos de contacto de este CV." },
      ],
    },
  );
  if (!result.ok) return result;
  const { age } = result.output;
  return { ok: true, fields: normalize(result.output), isCv: result.output.is_cv, ageIgnored: age !== null && !isValidAge(age) ? age : null };
}

/** Lo que devuelve la IA pasa por las mismas reglas que la captura a mano: teléfono E.164, fecha válida, edad 18 a 80. */
function normalize(o: CvExtractOutput): CvFields {
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(o.birth_date.trim()) && !Number.isNaN(Date.parse(o.birth_date.trim())) ? o.birth_date.trim() : undefined;
  const age = o.age !== null && isValidAge(o.age) ? o.age : undefined;
  const email = o.email.trim().toLowerCase();
  const fields: CvFields = {
    full_name: o.full_name.trim() || undefined,
    phone: toE164Mx(o.phone) ?? undefined,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    municipality: o.municipality.trim() || undefined,
    education_level: o.education_level.trim() || undefined,
    birth_date: birth,
    age_reported: age,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as CvFields;
}
