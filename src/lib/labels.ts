// Etiquetas en español para enums. Sin imports de servidor: sirve en client components.
import type { Enums } from "@/lib/db/types";

export type Stage = Enums<"application_stage">;
export type Tone = "forest" | "mint" | "leaf" | "amber" | "danger" | "info" | "neutral";

export const STAGES: Stage[] = [
  "new",
  "prefilter",
  "cv_review",
  "prime_interview",
  "psychometric",
  "documents",
  "client_interview",
  "hired",
  "discarded",
];

export const PIPELINE_STAGES: Stage[] = STAGES.filter((s) => s !== "discarded");

export const STAGE_LABELS: Record<Stage, string> = {
  new: "Nuevo",
  prefilter: "Prefiltro",
  cv_review: "CV",
  prime_interview: "Entrevista Prime",
  psychometric: "Psicométrico",
  documents: "Expediente",
  client_interview: "Entrevista cliente",
  hired: "Contratado",
  discarded: "Descartado",
};

export const STAGE_TONES: Record<Stage, Tone> = {
  new: "neutral",
  prefilter: "info",
  cv_review: "info",
  prime_interview: "amber",
  psychometric: "amber",
  documents: "amber",
  client_interview: "mint",
  hired: "forest",
  discarded: "danger",
};

export const CHANNEL_LABELS: Record<Enums<"source_channel">, string> = {
  pandape: "Pandape",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  prime_pool: "Bolsa Prime",
  referral: "Referido",
  other: "Otro",
};

export const PREFILTER_LABELS: Record<Enums<"prefilter_status">, string> = {
  pending: "Sin iniciar",
  in_progress: "En curso",
  passed: "Aprobado",
  failed: "No cumple",
  exception: "Requiere revisión",
};

export const PREFILTER_TONES: Record<Enums<"prefilter_status">, Tone> = {
  pending: "neutral",
  in_progress: "info",
  passed: "mint",
  failed: "danger",
  exception: "amber",
};

export const INTERVIEW_STATUS_LABELS: Record<Enums<"interview_status">, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "No se presentó",
  cancelled: "Cancelada",
  recorded: "Grabada",
  transcribed: "Transcrita",
  analyzed: "Analizada",
};

export const INTERVIEW_STATUS_TONES: Record<Enums<"interview_status">, Tone> = {
  scheduled: "info",
  confirmed: "mint",
  completed: "forest",
  no_show: "danger",
  cancelled: "neutral",
  recorded: "amber",
  transcribed: "amber",
  analyzed: "forest",
};

export const INTERVIEW_TYPE_LABELS: Record<Enums<"interview_type">, string> = {
  prime: "Entrevista Prime",
  client: "Entrevista con cliente",
};

export const PSYCH_STATUS_LABELS: Record<Enums<"psych_status">, string> = {
  pending: "Sin enviar",
  sent: "Enviado",
  completed: "Completado",
  parsed: "Con resultado",
  failed: "Error de lectura",
};

export const PSYCH_VERDICT_LABELS: Record<Enums<"psych_verdict">, string> = {
  fit: "Apto",
  fit_with_reservations: "Apto con reservas",
  not_recommended: "No recomendado",
};

export const PSYCH_VERDICT_TONES: Record<Enums<"psych_verdict">, Tone> = {
  fit: "mint",
  fit_with_reservations: "amber",
  not_recommended: "danger",
};

export const DOC_STATUS_LABELS: Record<Enums<"doc_status">, string> = {
  pending: "Pendiente",
  received: "Recibido",
  in_review: "En revisión",
  validated: "Validado",
  rejected: "Rechazado",
};

export const DOC_STATUS_TONES: Record<Enums<"doc_status">, Tone> = {
  pending: "neutral",
  received: "info",
  in_review: "amber",
  validated: "mint",
  rejected: "danger",
};

export const DISCARD_REASON_LABELS: Record<Enums<"discard_reason_key">, string> = {
  age: "Edad",
  commute: "Traslado",
  salary: "Sueldo",
  schedule: "Horario",
  experience: "Experiencia",
  education: "Escolaridad",
  no_response: "Sin respuesta",
  invalid_phone: "Teléfono inválido",
  cv_score: "Score de CV",
  interview: "Entrevista",
  psychometric: "Psicométrico",
  documents: "Expediente",
  client_rejected: "Cliente no continuó",
  withdrew: "Declinó",
  other: "Otro",
};

export const PROFILE_STATUS_LABELS: Record<Enums<"profile_status">, string> = {
  intake: "Levantamiento",
  active: "Activa",
  paused: "Pausada",
  closed: "Cerrada",
};

export const PROFILE_STATUS_TONES: Record<Enums<"profile_status">, Tone> = {
  intake: "info",
  active: "mint",
  paused: "amber",
  closed: "neutral",
};

export const WA_FLOW_LABELS: Record<Enums<"wa_flow">, string> = {
  prefilter: "Prefiltro",
  scheduling: "Agenda",
  psychometric: "Psicométrico",
  documents: "Expediente",
  reminder: "Recordatorio",
  manual: "Manual",
};

export const WA_STATUS_LABELS: Record<Enums<"wa_conversation_status">, string> = {
  open: "Abierta",
  closed_success: "Cerrada",
  closed_rule: "Cerrada por regla",
  handoff: "Con reclutador",
  expired: "Expirada",
};

export const REPORT_TYPE_LABELS: Record<Enums<"report_type">, string> = {
  daily_internal: "Resumen diario interno",
  daily_client: "Diario al cliente",
  weekly_client: "Semanal al cliente",
};

export const ACTOR_LABELS: Record<Enums<"actor_type">, string> = {
  agent: "Vale (agente)",
  recruiter: "Reclutador",
  client: "Cliente",
  system: "Sistema",
};

export const ASSIGNMENT_SOURCE_LABELS: Record<Enums<"assignment_source">, string> = {
  manual: "Cambio manual",
  user_deactivated: "Usuario desactivado",
  role_changed: "Cambio de rol",
};

export const TEMPLATE_PURPOSE_LABELS: Record<Enums<"wa_template_purpose">, string> = {
  first_contact: "Primer contacto",
  interview_confirm: "Confirmación de entrevista",
  psych_link: "Enlace de psicométrico",
  docs_request: "Solicitud de documentos",
  reminder: "Recordatorio",
  courtesy_close: "Cierre cortés",
};

/** Días de la semana con 0 = domingo, como clients.weekly_report_dow. */
export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
