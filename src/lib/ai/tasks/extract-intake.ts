import "server-only";
import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { IntakeForm } from "@/lib/domain/json";
import { runAi } from "../run";
import { IntakeExtractOutput } from "../schemas";
import { EFFORT, PROMPT_VERSION, SYSTEM } from "../prompts/intake-extract";

export type IntakeDocument = { kind: "pdf" | "docx"; bytes: Buffer; name: string };
export type IntakeExtractResult = { ok: true; form: Omit<IntakeForm, "company">; isJobDescription: boolean } | { ok: false; error: string };

// Un Word con menos texto que esto es una hoja vacía o pura imagen: no vale la llamada.
const MIN_DOCX_CHARS = 80;

/**
 * Lee un descriptivo de puesto y propone las secciones II a VII del levantamiento. El PDF va directo a
 * Claude (también escaneado); del Word se manda el texto. Solo propone: quien captura revisa antes de
 * guardar. Todavía no hay levantamiento, así que la llamada queda en ai_runs con su propio uuid.
 */
export async function extractIntakeFromDocument(doc: IntakeDocument): Promise<IntakeExtractResult> {
  let file: BetaContentBlockParam;
  if (doc.kind === "pdf") {
    file = { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.bytes.toString("base64") }, title: doc.name };
  } else {
    let text: string;
    try {
      text = (await mammoth.extractRawText({ buffer: doc.bytes })).value.trim();
    } catch {
      return { ok: false, error: "No se pudo abrir el Word. Guárdalo de nuevo como .docx o como PDF." };
    }
    if (text.length < MIN_DOCX_CHARS) return { ok: false, error: "El Word casi no tiene texto (¿es una imagen pegada?). Súbelo como PDF." };
    file = { type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: doc.name };
  }

  const result = await runAi(
    { kind: "intake_extract", promptVersion: PROMPT_VERSION, effort: EFFORT, system: SYSTEM, schema: IntakeExtractOutput, maxTokens: 8000 },
    { entity: { type: "intake_upload", id: randomUUID() }, content: [file, { type: "text", text: "Acomoda este descriptivo de puesto en el levantamiento." }] },
  );
  if (!result.ok) return result;
  return { ok: true, form: normalize(result.output), isJobDescription: result.output.is_job_description };
}

const MODALITIES = ["Presencial", "Híbrido", "Remoto"];

const text = (s: string) => s.trim() || undefined;
const items = (list: string[]) => list.map((s) => s.trim().replace(/^[-•*·]\s*/, "")).filter(Boolean);
const leveled = (list: { name: string; level: string }[]) => list.map((c) => ({ name: c.name.trim(), level: c.level.trim() })).filter((c) => c.name);

/** Vacíos fuera, plazas entre 1 y 999, modalidad solo si es una de las tres del formulario. */
function normalize(o: IntakeExtractOutput): Omit<IntakeForm, "company"> {
  const openings = o.position.openings !== null && Number.isInteger(o.position.openings) && o.position.openings >= 1 && o.position.openings <= 999 ? o.position.openings : undefined;
  const modality = MODALITIES.find((m) => m.toLowerCase() === o.conditions.modality.trim().toLowerCase());
  return {
    position: {
      title: text(o.position.title),
      unit: text(o.position.unit),
      reports_to: text(o.position.reports_to),
      openings,
      work_zone: text(o.position.work_zone),
      objective: text(o.position.objective),
    },
    specs: { age: text(o.specs.age), sex: text(o.specs.sex), marital_status: text(o.specs.marital_status), children: text(o.specs.children), residence: text(o.specs.residence) },
    requirements: {
      education: text(o.requirements.education),
      experience: text(o.requirements.experience),
      knowledge: items(o.requirements.knowledge),
      languages: text(o.requirements.languages),
      systems: items(o.requirements.systems),
    },
    activities: items(o.activities),
    conditions: {
      salary: text(o.conditions.salary),
      benefits: items(o.conditions.benefits),
      schedule: text(o.conditions.schedule),
      modality,
      travel: text(o.conditions.travel),
      staff_in_charge: text(o.conditions.staff_in_charge),
      tools: items(o.conditions.tools),
    },
    competencies: { functional: leveled(o.competencies.functional), leadership: leveled(o.competencies.leadership), labor: items(o.competencies.labor) },
    notes: text(o.notes),
  };
}
