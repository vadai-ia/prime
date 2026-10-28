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

// Prime solo usa Teams (20 oct 2026): 'meet' y 'zoom' quedan en el enum, pero la migración 0020 pasó todo a Teams.
export const PLATFORM_LABELS: Record<Enums<"meeting_platform">, string> = {
  teams: "Teams",
  meet: "Teams",
  zoom: "Teams",
};

// Lista negra (solo admin). El reclutador nunca ve el motivo.
export const BLACKLIST_REASON_LABELS: Record<Enums<"blacklist_reason">, string> = {
  theft: "Robo o faltante",
  abandonment: "Abandono sin aviso",
  fake_documents: "Documentos falsos",
  misconduct: "Mala conducta",
  other: "Otro",
};

export const TASK_STATUS_LABELS: Record<Enums<"task_status">, string> = {
  pending: "Pendiente",
  running: "Corriendo",
  done: "Terminada",
  failed: "Fallida",
  cancelled: "Cancelada",
};

export const TASK_STATUS_TONES: Record<Enums<"task_status">, Tone> = {
  pending: "neutral",
  running: "info",
  done: "mint",
  failed: "danger",
  cancelled: "neutral",
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

export const FOLLOWUP_OUTCOME_LABELS: Record<Enums<"followup_outcome">, string> = {
  pending: "Por capturar",
  active: "Sigue",
  left: "Se fue",
  unknown: "No se sabe",
};

export const FOLLOWUP_OUTCOME_TONES: Record<Enums<"followup_outcome">, Tone> = {
  pending: "amber",
  active: "leaf",
  left: "danger",
  unknown: "neutral",
};

export const AI_RUN_KIND_LABELS: Record<Enums<"ai_run_kind">, string> = {
  profile_generation: "Evaluación de vacante",
  cv_score: "Score de CV",
  prefilter_reply: "Prefiltro (WhatsApp)",
  interview_analysis: "Análisis de entrevista",
  psych_parse: "Lectura de psicométrico",
  doc_check: "Revisión de documento",
  weekly_insights: "Insights semanales",
  cv_extract: "Lectura de CV",
};

export const AI_RUN_STATUS_LABELS: Record<Enums<"ai_run_status">, string> = {
  ok: "Bien",
  error: "Error",
  refusal: "Rechazada",
};

export const AI_RUN_STATUS_TONES: Record<Enums<"ai_run_status">, Tone> = {
  ok: "leaf",
  error: "danger",
  refusal: "amber",
};

export const AUDIT_ACTION_LABELS: Record<Enums<"audit_action">, string> = {
  view_cv: "Abrió un CV",
  view_document: "Abrió un documento",
  download_document: "Descargó un documento",
  view_psych_report: "Abrió un psicométrico",
  export: "Exportó",
  edit_profile: "Editó una vacante",
  edit_candidate: "Editó datos de un candidato",
};

/** Tipo de respuesta de una pregunta del prefiltro (scoring.ts ANSWER_TYPES). */
export const ANSWER_TYPE_LABELS: Record<string, string> = {
  text: "Texto libre",
  months: "Meses de experiencia",
  yes_no: "Sí / No",
  money: "Monto",
  number: "Número",
};

/** Regla de la vacante que evalúa cada pregunta del prefiltro (scoring.ts RULE_KEYS). */
export const RULE_KEY_LABELS: Record<string, string> = {
  age_range: "Edad",
  commute: "Traslado o zona",
  experience_min: "Experiencia mínima",
  salary_max: "Sueldo máximo",
  requires_saturdays: "Sábados",
  schedule: "Horario",
  education_min: "Escolaridad",
  systems: "Sistemas o conocimientos",
  other: "Sin regla (la lee el reclutador)",
};

/** Qué parte de la vacante se editó (audit_log 'edit_profile', metadata.section). */
/** Campos del candidato que se pueden editar desde su ficha (Logs técnicos los nombra así). */
export const CANDIDATE_FIELD_LABELS: Record<string, string> = {
  full_name: "Nombre",
  phone_e164: "Teléfono",
  email: "Correo",
  age_reported: "Edad",
  birth_date: "Fecha de nacimiento",
  municipality: "Municipio",
  zone: "Zona",
  education_level: "Escolaridad",
  notes: "Notas",
  curp: "CURP",
  rfc: "RFC",
  nss: "NSS",
  address_line: "Domicilio",
};

export const PROFILE_EDIT_SECTION_LABELS: Record<string, string> = {
  description: "Descriptivo",
  generated: "Evaluación generada con IA",
  cv_weights: "Pesos y umbral del CV",
  prefilter_rules: "Reglas del prefiltro",
  prefilter_questions: "Preguntas del prefiltro",
  psych_minimums: "Mínimos psicométricos",
};
