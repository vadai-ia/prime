// "Requiere tu atención": regla única que usan el Tablero y el resumen diario interno.
import type { PipelineRow } from "@/lib/queries/types";

/** Excepciones de prefiltro, documentos por revisar, IA pausada, CV bajo umbral, psicométrico sin respuesta, nuevo sin contacto. */
export function needsAttention(r: PipelineRow): boolean {
  if (r.stage === "discarded" || r.stage === "hired") return false;
  if (r.prefilter_status === "exception") return true;
  if ((r.docs_in_review ?? 0) > 0) return true;
  if (r.wa_ai_paused) return true;
  if (r.stage === "cv_review" && r.cv_score !== null && r.cv_threshold !== null && r.cv_score < r.cv_threshold) return true;
  if (r.stage === "psychometric" && r.psych_status === "sent" && (r.days_in_stage ?? 0) >= 3) return true;
  if (r.stage === "new" && (r.days_in_stage ?? 0) >= 2) return true;
  return false;
}

export function attentionReason(r: PipelineRow): string {
  if (r.prefilter_status === "exception") return "Excepción de prefiltro";
  if ((r.docs_in_review ?? 0) > 0) return `${r.docs_in_review} ${r.docs_in_review === 1 ? "documento" : "documentos"} por revisar`;
  if (r.wa_ai_paused) return "Conversación con reclutador";
  if (r.stage === "cv_review" && r.cv_score !== null && r.cv_threshold !== null && r.cv_score < r.cv_threshold) return "CV bajo umbral";
  if (r.stage === "psychometric" && r.psych_status === "sent") return "Psicométrico sin respuesta";
  if (r.stage === "new") return "Sin primer contacto";
  return "Revisar";
}
