// Datos de demostración (MOCK_DATA=1). Misma forma que las tablas y vistas,
// así las páginas no cambian cuando se conecten a la base real.
import type { Enums } from "@/lib/db/types";
import type {
  AiConfig,
  AiInsight,
  Application,
  AssignmentEvent,
  Candidate,
  CandidateDocument,
  ChannelRow,
  Client,
  DiscardReasonRow,
  DocumentType,
  FunnelRow,
  Intake,
  Interview,
  JobProfile,
  PipelineRow,
  PortalApplication,
  PortalDocument,
  PrefilterAnswer,
  PrefilterFailureRow,
  ProfileAssignment,
  PsychTest,
  ReportRun,
  StageCounts,
  StageDurationRow,
  StageEvent,
  User,
  WaConversation,
  WaMessage,
  WaTemplate,
} from "@/lib/queries/types";
import type { CvBreakdownItem, CvWeight, InterviewFinding, PrefilterQuestion, PrefilterResultItem, PsychFitRow } from "@/lib/domain/json";
import { STAGES } from "@/lib/labels";

type Stage = Enums<"application_stage">;
type Channel = Enums<"source_channel">;

const NOW = Date.now();
const D = 864e5;
export const daysAgo = (d: number, h = 0) => new Date(NOW - d * D - h * 36e5).toISOString();
export const inDays = (d: number, h = 0) => new Date(NOW + d * D + h * 36e5).toISOString();
const dateOnly = (iso: string) => iso.slice(0, 10);
const idx = (s: Stage) => STAGES.indexOf(s);

export const IDS = {
  telasist: "a0000000-0000-4000-8000-000000000001",
  bayon: "a0000000-0000-4000-8000-000000000002",
  logistica: "a0000000-0000-4000-8000-000000000003",
};

// ---------------------------------------------------------------------------
// Factories con todas las columnas
// ---------------------------------------------------------------------------
function mkUser(p: Partial<User> & Pick<User, "id" | "email" | "full_name" | "role">): User {
  return { client_id: null, phone: null, avatar_url: null, is_active: true, last_seen_at: daysAgo(0, 2), created_at: daysAgo(60), updated_at: daysAgo(1), ...p };
}
function mkClient(p: Partial<Client> & Pick<Client, "id" | "name">): Client {
  return {
    industry: null, address: null, city: null, contact_name: null, contact_title: null, contact_email: null, contact_phone: null,
    client_since: null, timezone: "America/Mexico_City", daily_report_time: "18:00:00", weekly_report_dow: 5, weekly_report_time: "09:00:00",
    report_recipients: [], portal_enabled: true, is_active: true, created_at: daysAgo(90), updated_at: daysAgo(5), ...p,
  };
}
function mkProfile(p: Partial<JobProfile> & Pick<JobProfile, "id" | "client_id" | "title">): JobProfile {
  return {
    intake_id: null, status: "active", openings: 1, unit: null, work_zone: null, objective: null, reports_to: null, prepared_by: "u-andrea",
    prepared_at: dateOnly(daysAgo(40)), specs: {}, requirements: {}, activities: [], conditions: {}, relations: [], competencies: {},
    selection_process: [], posting_text: null, published_channels: [], created_at: daysAgo(40), updated_at: daysAgo(3), ...p,
  };
}
function mkAiConfig(p: Partial<AiConfig> & Pick<AiConfig, "profile_id">): AiConfig {
  return {
    version: 1, age_min: null, age_max: null, age_is_blocking: false, commute_max_min: 60, experience_min_months: 12, salary_expectation_max: null,
    schedule_text: null, requires_saturdays: false, education_min: null, cv_weights: [], cv_threshold: 70, prefilter_questions: [], psych_minimums: [],
    psych_blocking: [], generated_by_ai: true, generated_at: daysAgo(40), prompt_version: "profile-v1", created_at: daysAgo(40), updated_at: daysAgo(40), ...p,
  };
}
function mkCandidate(p: Partial<Candidate> & Pick<Candidate, "id" | "full_name" | "phone_e164">): Candidate {
  return {
    first_name: p.full_name.split(" ")[0] ?? null, email: null, birth_date: null, age_reported: null, gender: null, zone: null, municipality: "Aguascalientes",
    education_level: null, cv_file_path: `${p.id}/cv/cv.pdf`, cv_text: null, cv_summary: null, privacy_consent_at: daysAgo(10), privacy_consent_via: "whatsapp",
    whaapy_contact_id: null, in_prime_pool: false, notes: null, curp: null, rfc: null, nss: null, address_line: null, retention_until: null,
    created_at: daysAgo(10), updated_at: daysAgo(1), ...p,
  };
}
function mkApplication(p: Partial<Application> & Pick<Application, "id" | "candidate_id" | "profile_id">): Application {
  return {
    stage: "new", stage_changed_at: daysAgo(1), source_channel: "other", applied_at: daysAgo(1), commute_minutes: null, experience_months: null,
    salary_expectation: null, available: null, availability_notes: null, prefilter_status: "pending", prefilter_result: null, cv_score: null,
    cv_score_breakdown: null, cv_score_version: null, cv_scored_at: null, cv_ai_rationale: null, ai_note: null, discard_reason_key: null, discard_reason: null,
    discarded_from_stage: null, discarded_by: null, discarded_by_user_id: null, discarded_at: null, client_decision: null, client_decision_at: null,
    client_decision_by: null, client_decision_comment: null, hired_at: null, agreed_salary: null, confirmation_sheet_path: null, confirmation_signed_at: null,
    start_date: null, import_batch_id: null, assigned_recruiter_id: null, assigned_at: null, created_at: daysAgo(1), updated_at: daysAgo(1), ...p,
  };
}
function mkInterview(p: Partial<Interview> & Pick<Interview, "id" | "application_id" | "type">): Interview {
  return {
    status: "scheduled", scheduled_at: inDays(1), duration_min: 30, platform: "teams", meeting_url: "https://teams.microsoft.com/l/meetup-join/demo-abc", calendar_event_id: null,
    calendar_owner_id: "u-roberto", interviewer_user_id: "u-roberto", client_interviewer_name: null, fireflies_meeting_id: null, summary: null, score: null,
    findings: null, analyzed_at: null, analysis_version: null, ai_run_id: null, created_at: daysAgo(5), updated_at: daysAgo(1), ...p,
  };
}
function mkPsych(p: Partial<PsychTest> & Pick<PsychTest, "id" | "application_id">): PsychTest {
  return {
    provider: "psicotest", test_link: "https://psicotest.mx/e/8f2a", sent_at: daysAgo(4), reminder_sent_at: null, due_at: inDays(2), completed_at: null,
    report_file_path: null, status: "sent", parsed: null, fit_rows: null, fit_pct: null, verdict: null, parsed_at: null, ai_run_id: null, created_at: daysAgo(4), updated_at: daysAgo(1), ...p,
  };
}
function mkDoc(p: Partial<CandidateDocument> & Pick<CandidateDocument, "id" | "candidate_id" | "document_type_key">): CandidateDocument {
  return {
    application_id: null, file_path: `${p.candidate_id}/${p.document_type_key}/doc.jpg`, mime: "image/jpeg", size_bytes: 480_000, status: "validated",
    received_via: "whatsapp", ai_check: { legible: true, name_matches: true, issues: [] }, rejected_reason: null, validated_by: "u-roberto", validated_at: daysAgo(2),
    ai_run_id: null, created_at: daysAgo(3), updated_at: daysAgo(2), ...p,
  };
}
function mkEvent(p: Partial<StageEvent> & Pick<StageEvent, "id" | "application_id" | "to_stage" | "created_at">): StageEvent {
  return { from_stage: null, actor_type: "system", actor_user_id: null, reason: null, ...p };
}
function mkConv(p: Partial<WaConversation> & Pick<WaConversation, "id" | "candidate_id" | "phone_e164">): WaConversation {
  return {
    application_id: null, whaapy_conversation_id: null, flow: "prefilter", flow_state: {}, status: "open", ai_paused: false, paused_by: null,
    last_inbound_at: daysAgo(0, 3), last_outbound_at: daysAgo(0, 3), window_expires_at: inDays(0, 21), created_at: daysAgo(2), updated_at: daysAgo(0, 3), ...p,
  };
}
function mkMsg(p: Partial<WaMessage> & Pick<WaMessage, "id" | "conversation_id" | "direction" | "body" | "created_at">): WaMessage {
  return {
    whaapy_message_id: null, wamid: null, type: "text", interactive_payload: null, media_path: null, media_mime: null, status: p.direction === "inbound" ? "read" : "delivered",
    error: null, sent_by: p.direction === "outbound" ? "agent" : null, sent_by_user_id: null, ai_run_id: null, ...p,
  };
}

// ---------------------------------------------------------------------------
// Usuarios, clientes, perfiles
// ---------------------------------------------------------------------------
export const users: User[] = [
  mkUser({ id: "u-andrea", email: "admin@prime.com", full_name: "Andrea Lugo", role: "admin" }),
  mkUser({ id: "u-roberto", email: "reclutador@prime.com", full_name: "Roberto Méndez", role: "recruiter" }),
  mkUser({ id: "u-lucia", email: "lucia@prime.com", full_name: "Lucía Herrera", role: "recruiter", last_seen_at: daysAgo(1) }),
  mkUser({ id: "u-veronica", email: "cliente@prime.com", full_name: "Verónica Salas", role: "client", client_id: IDS.telasist }),
  mkUser({ id: "u-bayon", email: "rh@telasbayon.mx", full_name: "Jorge Bayón", role: "client", client_id: IDS.bayon, last_seen_at: daysAgo(6) }),
  mkUser({ id: "u-logi", email: "talento@logicentro.mx", full_name: "Mariana Ortiz", role: "client", client_id: IDS.logistica, is_active: false, last_seen_at: null }),
];

export const clients: Client[] = [
  mkClient({
    id: IDS.telasist, name: "Telasist", industry: "Textil", city: "Aguascalientes", address: "Blvd. a Zacatecas 1200, Parque Industrial",
    contact_name: "Verónica Salas", contact_title: "Gerente de Recursos Humanos", contact_email: "cliente@prime.com", contact_phone: "+52 449 123 4567",
    client_since: "2026-01-15", report_recipients: ["cliente@prime.com", "direccion@telasist.mx"],
  }),
  mkClient({
    id: IDS.bayon, name: "Telas Bayón", industry: "Comercio textil", city: "Aguascalientes", address: "Av. Madero 315, Centro",
    contact_name: "Jorge Bayón", contact_title: "Director general", contact_email: "rh@telasbayon.mx", contact_phone: "+52 449 987 6543",
    client_since: "2026-05-02", weekly_report_dow: 1, report_recipients: ["rh@telasbayon.mx"],
  }),
  mkClient({
    id: IDS.logistica, name: "Logística del Centro", industry: "Transporte y logística", city: "San Francisco de los Romo",
    contact_name: "Mariana Ortiz", contact_title: "Coordinadora de talento", contact_email: "talento@logicentro.mx", contact_phone: "+52 449 555 0102",
    client_since: "2026-07-20", portal_enabled: false, report_recipients: ["talento@logicentro.mx"],
  }),
];

export const profiles: JobProfile[] = [
  mkProfile({
    id: "p-cobranza", client_id: IDS.telasist, intake_id: "in-cobranza", title: "Ejecutivo de cobranza", status: "active", openings: 2, unit: "Crédito y cobranza",
    work_zone: "Aguascalientes, zona norte", objective: "Recuperar cartera vencida por teléfono y visita, manteniendo la relación con el cliente.",
    reports_to: "Gerente de crédito y cobranza", prepared_at: dateOnly(daysAgo(38)),
    specs: { age: "23 a 45 años (alerta, no bloqueo)", sex: "Indistinto", marital_status: "Indistinto", children: "Indistinto", residence: "Aguascalientes o municipios conurbados" },
    requirements: { education: "Preparatoria terminada", experience: "1 año mínimo en cobranza o atención telefónica", knowledge: ["Negociación", "Cálculo de intereses moratorios", "Manejo de objeciones"], languages: "Español", systems: ["Excel intermedio", "CRM (deseable)"] },
    activities: ["Gestionar cartera asignada por teléfono y WhatsApp", "Visitar clientes con adeudo mayor a 60 días", "Negociar convenios de pago", "Registrar gestiones en el CRM", "Reportar recuperación semanal"],
    conditions: { salary: "$9,000 a $11,000 mensuales más bono por recuperación", benefits: ["Prestaciones de ley", "Vales de despensa 8%", "Bono mensual por meta"], schedule: "Lunes a viernes 8:30 a 18:00, sábados 9:00 a 13:00", modality: "Presencial", travel: "Local, 2 días por semana", staff_in_charge: "Ninguno", tools: ["Celular de empresa", "Laptop"] },
    relations: [{ with: "Ventas", purpose: "Aclarar condiciones de crédito" }, { with: "Contabilidad", purpose: "Aplicar pagos y notas de crédito" }],
    competencies: { functional: [{ name: "Negociación", level: "Alto" }, { name: "Orientación a resultados", level: "Alto" }], leadership: [{ name: "Autonomía", level: "Medio" }], labor: ["Tolerancia a la presión", "Honestidad", "Persistencia"] },
    selection_process: ["Prefiltro por WhatsApp", "Score de CV", "Entrevista Prime", "Psicométrico Psicotest", "Expediente", "Entrevista con cliente"],
    posting_text: "Telasist busca Ejecutivo de cobranza para su equipo de crédito. Sueldo base más bono por recuperación, prestaciones superiores. Zona norte de Aguascalientes.",
    published_channels: ["pandape", "facebook"],
  }),
  mkProfile({
    id: "p-diseno", client_id: IDS.telasist, intake_id: "in-diseno", title: "Diseñador industrial", status: "active", openings: 1, unit: "Desarrollo de producto",
    work_zone: "Aguascalientes, parque industrial", objective: "Diseñar fichas técnicas y prototipos de nuevos productos textiles con SolidWorks.",
    reports_to: "Gerente de desarrollo", prepared_at: dateOnly(daysAgo(50)),
    specs: { age: "24 a 40 años (alerta)", sex: "Indistinto", residence: "Aguascalientes" },
    requirements: { education: "Licenciatura en Diseño Industrial o afín", experience: "2 años en diseño de producto", knowledge: ["Modelado 3D", "Materiales textiles", "Fichas técnicas"], languages: "Inglés técnico", systems: ["SolidWorks", "AutoCAD", "Adobe Illustrator"] },
    activities: ["Modelar piezas y ensambles en SolidWorks", "Elaborar fichas técnicas para producción", "Coordinar prototipos con el taller", "Documentar cambios de ingeniería"],
    conditions: { salary: "$16,000 a $20,000 mensuales", benefits: ["Prestaciones de ley", "Fondo de ahorro", "Seguro de gastos médicos menores"], schedule: "Lunes a viernes 8:00 a 17:30", modality: "Presencial", travel: "Ocasional a proveedores" , tools: ["Workstation", "Licencia SolidWorks"] },
    relations: [{ with: "Producción", purpose: "Validar factibilidad de prototipos" }],
    competencies: { functional: [{ name: "Modelado 3D", level: "Alto" }, { name: "Atención al detalle", level: "Alto" }], leadership: [{ name: "Comunicación", level: "Medio" }], labor: ["Creatividad", "Orden"] },
    selection_process: ["Prefiltro por WhatsApp", "Score de CV y portafolio", "Entrevista Prime", "Psicométrico", "Expediente", "Entrevista con cliente"],
    posting_text: "Diseñador industrial con SolidWorks para desarrollo de producto textil. Aguascalientes, presencial.",
    published_channels: ["linkedin", "pandape"],
  }),
  mkProfile({
    id: "p-supervisor", client_id: IDS.telasist, title: "Supervisor de producción", status: "paused", openings: 1, unit: "Producción",
    work_zone: "Aguascalientes, parque industrial", objective: "Supervisar el turno vespertino de tejido.", reports_to: "Jefe de producción",
    requirements: { education: "Ingeniería industrial o afín", experience: "3 años supervisando personal operativo" },
    conditions: { salary: "$14,000 mensuales", schedule: "Turno vespertino 14:00 a 22:00", modality: "Presencial" },
    published_channels: ["pandape"], created_at: daysAgo(70), prepared_at: dateOnly(daysAgo(70)),
  }),
  mkProfile({
    id: "p-vendedor", client_id: IDS.bayon, title: "Vendedor de piso", status: "active", openings: 3, unit: "Ventas",
    work_zone: "Centro de Aguascalientes", objective: "Atender y cerrar ventas de telas al menudeo en sucursal Centro.", reports_to: "Gerente de sucursal",
    specs: { age: "20 a 50 años (alerta)", sex: "Indistinto" },
    requirements: { education: "Secundaria", experience: "1 año en ventas de mostrador", knowledge: ["Atención al cliente", "Manejo de caja"] },
    activities: ["Atender clientes en piso", "Cortar y cobrar telas", "Acomodar inventario", "Cumplir meta semanal de venta"],
    conditions: { salary: "$8,500 mensuales más comisiones", benefits: ["Prestaciones de ley", "Comisión 2%"], schedule: "Rol de 6 días, descanso entre semana", modality: "Presencial" },
    competencies: { labor: ["Actitud de servicio", "Persuasión", "Trabajo en equipo"] },
    selection_process: ["Prefiltro por WhatsApp", "Entrevista Prime", "Psicométrico", "Expediente", "Entrevista con cliente"],
    published_channels: ["facebook", "pandape"], created_at: daysAgo(30), prepared_at: dateOnly(daysAgo(30)),
  }),
  mkProfile({
    id: "p-auxiliar", client_id: IDS.logistica, intake_id: "in-auxiliar", title: "Auxiliar administrativo", status: "intake", openings: 1, unit: "Administración",
    work_zone: "San Francisco de los Romo", created_at: daysAgo(3), prepared_at: null, prepared_by: null,
  }),
];

const Q_COBRANZA: PrefilterQuestion[] = [
  { order: 1, key: "zone", text: "¿En qué colonia o municipio vives?", rule_key: "commute", answer_type: "text" },
  { order: 2, key: "experience", text: "¿Cuánto tiempo tienes de experiencia en cobranza?", rule_key: "experience_min", answer_type: "months" },
  { order: 3, key: "saturdays", text: "El puesto trabaja sábados medio día, ¿tienes disponibilidad?", rule_key: "requires_saturdays", answer_type: "yes_no" },
  { order: 4, key: "salary", text: "¿Cuál es tu expectativa de sueldo mensual?", rule_key: "salary_max", answer_type: "money" },
  { order: 5, key: "age", text: "¿Qué edad tienes?", rule_key: "age_range", answer_type: "number" },
];
const Q_DISENO: PrefilterQuestion[] = [
  { order: 1, key: "zone", text: "¿En qué colonia o municipio vives?", rule_key: "commute", answer_type: "text" },
  { order: 2, key: "software", text: "¿Qué software de diseño dominas?", rule_key: "systems", answer_type: "text" },
  { order: 3, key: "experience", text: "¿Cuántos años tienes diseñando producto?", rule_key: "experience_min", answer_type: "months" },
  { order: 4, key: "salary", text: "¿Cuál es tu expectativa de sueldo mensual?", rule_key: "salary_max", answer_type: "money" },
];
const Q_VENDEDOR: PrefilterQuestion[] = [
  { order: 1, key: "zone", text: "¿En qué colonia vives?", rule_key: "commute", answer_type: "text" },
  { order: 2, key: "experience", text: "¿Cuánto tiempo has trabajado en ventas de mostrador?", rule_key: "experience_min", answer_type: "months" },
  { order: 3, key: "schedule", text: "El rol es de 6 días con descanso entre semana, ¿te acomoda?", rule_key: "schedule", answer_type: "yes_no" },
  { order: 4, key: "salary", text: "¿Cuál es tu expectativa de sueldo mensual?", rule_key: "salary_max", answer_type: "money" },
];

const W_COBRANZA: CvWeight[] = [
  { key: "experience", label: "Experiencia en cobranza", weight: 40 },
  { key: "stability", label: "Estabilidad laboral", weight: 25 },
  { key: "skills", label: "Negociación y sistemas", weight: 20 },
  { key: "education", label: "Escolaridad", weight: 15 },
];
const W_DISENO: CvWeight[] = [
  { key: "experience", label: "Experiencia en diseño de producto", weight: 35 },
  { key: "software", label: "SolidWorks / AutoCAD", weight: 30 },
  { key: "portfolio", label: "Portafolio", weight: 20 },
  { key: "education", label: "Escolaridad", weight: 15 },
];
const W_VENDEDOR: CvWeight[] = [
  { key: "experience", label: "Ventas de mostrador", weight: 45 },
  { key: "stability", label: "Estabilidad laboral", weight: 30 },
  { key: "service", label: "Atención al cliente", weight: 25 },
];

// Quién trabaja cada vacante (plan §2.3). Cobranza la comparten: cada quien ve solo sus candidatos.
const TEAMS: Record<string, string[]> = {
  "p-cobranza": ["u-roberto", "u-lucia"],
  "p-diseno": ["u-roberto"],
  "p-supervisor": ["u-lucia"],
  "p-vendedor": ["u-lucia"],
  "p-auxiliar": ["u-roberto"],
};

export const profileAssignments: ProfileAssignment[] = Object.entries(TEAMS).flatMap(([profile_id, team]) =>
  team.map((recruiter_id, i) => ({ profile_id, recruiter_id, assigned_by: "u-andrea", assigned_at: daysAgo(38 - i), turn_seq: null, last_candidate_at: daysAgo(1 + i) })),
);

export const assignmentEvents: AssignmentEvent[] = [
  ...profileAssignments.map((a, i) => ({ id: `ae-${i}`, profile_id: a.profile_id, recruiter_id: a.recruiter_id, action: "assigned" as const, source: "manual" as const, actor_user_id: "u-andrea", created_at: a.assigned_at })),
  { id: "ae-x1", profile_id: "p-diseno", recruiter_id: "u-lucia", action: "assigned", source: "manual", actor_user_id: "u-andrea", created_at: daysAgo(30) },
  { id: "ae-x2", profile_id: "p-diseno", recruiter_id: "u-lucia", action: "unassigned", source: "manual", actor_user_id: "u-andrea", created_at: daysAgo(12) },
];

export const aiConfigs: AiConfig[] = [
  mkAiConfig({ profile_id: "p-cobranza", version: 2, age_min: 23, age_max: 45, commute_max_min: 60, experience_min_months: 12, salary_expectation_max: 11000, schedule_text: "L-V 8:30-18:00, sáb 9:00-13:00", requires_saturdays: true, education_min: "Preparatoria", cv_weights: W_COBRANZA, cv_threshold: 70, prefilter_questions: Q_COBRANZA, psych_minimums: [{ scale: "Tolerancia a la presión", min: 60 }, { scale: "Persuasión", min: 55 }, { scale: "Honestidad", min: 70 }], psych_blocking: [{ scale: "Tolerancia a la presión", min: 40 }], generated_at: daysAgo(20) }),
  mkAiConfig({ profile_id: "p-diseno", age_min: 24, age_max: 40, commute_max_min: 60, experience_min_months: 24, salary_expectation_max: 20000, schedule_text: "L-V 8:00-17:30", education_min: "Licenciatura", cv_weights: W_DISENO, cv_threshold: 75, prefilter_questions: Q_DISENO, psych_minimums: [{ scale: "Creatividad", min: 60 }, { scale: "Atención al detalle", min: 60 }, { scale: "Trabajo en equipo", min: 50 }] }),
  mkAiConfig({ profile_id: "p-supervisor", age_min: 28, age_max: 50, experience_min_months: 36, salary_expectation_max: 14000, education_min: "Ingeniería", cv_weights: W_COBRANZA, prefilter_questions: Q_COBRANZA.slice(0, 2) }),
  mkAiConfig({ profile_id: "p-vendedor", age_min: 20, age_max: 50, commute_max_min: 45, experience_min_months: 12, salary_expectation_max: 9500, schedule_text: "Rol de 6 días", education_min: "Secundaria", cv_weights: W_VENDEDOR, cv_threshold: 65, prefilter_questions: Q_VENDEDOR, psych_minimums: [{ scale: "Persuasión", min: 55 }, { scale: "Actitud de servicio", min: 60 }] }),
];

export const intakes: Intake[] = [
  { id: "in-cobranza", client_id: IDS.telasist, profile_id: "p-cobranza", status: "generated", created_by: "u-andrea", created_at: daysAgo(40), updated_at: daysAgo(38), form: { company: { name: "Telasist", industry: "Textil", city: "Aguascalientes", contact_name: "Verónica Salas", contact_title: "Gerente de RH" }, position: { title: "Ejecutivo de cobranza", unit: "Crédito y cobranza", reports_to: "Gerente de crédito y cobranza", openings: 2, work_zone: "Zona norte" }, requirements: { education: "Preparatoria", experience: "1 año en cobranza" }, conditions: { salary: "$9,000 a $11,000 más bono", schedule: "L-V y sábado medio día" }, notes: "Prioridad alta: rotación reciente en el equipo." } },
  { id: "in-diseno", client_id: IDS.telasist, profile_id: "p-diseno", status: "generated", created_by: "u-lucia", created_at: daysAgo(52), updated_at: daysAgo(50), form: { company: { name: "Telasist" }, position: { title: "Diseñador industrial", unit: "Desarrollo de producto", openings: 1 }, requirements: { education: "Licenciatura en Diseño Industrial", experience: "2 años", systems: ["SolidWorks", "AutoCAD"] }, conditions: { salary: "$16,000 a $20,000" } } },
  { id: "in-auxiliar", client_id: IDS.logistica, profile_id: "p-auxiliar", status: "draft", created_by: "u-roberto", created_at: daysAgo(3), updated_at: daysAgo(3), form: { company: { name: "Logística del Centro", contact_name: "Mariana Ortiz" }, position: { title: "Auxiliar administrativo", unit: "Administración", openings: 1 }, notes: "Falta confirmar sueldo y horario con la coordinadora." } },
];

// ---------------------------------------------------------------------------
// Candidatos y postulaciones (generados desde una especificación corta)
// ---------------------------------------------------------------------------
type Spec = {
  id: string; name: string; phone: string; profile: string; stage: Stage; channel: Channel; days: number;
  age?: number; edu?: string; zone?: string; muni?: string; email?: string;
  commute?: number; exp?: number; salary?: number; cv?: number; available?: boolean; answers?: Record<string, string>;
  prefilter?: Enums<"prefilter_status">;
  discard?: { key: Enums<"discard_reason_key">; reason: string; from: Stage; by?: Enums<"actor_type"> };
  note?: string; summary?: string;
};

const SPECS: Spec[] = [
  // Ejecutivo de cobranza · Telasist
  { id: "01", name: "Ana Lucía Torres Camacho", phone: "+5214491000101", profile: "p-cobranza", stage: "hired", channel: "pandape", days: 34, age: 29, edu: "Preparatoria", zone: "Col. Lomas del Chapulín", commute: 25, exp: 36, salary: 9500, cv: 84, email: "ana.torres@gmail.com", summary: "Tres años en cobranza telefónica en financiera; recuperación promedio 82%. Estable, dos empleos en seis años.", note: "Contratada con sueldo de $10,000. Inicia el lunes." },
  { id: "02", name: "Miguel Ángel Ruiz Delgado", phone: "+5214491000102", profile: "p-cobranza", stage: "client_interview", channel: "facebook", days: 21, age: 31, edu: "Licenciatura trunca", zone: "Col. Ojocaliente", commute: 40, exp: 24, salary: 10000, cv: 78, summary: "Dos años en cobranza de campo para arrendadora. Buen manejo de objeciones; le falta Excel.", note: "Cliente ya tiene su expediente. Entrevista con Verónica el jueves." },
  { id: "03", name: "Daniela Cortés Maldonado", phone: "+5214491000103", profile: "p-cobranza", stage: "documents", channel: "pandape", days: 18, age: 27, edu: "Preparatoria", zone: "Col. Morelos", commute: 30, exp: 18, salary: 9000, cv: 81, summary: "Año y medio en call center de cobranza bancaria. Métricas por encima del equipo.", note: "Faltan 2 documentos: comprobante de estudios y carta 2. El agente ya los pidió." },
  { id: "04", name: "José Carlos Medina Ríos", phone: "+5214491000104", profile: "p-cobranza", stage: "psychometric", channel: "pandape", days: 12, age: 35, edu: "Preparatoria", zone: "Jesús María", muni: "Jesús María", commute: 50, exp: 60, salary: 11000, cv: 76, summary: "Cinco años en cobranza extrajudicial. Perfil de campo, menos telefónico.", note: "Psicométrico enviado hace 4 días, recordatorio ayer. Sin respuesta." },
  { id: "05", name: "Fernanda Ibarra Solís", phone: "+5214491000105", profile: "p-cobranza", stage: "prime_interview", channel: "linkedin", days: 9, age: 26, edu: "Licenciatura en Administración", zone: "Col. Bosques del Prado", commute: 20, exp: 14, salary: 9800, cv: 88, email: "fer.ibarra@outlook.com", summary: "Catorce meses en crédito y cobranza de distribuidora. Excel avanzado y CRM.", note: "Entrevista Prime mañana 11:00 con Roberto." },
  { id: "06", name: "Ricardo Peña Valdez", phone: "+5214491000106", profile: "p-cobranza", stage: "cv_review", channel: "pandape", days: 6, age: 33, edu: "Secundaria", zone: "Col. Insurgentes", commute: 55, exp: 30, salary: 9000, cv: 64, summary: "Experiencia en cobranza informal (préstamos). Sin escolaridad mínima.", note: "Score 64, debajo del umbral 70. Escolaridad no cumple; decidir si se descarta." },
  { id: "07", name: "Paola Sánchez Leal", phone: "+5214491000107", profile: "p-cobranza", stage: "prefilter", channel: "facebook", days: 3, age: 24, zone: "Col. Guadalupe", prefilter: "in_progress", answers: { zone: "Colonia Guadalupe", experience: "Un año en cobranza en Coppel" }, note: "Vale va en la pregunta 3 de 5." },
  { id: "08", name: "Luis Fernando Gómez Arce", phone: "+5214491000108", profile: "p-cobranza", stage: "prefilter", channel: "pandape", days: 2, age: 47, edu: "Preparatoria", zone: "Col. Circunvalación", commute: 35, exp: 96, salary: 10500, prefilter: "exception", answers: { zone: "Circunvalación Norte", experience: "8 años", saturdays: "Sí", salary: "10,500", age: "47" }, note: "Cumple todo menos edad (47, rango 23 a 45). Regla en modo alerta: decide el reclutador." },
  { id: "09", name: "Mariana Delgado Ponce", phone: "+5214491000109", profile: "p-cobranza", stage: "new", channel: "pandape", days: 0, note: "Cargada hoy. Template de primer contacto enviado." },
  { id: "10", name: "Carlos Alberto Ramírez", phone: "+5214491000110", profile: "p-cobranza", stage: "discarded", channel: "pandape", days: 15, age: 30, zone: "Pabellón de Arteaga", muni: "Pabellón de Arteaga", commute: 95, answers: { zone: "Pabellón de Arteaga" }, discard: { key: "commute", reason: "Traslado de 95 min, máximo 60", from: "prefilter", by: "agent" } },
  { id: "11", name: "Sofía Martínez Bravo", phone: "+5214491000111", profile: "p-cobranza", stage: "discarded", channel: "facebook", days: 11, age: 28, zone: "Col. Trojes", commute: 30, exp: 24, salary: 16000, answers: { zone: "Trojes de Alonso", experience: "2 años", saturdays: "Sí", salary: "16,000" }, discard: { key: "salary", reason: "Expectativa $16,000, tope $11,000", from: "prefilter", by: "agent" } },
  { id: "12", name: "Roberto Aguilar Nieto", phone: "+5214491000112", profile: "p-cobranza", stage: "discarded", channel: "pandape", days: 8, age: 38, edu: "Secundaria", zone: "Col. España", commute: 40, exp: 6, salary: 9000, cv: 48, discard: { key: "cv_score", reason: "Score 48: sin experiencia comprobable en cobranza", from: "cv_review", by: "recruiter" } },
  // Diseñador industrial · Telasist
  { id: "13", name: "Valeria Núñez Estrada", phone: "+5214491000113", profile: "p-diseno", stage: "hired", channel: "linkedin", days: 45, age: 28, edu: "Lic. Diseño Industrial (UAA)", zone: "Col. Jardines de la Concepción", commute: 20, exp: 48, salary: 18000, cv: 91, email: "valeria.nunez@gmail.com", summary: "Cuatro años en desarrollo de producto para calzado. Portafolio sólido en SolidWorks.", note: "Contratada en $19,000. Inició hace una semana." },
  { id: "14", name: "Andrés Villalobos Cano", phone: "+5214491000114", profile: "p-diseno", stage: "client_interview", channel: "linkedin", days: 25, age: 30, edu: "Lic. Diseño Industrial (Tec)", zone: "Col. Fátima", commute: 25, exp: 60, salary: 20000, cv: 85, summary: "Cinco años en mobiliario. Muy buen dominio técnico; expectativa en el tope.", note: "Segundo candidato para la vacante por si Telasist abre otra posición." },
  { id: "15", name: "Gabriela Ponce Aranda", phone: "+5214491000115", profile: "p-diseno", stage: "documents", channel: "pandape", days: 19, age: 26, edu: "Lic. Diseño Industrial (UAA)", zone: "Col. Las Américas", commute: 30, exp: 30, salary: 17000, cv: 79, summary: "Dos años y medio en empaque. Aprende rápido; portafolio corto.", note: "Lleva 5 de 10 documentos; 2 recibidos por revisar." },
  { id: "16", name: "Emilio Castañeda Vera", phone: "+5214491000116", profile: "p-diseno", stage: "prime_interview", channel: "linkedin", days: 8, age: 27, edu: "Ing. en Diseño Industrial", zone: "Col. Villas de Ntra. Sra. de la Asunción", commute: 35, exp: 36, salary: 18500, cv: 82, summary: "Tres años en automotriz (interiores). SolidWorks y CATIA.", note: "Entrevista confirmada para pasado mañana 16:00 con Lucía." },
  { id: "17", name: "Regina Flores Ochoa", phone: "+5214491000117", profile: "p-diseno", stage: "cv_review", channel: "pandape", days: 5, age: 24, edu: "Lic. Diseño Industrial (UAA)", zone: "Col. Pilar Blanco", commute: 25, exp: 24, salary: 16000, cv: 73, summary: "Recién egresada con dos años de prácticas y freelance. Portafolio prometedor.", note: "Score 73, umbral 75. Prefiltro aprobado; revisar portafolio antes de decidir." },
  { id: "18", name: "Iván Ochoa Padilla", phone: "+5214491000118", profile: "p-diseno", stage: "prefilter", channel: "linkedin", days: 2, prefilter: "in_progress", answers: { zone: "Colonia del Valle" }, note: "Contestó la primera pregunta hace 3 horas." },
  { id: "19", name: "Karla Jiménez Robles", phone: "+5214491000119", profile: "p-diseno", stage: "discarded", channel: "linkedin", days: 14, age: 29, edu: "Lic. Diseño Gráfico", zone: "Col. Centro", commute: 15, exp: 36, salary: 17000, cv: 77, discard: { key: "interview", reason: "En entrevista no demostró dominio de SolidWorks; perfil gráfico, no industrial", from: "prime_interview", by: "recruiter" } },
  // Vendedor de piso · Telas Bayón
  { id: "20", name: "Diego Herrera Luna", phone: "+5214491000120", profile: "p-vendedor", stage: "psychometric", channel: "facebook", days: 10, age: 34, edu: "Preparatoria", zone: "Col. Centro", commute: 10, exp: 48, salary: 9000, cv: 77, summary: "Cuatro años en mostrador de ferretería. Manejo de caja y buen trato.", note: "Psicométrico enviado ayer." },
  { id: "21", name: "Alejandra Reyes Montes", phone: "+5214491000121", profile: "p-vendedor", stage: "prime_interview", channel: "facebook", days: 7, age: 22, edu: "Preparatoria", zone: "Col. Obraje", commute: 15, exp: 14, salary: 8500, cv: 80, summary: "Un año en tienda departamental, sección de telas y mercería.", note: "Entrevista agendada en 3 días." },
  { id: "22", name: "Jorge Luis Vega Rangel", phone: "+5214491000122", profile: "p-vendedor", stage: "cv_review", channel: "pandape", days: 4, age: 41, edu: "Secundaria", zone: "Col. San Marcos", commute: 12, exp: 84, salary: 9500, cv: 69, summary: "Siete años vendiendo en tianguis y mostrador. Sin experiencia en telas.", note: "Score 69, umbral 65: pasa. Agendar entrevista." },
  { id: "23", name: "Montserrat Ávila Cruz", phone: "+5214491000123", profile: "p-vendedor", stage: "prefilter", channel: "facebook", days: 1, prefilter: "in_progress", answers: { zone: "Colonia Héroes", experience: "6 meses" }, note: "Experiencia de 6 meses, mínimo 12: Vale va a cerrar con cortesía salvo que se marque excepción." },
  { id: "24", name: "Héctor Solís Barajas", phone: "+5214491000124", profile: "p-vendedor", stage: "new", channel: "prime_pool", days: 1, age: 37, exp: 60, note: "Viene de la bolsa Prime (fue finalista en otra vacante)." },
  { id: "25", name: "Brenda Campos Íñiguez", phone: "+5214491000125", profile: "p-vendedor", stage: "discarded", channel: "facebook", days: 9, discard: { key: "no_response", reason: "Sin respuesta al template en 72 h ni al recordatorio", from: "prefilter", by: "system" } },
  // Supervisor · Telasist (pausada)
  { id: "26", name: "Óscar Mendoza Tapia", phone: "+5214491000126", profile: "p-supervisor", stage: "cv_review", channel: "pandape", days: 20, age: 39, edu: "Ing. Industrial", zone: "Col. Trojes de Alonso", commute: 30, exp: 72, salary: 14000, cv: 74, summary: "Seis años supervisando turnos en maquila.", note: "Vacante pausada por el cliente; candidato en espera." },
];

const profileById = (id: string) => profiles.find((p) => p.id === id)!;
const clientById = (id: string) => clients.find((c) => c.id === id)!;
const aiConfigByProfile = (id: string) => aiConfigs.find((a) => a.profile_id === id) ?? null;

function stagePath(spec: Spec): Stage[] {
  const target = spec.discard ? spec.discard.from : spec.stage;
  const path = STAGES.slice(0, idx(target) + 1);
  return spec.discard ? [...path, "discarded"] : path;
}

function prefilterStatus(spec: Spec): Enums<"prefilter_status"> {
  if (spec.prefilter) return spec.prefilter;
  if (spec.discard?.from === "prefilter") return "failed";
  if (spec.stage === "new") return "pending";
  if (spec.stage === "prefilter") return "in_progress";
  return "passed";
}

function prefilterItems(spec: Spec, questions: PrefilterQuestion[], cfg: AiConfig | null): PrefilterResultItem[] {
  const status = prefilterStatus(spec);
  if (status === "pending") return [];
  return questions
    .map((q): PrefilterResultItem | null => {
      const given = spec.answers?.[q.key];
      let answer = given ?? "";
      let ok = true;
      if (q.key === "zone") { answer ||= spec.zone ?? "Aguascalientes"; ok = (spec.commute ?? 30) <= (cfg?.commute_max_min ?? 60); }
      else if (q.key === "experience") { answer ||= spec.exp ? `${Math.round(spec.exp / 12 * 10) / 10} años` : ""; ok = (spec.exp ?? 0) >= (cfg?.experience_min_months ?? 12); }
      else if (q.key === "saturdays" || q.key === "schedule") { answer ||= "Sí"; ok = answer.toLowerCase().startsWith("s"); }
      else if (q.key === "salary") { answer ||= spec.salary ? String(spec.salary) : ""; ok = !cfg?.salary_expectation_max || (spec.salary ?? 0) <= Number(cfg.salary_expectation_max); }
      else if (q.key === "age") { answer ||= spec.age ? String(spec.age) : ""; ok = !spec.age || ((cfg?.age_min ?? 0) <= spec.age && spec.age <= (cfg?.age_max ?? 99)); }
      else if (q.key === "software") { answer ||= "SolidWorks y AutoCAD"; }
      if (!answer) return null;
      return { criterion: q.text, answer, ok, required: q.key !== "age" };
    })
    .filter((x): x is PrefilterResultItem => x !== null)
    .filter((_, i) => status !== "in_progress" || i < Object.keys(spec.answers ?? {}).length);
}

function cvBreakdown(cv: number, weights: CvWeight[]): CvBreakdownItem[] {
  return weights.map((w, i) => {
    const jitter = ((i * 7) % 5) - 2;
    const score = Math.max(0, Math.min(w.weight, Math.round((w.weight * cv) / 100 + jitter)));
    return { key: w.key, label: w.label, weight: w.weight, score };
  });
}

export const candidates: Candidate[] = [];
export const applications: Application[] = [];
export const stageEvents: StageEvent[] = [];
export const prefilterAnswers: PrefilterAnswer[] = [];

const turns: Record<string, number> = {};

for (const spec of SPECS) {
  const cid = `c-${spec.id}`;
  const team = TEAMS[spec.profile] ?? [];
  const turn = (turns[spec.profile] = (turns[spec.profile] ?? 0) + 1);
  const recruiter = team.length ? team[(turn - 1) % team.length]! : null;
  const aid = `app-${spec.id}`;
  const cfg = aiConfigByProfile(spec.profile);
  const questions = (cfg?.prefilter_questions as PrefilterQuestion[] | null) ?? [];
  const path = stagePath(spec);
  const applied = daysAgo(spec.days, 9);
  const steps = path.length - 1;
  const stepDays = steps > 0 ? spec.days / (steps + 1) : 0;
  const eventAt = (i: number) => (i === 0 ? applied : daysAgo(spec.days - stepDays * i, 9 - i));
  const status = prefilterStatus(spec);
  const items = prefilterItems(spec, questions, cfg);
  const scored = spec.cv !== undefined && (idx(spec.stage) >= idx("cv_review") || spec.discard?.from === "cv_review" || (spec.discard && idx(spec.discard.from) >= idx("cv_review")));

  candidates.push(
    mkCandidate({
      id: cid, full_name: spec.name, phone_e164: spec.phone, email: spec.email ?? null, age_reported: spec.age ?? null, zone: spec.zone ?? null,
      municipality: spec.muni ?? "Aguascalientes", education_level: spec.edu ?? null, cv_summary: spec.summary ?? null, created_at: applied, updated_at: eventAt(steps),
      privacy_consent_at: spec.stage === "new" ? null : applied, in_prime_pool: spec.channel === "prime_pool",
    }),
  );

  applications.push(
    mkApplication({
      id: aid, candidate_id: cid, profile_id: spec.profile, stage: spec.stage, stage_changed_at: eventAt(steps), source_channel: spec.channel, applied_at: applied,
      commute_minutes: spec.commute ?? null, experience_months: spec.exp ?? null, salary_expectation: spec.salary ?? null, available: spec.available ?? (status === "passed" ? true : null),
      prefilter_status: status, prefilter_result: items.length ? items : null,
      cv_score: scored ? spec.cv! : null, cv_score_breakdown: scored ? cvBreakdown(spec.cv!, (cfg?.cv_weights as CvWeight[]) ?? []) : null,
      cv_score_version: scored ? cfg?.version ?? 1 : null, cv_scored_at: scored ? eventAt(Math.min(steps, 2)) : null,
      cv_ai_rationale: scored ? spec.summary ?? null : null, ai_note: spec.note ?? null,
      discard_reason_key: spec.discard?.key ?? null, discard_reason: spec.discard?.reason ?? null, discarded_from_stage: spec.discard?.from ?? null,
      discarded_by: spec.discard?.by ?? null, discarded_by_user_id: spec.discard?.by === "recruiter" ? "u-roberto" : null, discarded_at: spec.discard ? eventAt(steps) : null,
      client_decision: spec.stage === "hired" ? "approve" : null, client_decision_at: spec.stage === "hired" ? eventAt(steps) : null, client_decision_by: spec.stage === "hired" ? "u-veronica" : null,
      hired_at: spec.stage === "hired" ? eventAt(steps) : null, agreed_salary: spec.stage === "hired" ? (spec.salary ?? 0) + 500 : null,
      start_date: spec.stage === "hired" ? dateOnly(inDays(3)) : null,
      confirmation_sheet_path: spec.stage === "hired" ? `${cid}/confirmation/hoja.pdf` : null, assigned_recruiter_id: recruiter, assigned_at: recruiter ? applied : null,
      created_at: applied, updated_at: eventAt(steps),
    }),
  );

  path.forEach((to, i) => {
    const actor: Enums<"actor_type"> = i === 0 ? "system" : to === "discarded" ? spec.discard?.by ?? "recruiter" : to === "hired" ? "client" : to === "cv_review" ? "agent" : "recruiter";
    stageEvents.push(
      mkEvent({
        id: `ev-${spec.id}-${i}`, application_id: aid, from_stage: i === 0 ? null : path[i - 1]!, to_stage: to, actor_type: actor,
        actor_user_id: actor === "recruiter" ? "u-roberto" : actor === "client" ? "u-veronica" : null,
        reason: to === "discarded" ? spec.discard?.reason ?? null : to === "hired" ? "Vo.Bo. del cliente" : to === "cv_review" ? "Prefiltro aprobado" : null,
        created_at: eventAt(i),
      }),
    );
  });

  items.forEach((item, i) => {
    const q = questions[i];
    if (!q) return;
    prefilterAnswers.push({
      id: `pa-${spec.id}-${q.key}`, application_id: aid, question_key: q.key, question_text: q.text, answer_raw: item.answer, answer_parsed: { value: item.answer },
      passes: item.ok, rule_snapshot: { rule_key: q.rule_key }, answered_at: eventAt(1),
    });
  });
}

// ---------------------------------------------------------------------------
// Entrevistas
// ---------------------------------------------------------------------------
const F_OK = (criterion: string, evidence: string, quote: string, at: string): InterviewFinding => ({ criterion, ok: true, evidence, quote, at });
const F_NO = (criterion: string, evidence: string, quote: string, at: string): InterviewFinding => ({ criterion, ok: false, evidence, quote, at });

export const interviews: Interview[] = [
  mkInterview({ id: "iv-01p", application_id: "app-01", type: "prime", status: "analyzed", scheduled_at: daysAgo(24, 3), score: 86, summary: "Candidata con experiencia directa y métricas claras. Comunica con seguridad, negocia con estructura. Riesgo bajo.", findings: [F_OK("Experiencia en cobranza", "Tres años en financiera con cartera de 400 cuentas", "Cerraba el mes con 82% de recuperación en cartera de 30 a 60 días", "04:12"), F_OK("Negociación", "Explica método de convenio en tres pasos", "Primero escucho por qué dejó de pagar, luego propongo dos opciones", "11:40"), F_OK("Disponibilidad sábados", "Sin restricción", "Los sábados no tengo problema, ya trabajaba así", "19:05")], analyzed_at: daysAgo(23), analysis_version: "interview-v1", fireflies_meeting_id: "ff-01" }),
  mkInterview({ id: "iv-01c", application_id: "app-01", type: "client", status: "recorded", scheduled_at: daysAgo(6, 2), client_interviewer_name: "Verónica Salas", meeting_url: "https://teams.microsoft.com/l/meetup-join/tel-asis-t01", interviewer_user_id: null }),
  mkInterview({ id: "iv-02p", application_id: "app-02", type: "prime", status: "analyzed", scheduled_at: daysAgo(14, 4), score: 82, summary: "Perfil de campo con buena actitud. Excel limitado; requiere capacitación en CRM.", findings: [F_OK("Experiencia en cobranza", "Dos años en arrendadora, visitas diarias", "Salía a visitar entre 8 y 10 clientes al día", "03:30"), F_NO("Sistemas", "No ha usado CRM ni Excel más allá de capturas", "Excel lo básico, sumas y así", "14:10"), F_OK("Tolerancia a la presión", "Relata cierres de mes con meta cumplida", "Los últimos tres días del mes eran los más pesados y ahí se sacaba la meta", "21:55")], analyzed_at: daysAgo(13), fireflies_meeting_id: "ff-02" }),
  mkInterview({ id: "iv-02c", application_id: "app-02", type: "client", status: "scheduled", scheduled_at: inDays(4, 2), client_interviewer_name: "Verónica Salas", meeting_url: "https://teams.microsoft.com/l/meetup-join/tel-asis-t02", interviewer_user_id: null }),
  mkInterview({ id: "iv-03p", application_id: "app-03", type: "prime", status: "analyzed", scheduled_at: daysAgo(11, 1), score: 79, summary: "Buen desempeño telefónico. Menos experiencia en campo; abierta a aprender.", findings: [F_OK("Experiencia en cobranza", "Call center bancario, cartera preventiva", "Manejaba 120 llamadas al día con 90% de contacto", "05:02"), F_OK("Actitud", "Motivación clara por crecer a campo", "Quiero salir a campo, en el call center ya toqué techo", "16:40")], analyzed_at: daysAgo(10), fireflies_meeting_id: "ff-03", interviewer_user_id: "u-lucia", calendar_owner_id: "u-lucia" }),
  mkInterview({ id: "iv-04p", application_id: "app-04", type: "prime", status: "analyzed", scheduled_at: daysAgo(6, 5), score: 74, summary: "Experiencia amplia en cobranza extrajudicial. Comunicación directa, a veces brusca. Buen candidato para cartera difícil.", findings: [F_OK("Experiencia en cobranza", "Cinco años, cartera vencida mayor a 90 días", "Me tocaba la cartera que nadie quería", "02:50"), F_NO("Trato al cliente", "Lenguaje confrontativo en ejemplos", "A veces hay que ponerse duro para que paguen", "12:33")], analyzed_at: daysAgo(5), fireflies_meeting_id: "ff-04" }),
  mkInterview({ id: "iv-05p", application_id: "app-05", type: "prime", status: "confirmed", scheduled_at: inDays(1, 2), calendar_event_id: "gcal-05" }),
  mkInterview({ id: "iv-13p", application_id: "app-13", type: "prime", status: "analyzed", scheduled_at: daysAgo(36, 2), score: 92, summary: "Dominio técnico sobresaliente y portafolio con producto en mercado. Comunicación clara.", findings: [F_OK("SolidWorks", "Describe flujo completo: modelado, ensamble, planos", "Trabajo con configuraciones para variantes del mismo producto", "06:15"), F_OK("Fichas técnicas", "Ha documentado para producción en serie", "Mis fichas las usaba directo la línea sin preguntar", "13:02"), F_OK("Trabajo con producción", "Ejemplos de ajustes por factibilidad", "Cambié un radio porque el molde no lo daba", "20:11")], analyzed_at: daysAgo(35), fireflies_meeting_id: "ff-13", interviewer_user_id: "u-lucia", calendar_owner_id: "u-lucia" }),
  mkInterview({ id: "iv-13c", application_id: "app-13", type: "client", status: "recorded", scheduled_at: daysAgo(12, 3), client_interviewer_name: "Verónica Salas y Gerente de desarrollo", interviewer_user_id: null }),
  mkInterview({ id: "iv-14p", application_id: "app-14", type: "prime", status: "analyzed", scheduled_at: daysAgo(17, 1), score: 88, summary: "Muy sólido técnicamente. Expectativa salarial en el tope del rango.", findings: [F_OK("SolidWorks", "Cinco años en mobiliario, ensambles complejos", "Manejo weldments y chapa metálica todos los días", "04:44"), F_NO("Expectativa salarial", "Pide $20,000, tope del rango", "Menos de veinte no me conviene por lo que gano ahora", "24:30")], analyzed_at: daysAgo(16), fireflies_meeting_id: "ff-14" }),
  mkInterview({ id: "iv-14c", application_id: "app-14", type: "client", status: "scheduled", scheduled_at: inDays(2, 5), client_interviewer_name: "Verónica Salas", interviewer_user_id: null }),
  mkInterview({ id: "iv-15p", application_id: "app-15", type: "prime", status: "analyzed", scheduled_at: daysAgo(12, 6), score: 80, summary: "Buena base técnica, portafolio corto. Actitud de aprendizaje.", findings: [F_OK("SolidWorks", "Uso diario en empaque", "Diseñaba cajas y exhibidores en SolidWorks", "05:10"), F_NO("Portafolio", "Pocas piezas de producto final", "Casi todo lo que hice es empaque, producto poco", "15:22")], analyzed_at: daysAgo(11), fireflies_meeting_id: "ff-15", interviewer_user_id: "u-lucia", calendar_owner_id: "u-lucia" }),
  mkInterview({ id: "iv-16p", application_id: "app-16", type: "prime", status: "confirmed", scheduled_at: inDays(2, 7), interviewer_user_id: "u-lucia", calendar_owner_id: "u-lucia", calendar_event_id: "gcal-16" }),
  mkInterview({ id: "iv-19p", application_id: "app-19", type: "prime", status: "analyzed", scheduled_at: daysAgo(9, 2), score: 55, summary: "Perfil de diseño gráfico. No demuestra experiencia en modelado 3D de producto.", findings: [F_NO("SolidWorks", "Solo cursos, sin uso laboral", "Lo vi en la carrera pero en el trabajo uso Illustrator", "07:05"), F_OK("Comunicación", "Clara y ordenada", "", "")], analyzed_at: daysAgo(8), fireflies_meeting_id: "ff-19" }),
  mkInterview({ id: "iv-20p", application_id: "app-20", type: "prime", status: "analyzed", scheduled_at: daysAgo(4, 3), score: 75, summary: "Vendedor experimentado en mostrador; sin experiencia en telas pero con actitud de servicio.", findings: [F_OK("Ventas de mostrador", "Cuatro años en ferretería con meta mensual", "Siempre andaba arriba de la meta", "03:00"), F_NO("Conocimiento de telas", "Ninguno", "De telas no sé, pero aprendo rápido", "10:15")], analyzed_at: daysAgo(3), fireflies_meeting_id: "ff-20" }),
  mkInterview({ id: "iv-21p", application_id: "app-21", type: "prime", status: "scheduled", scheduled_at: inDays(3, 1), calendar_event_id: "gcal-21" }),
];

// ---------------------------------------------------------------------------
// Psicométricos
// ---------------------------------------------------------------------------
function fitRows(pairs: [string, number, number, boolean?][]): PsychFitRow[] {
  return pairs.map(([scale, min, score, blocking]) => ({ scale, min, score, ok: score >= min, blocking: !!blocking }));
}
const PARSED = (iq: number, level: string, high: string[], low: string[]) => ({ iq, iq_level: level, coleibor: [{ scale: "Tolerancia a la presión", score: 72 }, { scale: "Persuasión", score: 68 }], cibain_high: high, cibain_low: low, inceval: { trust: 78, honesty: 82, ethics: 80 }, cacter: "Colérico-sanguíneo", ciesman_low: [] });

export const psychTests: PsychTest[] = [
  mkPsych({ id: "ps-01", application_id: "app-01", status: "parsed", sent_at: daysAgo(22), completed_at: daysAgo(20), report_file_path: "c-01/psych/reporte.pdf", parsed: PARSED(108, "Promedio alto", ["Persistencia", "Sociabilidad"], ["Impulsividad"]), fit_rows: fitRows([["Tolerancia a la presión", 60, 74, true], ["Persuasión", 55, 71], ["Honestidad", 70, 82]]), fit_pct: 84, verdict: "fit", parsed_at: daysAgo(20) }),
  mkPsych({ id: "ps-02", application_id: "app-02", status: "parsed", sent_at: daysAgo(12), completed_at: daysAgo(10), report_file_path: "c-02/psych/reporte.pdf", parsed: PARSED(101, "Promedio", ["Energía", "Persistencia"], ["Orden"]), fit_rows: fitRows([["Tolerancia a la presión", 60, 69, true], ["Persuasión", 55, 64], ["Honestidad", 70, 76]]), fit_pct: 78, verdict: "fit", parsed_at: daysAgo(10) }),
  mkPsych({ id: "ps-03", application_id: "app-03", status: "parsed", sent_at: daysAgo(9), completed_at: daysAgo(7), report_file_path: "c-03/psych/reporte.pdf", parsed: PARSED(104, "Promedio", ["Sociabilidad"], ["Tolerancia a la presión"]), fit_rows: fitRows([["Tolerancia a la presión", 60, 52, true], ["Persuasión", 55, 66], ["Honestidad", 70, 79]]), fit_pct: 66, verdict: "fit_with_reservations", parsed_at: daysAgo(7) }),
  mkPsych({ id: "ps-04", application_id: "app-04", status: "sent", sent_at: daysAgo(4), reminder_sent_at: daysAgo(1), due_at: inDays(1) }),
  mkPsych({ id: "ps-13", application_id: "app-13", status: "parsed", sent_at: daysAgo(33), completed_at: daysAgo(31), report_file_path: "c-13/psych/reporte.pdf", parsed: PARSED(118, "Superior", ["Creatividad", "Orden"], []), fit_rows: fitRows([["Creatividad", 60, 81], ["Atención al detalle", 60, 88], ["Trabajo en equipo", 50, 70]]), fit_pct: 90, verdict: "fit", parsed_at: daysAgo(31) }),
  mkPsych({ id: "ps-14", application_id: "app-14", status: "parsed", sent_at: daysAgo(15), completed_at: daysAgo(13), report_file_path: "c-14/psych/reporte.pdf", parsed: PARSED(112, "Promedio alto", ["Orden", "Persistencia"], ["Sociabilidad"]), fit_rows: fitRows([["Creatividad", 60, 66], ["Atención al detalle", 60, 90], ["Trabajo en equipo", 50, 58]]), fit_pct: 82, verdict: "fit", parsed_at: daysAgo(13) }),
  mkPsych({ id: "ps-15", application_id: "app-15", status: "parsed", sent_at: daysAgo(10), completed_at: daysAgo(8), report_file_path: "c-15/psych/reporte.pdf", parsed: PARSED(106, "Promedio", ["Creatividad"], ["Persistencia"]), fit_rows: fitRows([["Creatividad", 60, 79], ["Atención al detalle", 60, 63], ["Trabajo en equipo", 50, 72]]), fit_pct: 75, verdict: "fit", parsed_at: daysAgo(8) }),
  mkPsych({ id: "ps-20", application_id: "app-20", status: "sent", sent_at: daysAgo(1), due_at: inDays(3) }),
];

// ---------------------------------------------------------------------------
// Expediente
// ---------------------------------------------------------------------------
export const documentTypes: DocumentType[] = [
  { key: "ine", label: "INE (frente y reverso)", required: true, sort_order: 10, accepts: ["image", "pdf"], validation_hints: "Vigente, legible, nombre coincide" },
  { key: "curp", label: "CURP", required: true, sort_order: 20, accepts: ["image", "pdf"], validation_hints: "18 caracteres, nombre y fecha coinciden" },
  { key: "rfc", label: "Constancia de situación fiscal", required: true, sort_order: 30, accepts: ["image", "pdf"], validation_hints: "RFC con homoclave, emitida por el SAT" },
  { key: "nss", label: "Número de seguridad social (NSS)", required: true, sort_order: 40, accepts: ["image", "pdf"], validation_hints: "11 dígitos, documento del IMSS" },
  { key: "comprobante_domicilio", label: "Comprobante de domicilio", required: true, sort_order: 50, accepts: ["image", "pdf"], validation_hints: "No mayor a 3 meses" },
  { key: "acta_nacimiento", label: "Acta de nacimiento", required: true, sort_order: 60, accepts: ["image", "pdf"], validation_hints: "Nombre y fecha coinciden con CURP" },
  { key: "comprobante_estudios", label: "Comprobante de estudios", required: true, sort_order: 70, accepts: ["image", "pdf"], validation_hints: "Certificado, título o cédula" },
  { key: "carta_recomendacion_1", label: "Carta de recomendación 1", required: true, sort_order: 80, accepts: ["image", "pdf"], validation_hints: "Con nombre, teléfono y firma" },
  { key: "carta_recomendacion_2", label: "Carta de recomendación 2", required: true, sort_order: 90, accepts: ["image", "pdf"], validation_hints: "Con nombre, teléfono y firma" },
  { key: "fotografia", label: "Fotografía reciente", required: true, sort_order: 100, accepts: ["image"], validation_hints: "Fondo claro, rostro visible" },
];

const DOC_KEYS = documentTypes.map((d) => d.key);
function docsFor(cid: string, aid: string, validated: number, received = 0, inReview = 0, rejected: string[] = []): CandidateDocument[] {
  const out: CandidateDocument[] = [];
  DOC_KEYS.forEach((key, i) => {
    const status: Enums<"doc_status"> | null = i < validated ? "validated" : i < validated + received ? "received" : i < validated + received + inReview ? "in_review" : null;
    if (status) out.push(mkDoc({ id: `doc-${aid}-${key}`, candidate_id: cid, application_id: aid, document_type_key: key, status, validated_by: status === "validated" ? "u-roberto" : null, validated_at: status === "validated" ? daysAgo(2 + i) : null, ai_check: status === "in_review" ? { legible: false, name_matches: true, issues: ["Imagen borrosa en la esquina inferior"] } : { legible: true, name_matches: true, issues: [] } }));
  });
  rejected.forEach((key) => out.push(mkDoc({ id: `doc-${aid}-${key}-rej`, candidate_id: cid, application_id: aid, document_type_key: key, status: "rejected", rejected_reason: "Documento vencido", validated_by: null, validated_at: null, ai_check: { legible: true, name_matches: true, issues: ["Vigencia expirada"] }, created_at: daysAgo(6) })));
  return out;
}

export const candidateDocuments: CandidateDocument[] = [
  ...docsFor("c-01", "app-01", 10),
  ...docsFor("c-02", "app-02", 10),
  ...docsFor("c-03", "app-03", 7, 0, 1, ["comprobante_domicilio"]),
  ...docsFor("c-13", "app-13", 10),
  ...docsFor("c-14", "app-14", 10),
  ...docsFor("c-15", "app-15", 5, 2, 0),
];

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------
export const waConversations: WaConversation[] = [
  mkConv({ id: "wa-07", candidate_id: "c-07", application_id: "app-07", phone_e164: "+5214491000107", flow: "prefilter", flow_state: { question_index: 2, awaiting: "saturdays", retries: 0 }, last_inbound_at: daysAgo(0, 1), last_outbound_at: daysAgo(0, 1) }),
  mkConv({ id: "wa-08", candidate_id: "c-08", application_id: "app-08", phone_e164: "+5214491000108", flow: "prefilter", flow_state: { question_index: 5, awaiting: "recruiter" }, status: "handoff", ai_paused: true, paused_by: "u-roberto", last_inbound_at: daysAgo(1, 2) }),
  mkConv({ id: "wa-03", candidate_id: "c-03", application_id: "app-03", phone_e164: "+5214491000103", flow: "documents", flow_state: { awaiting: "comprobante_estudios" }, last_inbound_at: daysAgo(0, 5), last_outbound_at: daysAgo(0, 4) }),
  mkConv({ id: "wa-04", candidate_id: "c-04", application_id: "app-04", phone_e164: "+5214491000104", flow: "psychometric", flow_state: { awaiting: "psych_completed" }, last_inbound_at: daysAgo(4), last_outbound_at: daysAgo(1), window_expires_at: daysAgo(3) }),
  mkConv({ id: "wa-18", candidate_id: "c-18", application_id: "app-18", phone_e164: "+5214491000118", flow: "prefilter", flow_state: { question_index: 1, awaiting: "software" }, last_inbound_at: daysAgo(0, 3) }),
  mkConv({ id: "wa-23", candidate_id: "c-23", application_id: "app-23", phone_e164: "+5214491000123", flow: "prefilter", flow_state: { question_index: 2, awaiting: "schedule" }, last_inbound_at: daysAgo(0, 6) }),
  mkConv({ id: "wa-09", candidate_id: "c-09", application_id: "app-09", phone_e164: "+5214491000109", flow: "prefilter", flow_state: { question_index: 0 }, last_inbound_at: null, last_outbound_at: daysAgo(0, 2), window_expires_at: null }),
];

export const waMessages: WaMessage[] = [
  mkMsg({ id: "m-07-1", conversation_id: "wa-07", direction: "outbound", type: "template", body: "Hola Paola, soy Vale de Prime HR Innovation. Vimos tu postulación a Ejecutivo de cobranza en Telasist. Para avanzar te haré 5 preguntas rápidas. Tus datos se tratan conforme a nuestro aviso de privacidad: prime.mx/privacidad. ¿Empezamos?", created_at: daysAgo(3, 2) }),
  mkMsg({ id: "m-07-2", conversation_id: "wa-07", direction: "inbound", body: "Hola sí claro", created_at: daysAgo(3, 1) }),
  mkMsg({ id: "m-07-3", conversation_id: "wa-07", direction: "outbound", body: "Perfecto. ¿En qué colonia o municipio vives?", created_at: daysAgo(3, 1) }),
  mkMsg({ id: "m-07-4", conversation_id: "wa-07", direction: "inbound", body: "Colonia Guadalupe, cerca del mercado", created_at: daysAgo(2, 20) }),
  mkMsg({ id: "m-07-5", conversation_id: "wa-07", direction: "outbound", body: "Gracias. ¿Cuánto tiempo tienes de experiencia en cobranza?", created_at: daysAgo(2, 20) }),
  mkMsg({ id: "m-07-6", conversation_id: "wa-07", direction: "inbound", body: "Un año en cobranza en Coppel, en piso y por teléfono", created_at: daysAgo(0, 1) }),
  mkMsg({ id: "m-07-7", conversation_id: "wa-07", direction: "outbound", type: "interactive", body: "Muy bien. El puesto trabaja sábados de 9:00 a 13:00, ¿tienes disponibilidad?", interactive_payload: { buttons: [{ id: "yes", title: "Sí" }, { id: "no", title: "No" }] }, created_at: daysAgo(0, 1) }),
  mkMsg({ id: "m-08-1", conversation_id: "wa-08", direction: "outbound", type: "template", body: "Hola Luis Fernando, soy Vale de Prime HR Innovation. Vimos tu postulación a Ejecutivo de cobranza en Telasist. ¿Te hago unas preguntas rápidas?", created_at: daysAgo(2, 3) }),
  mkMsg({ id: "m-08-2", conversation_id: "wa-08", direction: "inbound", body: "Adelante", created_at: daysAgo(2, 2) }),
  mkMsg({ id: "m-08-3", conversation_id: "wa-08", direction: "outbound", body: "¿En qué colonia o municipio vives?", created_at: daysAgo(2, 2) }),
  mkMsg({ id: "m-08-4", conversation_id: "wa-08", direction: "inbound", body: "Circunvalación Norte", created_at: daysAgo(2, 1) }),
  mkMsg({ id: "m-08-5", conversation_id: "wa-08", direction: "outbound", body: "¿Cuánto tiempo tienes de experiencia en cobranza?", created_at: daysAgo(2, 1) }),
  mkMsg({ id: "m-08-6", conversation_id: "wa-08", direction: "inbound", body: "8 años, los últimos 3 en Elektra", created_at: daysAgo(1, 23) }),
  mkMsg({ id: "m-08-7", conversation_id: "wa-08", direction: "outbound", body: "El puesto trabaja sábados de 9:00 a 13:00, ¿tienes disponibilidad?", created_at: daysAgo(1, 23) }),
  mkMsg({ id: "m-08-8", conversation_id: "wa-08", direction: "inbound", body: "Sí", created_at: daysAgo(1, 22) }),
  mkMsg({ id: "m-08-9", conversation_id: "wa-08", direction: "outbound", body: "¿Cuál es tu expectativa de sueldo mensual?", created_at: daysAgo(1, 22) }),
  mkMsg({ id: "m-08-10", conversation_id: "wa-08", direction: "inbound", body: "10,500 libres", created_at: daysAgo(1, 21) }),
  mkMsg({ id: "m-08-11", conversation_id: "wa-08", direction: "outbound", body: "Última: ¿qué edad tienes?", created_at: daysAgo(1, 21) }),
  mkMsg({ id: "m-08-12", conversation_id: "wa-08", direction: "inbound", body: "47", created_at: daysAgo(1, 2) }),
  mkMsg({ id: "m-08-13", conversation_id: "wa-08", direction: "outbound", body: "Gracias, Luis Fernando. Ya tengo tu información; un reclutador la revisa y te escribimos hoy mismo.", created_at: daysAgo(1, 2) }),
  mkMsg({ id: "m-03-1", conversation_id: "wa-03", direction: "outbound", type: "template", body: "Daniela, ¡felicidades! Pasaste el psicométrico. Para armar tu expediente te iré pidiendo 10 documentos. Puedes mandarlos en foto o PDF. Empecemos con tu INE por ambos lados.", created_at: daysAgo(5, 2) }),
  mkMsg({ id: "m-03-2", conversation_id: "wa-03", direction: "inbound", type: "image", body: null, media_path: "wa-media/c-03/ine-frente.jpg", media_mime: "image/jpeg", created_at: daysAgo(5, 1) }),
  mkMsg({ id: "m-03-3", conversation_id: "wa-03", direction: "inbound", type: "image", body: null, media_path: "wa-media/c-03/ine-reverso.jpg", media_mime: "image/jpeg", created_at: daysAgo(5, 1) }),
  mkMsg({ id: "m-03-4", conversation_id: "wa-03", direction: "outbound", body: "Recibido y legible. Ahora tu CURP.", created_at: daysAgo(5, 1) }),
  mkMsg({ id: "m-03-5", conversation_id: "wa-03", direction: "inbound", type: "document", body: null, media_path: "wa-media/c-03/curp.pdf", media_mime: "application/pdf", created_at: daysAgo(4, 20) }),
  mkMsg({ id: "m-03-6", conversation_id: "wa-03", direction: "outbound", body: "Perfecto. Tu comprobante de domicilio venció el mes pasado; ¿me mandas uno de los últimos 3 meses?", created_at: daysAgo(1, 4) }),
  mkMsg({ id: "m-03-7", conversation_id: "wa-03", direction: "inbound", body: "Sí, mañana lo saco del CFE", created_at: daysAgo(0, 5) }),
  mkMsg({ id: "m-03-8", conversation_id: "wa-03", direction: "outbound", body: "Gracias. Mientras, ¿me mandas tu comprobante de estudios?", created_at: daysAgo(0, 4) }),
  mkMsg({ id: "m-04-1", conversation_id: "wa-04", direction: "outbound", type: "template", body: "José Carlos, este es tu enlace para la evaluación psicométrica: https://psicotest.mx/e/8f2a. Tienes hasta el viernes. Dura unos 45 minutos.", created_at: daysAgo(4) }),
  mkMsg({ id: "m-04-2", conversation_id: "wa-04", direction: "inbound", body: "Ok lo hago hoy en la noche", created_at: daysAgo(4) }),
  mkMsg({ id: "m-04-3", conversation_id: "wa-04", direction: "outbound", type: "template", body: "Hola José Carlos, te recordamos que tu evaluación psicométrica vence mañana. Aquí el enlace: https://psicotest.mx/e/8f2a", created_at: daysAgo(1) }),
  mkMsg({ id: "m-09-1", conversation_id: "wa-09", direction: "outbound", type: "template", body: "Hola Mariana, soy Vale de Prime HR Innovation. Vimos tu postulación a Ejecutivo de cobranza en Telasist. ¿Te hago unas preguntas rápidas?", status: "delivered", created_at: daysAgo(0, 2) }),
  mkMsg({ id: "m-18-1", conversation_id: "wa-18", direction: "outbound", type: "template", body: "Hola Iván, soy Vale de Prime HR Innovation. Vimos tu perfil para Diseñador industrial en Telasist. ¿Te hago unas preguntas rápidas?", created_at: daysAgo(1, 5) }),
  mkMsg({ id: "m-18-2", conversation_id: "wa-18", direction: "inbound", body: "Va", created_at: daysAgo(0, 3) }),
  mkMsg({ id: "m-18-3", conversation_id: "wa-18", direction: "outbound", body: "¿En qué colonia o municipio vives?", created_at: daysAgo(0, 3) }),
  mkMsg({ id: "m-18-4", conversation_id: "wa-18", direction: "inbound", body: "Colonia del Valle", created_at: daysAgo(0, 3) }),
  mkMsg({ id: "m-18-5", conversation_id: "wa-18", direction: "outbound", body: "¿Qué software de diseño dominas?", created_at: daysAgo(0, 3) }),
  mkMsg({ id: "m-23-1", conversation_id: "wa-23", direction: "outbound", type: "template", body: "Hola Montserrat, soy Vale de Prime HR Innovation. Vimos tu postulación a Vendedor de piso en Telas Bayón. ¿Te hago unas preguntas rápidas?", created_at: daysAgo(1, 2) }),
  mkMsg({ id: "m-23-2", conversation_id: "wa-23", direction: "inbound", body: "Sí", created_at: daysAgo(0, 7) }),
  mkMsg({ id: "m-23-3", conversation_id: "wa-23", direction: "outbound", body: "¿En qué colonia vives?", created_at: daysAgo(0, 7) }),
  mkMsg({ id: "m-23-4", conversation_id: "wa-23", direction: "inbound", body: "Héroes", created_at: daysAgo(0, 6) }),
  mkMsg({ id: "m-23-5", conversation_id: "wa-23", direction: "outbound", body: "¿Cuánto tiempo has trabajado en ventas de mostrador?", created_at: daysAgo(0, 6) }),
  mkMsg({ id: "m-23-6", conversation_id: "wa-23", direction: "inbound", body: "Como 6 meses en una papelería", created_at: daysAgo(0, 6) }),
];

export const waTemplates: WaTemplate[] = [
  { id: "t-1", name: "prime_primer_contacto", language: "es_MX", purpose: "first_contact", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "job_title" }], meta_status: "approved", is_active: true, created_at: daysAgo(40), updated_at: daysAgo(30) },
  { id: "t-2", name: "prime_confirmacion_entrevista", language: "es_MX", purpose: "interview_confirm", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "job_title" }, { position: 3, key: "datetime" }, { position: 4, key: "link" }], meta_status: "approved", is_active: true, created_at: daysAgo(40), updated_at: daysAgo(30) },
  { id: "t-3", name: "prime_enlace_psicometrico", language: "es_MX", purpose: "psych_link", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "link" }, { position: 3, key: "due_date" }], meta_status: "approved", is_active: true, created_at: daysAgo(40), updated_at: daysAgo(28) },
  { id: "t-4", name: "prime_recordatorio", language: "es_MX", purpose: "reminder", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "pending_item" }], meta_status: "approved", is_active: true, created_at: daysAgo(40), updated_at: daysAgo(28) },
  { id: "t-5", name: "prime_solicitud_documentos", language: "es_MX", purpose: "docs_request", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "document_label" }], meta_status: "pending", is_active: false, created_at: daysAgo(12), updated_at: daysAgo(12) },
  { id: "t-6", name: "prime_cierre_cortes", language: "es_MX", purpose: "courtesy_close", variables: [{ position: 1, key: "first_name" }, { position: 2, key: "job_title" }], meta_status: "rejected", is_active: false, created_at: daysAgo(40), updated_at: daysAgo(35) },
];

// ---------------------------------------------------------------------------
// Reportes e inteligencia
// ---------------------------------------------------------------------------
export const reportRuns: ReportRun[] = [
  { id: "r-1", type: "daily_internal", client_id: null, period_start: daysAgo(1, 18), period_end: daysAgo(0, 18), recipients: ["admin@prime.com", "reclutador@prime.com"], subject: "Resumen diario · 26 candidatos activos, 3 pendientes", html_path: "reports/daily-internal/r-1.html", pdf_path: null, sent_at: daysAgo(0, 18), status: "sent", error: null, resend_message_id: "re_1", created_at: daysAgo(0, 18) },
  { id: "r-2", type: "daily_client", client_id: IDS.telasist, period_start: daysAgo(1, 18), period_end: daysAgo(0, 18), recipients: ["cliente@prime.com"], subject: "Telasist · Candidatos que avanzaron hoy", html_path: "reports/daily-client/r-2.html", pdf_path: null, sent_at: daysAgo(0, 18), status: "sent", error: null, resend_message_id: "re_2", created_at: daysAgo(0, 18) },
  { id: "r-3", type: "weekly_client", client_id: IDS.telasist, period_start: daysAgo(11), period_end: daysAgo(4), recipients: ["cliente@prime.com", "direccion@telasist.mx"], subject: "Telasist · Reporte semanal de reclutamiento", html_path: "reports/weekly-client/r-3.html", pdf_path: "reports/weekly-client/r-3.pdf", sent_at: daysAgo(4, 9), status: "sent", error: null, resend_message_id: "re_3", created_at: daysAgo(4, 9) },
  { id: "r-4", type: "weekly_client", client_id: IDS.telasist, period_start: daysAgo(18), period_end: daysAgo(11), recipients: ["cliente@prime.com"], subject: "Telasist · Reporte semanal de reclutamiento", html_path: "reports/weekly-client/r-4.html", pdf_path: "reports/weekly-client/r-4.pdf", sent_at: daysAgo(11, 9), status: "sent", error: null, resend_message_id: "re_4", created_at: daysAgo(11, 9) },
  { id: "r-5", type: "weekly_client", client_id: IDS.bayon, period_start: daysAgo(8), period_end: daysAgo(1), recipients: ["rh@telasbayon.mx"], subject: "Telas Bayón · Reporte semanal de reclutamiento", html_path: "reports/weekly-client/r-5.html", pdf_path: "reports/weekly-client/r-5.pdf", sent_at: daysAgo(1, 9), status: "sent", error: null, resend_message_id: "re_5", created_at: daysAgo(1, 9) },
  { id: "r-6", type: "daily_client", client_id: IDS.bayon, period_start: daysAgo(1, 18), period_end: daysAgo(0, 18), recipients: ["rh@telasbayon.mx"], subject: "Telas Bayón · Candidatos que avanzaron hoy", html_path: null, pdf_path: null, sent_at: null, status: "failed", error: "Resend: dominio no verificado", resend_message_id: null, created_at: daysAgo(0, 18) },
];

export const aiInsights: AiInsight[] = [
  { id: "ai-1", client_id: null, week_start: dateOnly(daysAgo(2)), ai_run_id: null, created_at: daysAgo(2), items: [
    { title: "El traslado descarta más que el sueldo", detail: "En Cobranza, 2 de 3 descartes en prefiltro fueron por tiempo de traslado. Vale la pena publicar con la zona explícita en Pandape.", metric: "67% de descartes", severity: "warning" },
    { title: "LinkedIn trae los mejores CV en Diseño", detail: "Los 4 candidatos que superaron el umbral de CV llegaron por LinkedIn; Pandape aportó 1 de 3.", metric: "Score promedio 84 vs 72", severity: "good" },
    { title: "El psicométrico se vuelve cuello de botella", detail: "Tiempo mediano en Psicométrico: 4.5 días. El recordatorio a las 12 h no bastó en 2 casos; probar segundo recordatorio a las 48 h.", metric: "4.5 d mediana", severity: "warning" },
    { title: "Entrevistas Prime con buen rendimiento", detail: "8 de 9 entrevistas analizadas pasaron a psicométrico. El criterio que más falla es Sistemas (Excel y CRM).", metric: "89% avanzan", severity: "info" },
  ] },
  { id: "ai-2", client_id: IDS.telasist, week_start: dateOnly(daysAgo(2)), ai_run_id: null, created_at: daysAgo(2), items: [
    { title: "Cobranza: ajustar el rango de edad", detail: "Un candidato fuerte (8 años de experiencia) quedó en excepción por edad. Con la regla en modo alerta, conviene acordar con Telasist el criterio.", severity: "warning" },
    { title: "Diseño industrial: pipeline sano", detail: "Una contratación y un finalista en entrevista con cliente. Si Telasist abre segunda posición, hay banca.", severity: "good" },
  ] },
];

// ---------------------------------------------------------------------------
// Derivados: vistas
// ---------------------------------------------------------------------------
function clientVisible(stage: Stage, from: Stage | null): boolean {
  if (stage === "discarded") return !!from && ["psychometric", "documents", "client_interview"].includes(from);
  return ["psychometric", "documents", "client_interview", "hired"].includes(stage);
}

const latest = <T extends { created_at: string }>(rows: T[]) => rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
const latestScheduled = (rows: Interview[]) => rows.filter((i) => i.status !== "cancelled").sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))[0] ?? null;

function toPipelineRow(a: Application): PipelineRow {
  const c = candidates.find((x) => x.id === a.candidate_id)!;
  const p = profileById(a.profile_id);
  const cl = clientById(p.client_id);
  const cfg = aiConfigByProfile(p.id);
  const ivs = interviews.filter((i) => i.application_id === a.id);
  const pi = latestScheduled(ivs.filter((i) => i.type === "prime"));
  const ci = latestScheduled(ivs.filter((i) => i.type === "client"));
  const ps = latest(psychTests.filter((t) => t.application_id === a.id));
  const docs = candidateDocuments.filter((d) => d.candidate_id === c.id && d.status !== "rejected");
  const wc = waConversations.filter((w) => w.candidate_id === c.id).sort((x, y) => (y.application_id === a.id ? 1 : 0) - (x.application_id === a.id ? 1 : 0))[0] ?? null;
  return {
    application_id: a.id, candidate_id: c.id, profile_id: p.id, client_id: cl.id, client_name: cl.name, profile_title: p.title,
    full_name: c.full_name, first_name: c.first_name, phone_e164: c.phone_e164, email: c.email, zone: c.zone, municipality: c.municipality, age_reported: c.age_reported,
    education_level: c.education_level, cv_file_path: c.cv_file_path, stage: a.stage, stage_order: idx(a.stage) + 1, stage_changed_at: a.stage_changed_at, applied_at: a.applied_at,
    source_channel: a.source_channel, prefilter_status: a.prefilter_status, cv_score: a.cv_score, cv_threshold: cfg?.cv_threshold ?? null, commute_minutes: a.commute_minutes,
    experience_months: a.experience_months, salary_expectation: a.salary_expectation, available: a.available, ai_note: a.ai_note, discard_reason_key: a.discard_reason_key,
    discard_reason: a.discard_reason, discarded_from_stage: a.discarded_from_stage, client_decision: a.client_decision, hired_at: a.hired_at,
    days_in_stage: Math.max(0, Math.floor((NOW - new Date(a.stage_changed_at).getTime()) / D)),
    prime_interview_id: pi?.id ?? null, prime_interview_status: pi?.status ?? null, prime_interview_at: pi?.scheduled_at ?? null, prime_interview_score: pi?.score ?? null,
    client_interview_id: ci?.id ?? null, client_interview_status: ci?.status ?? null, client_interview_at: ci?.scheduled_at ?? null,
    psych_status: ps?.status ?? null, psych_verdict: ps?.verdict ?? null, psych_fit_pct: ps?.fit_pct ?? null,
    docs_validated: docs.filter((d) => d.status === "validated").length, docs_in_review: docs.filter((d) => d.status === "received" || d.status === "in_review").length,
    docs_required: documentTypes.filter((d) => d.required).length, wa_ai_paused: wc?.ai_paused ?? null, wa_status: wc?.status ?? null, wa_last_inbound_at: wc?.last_inbound_at ?? null,
    assigned_recruiter_id: a.assigned_recruiter_id, assigned_recruiter_name: users.find((u) => u.id === a.assigned_recruiter_id)?.full_name ?? null,
  };
}

export const pipelineRows: PipelineRow[] = applications.map(toPipelineRow);

export function toPortalRow(row: PipelineRow): PortalApplication {
  const a = applications.find((x) => x.id === row.application_id)!;
  const pi = interviews.find((i) => i.id === row.prime_interview_id) ?? null;
  const ci = interviews.find((i) => i.id === row.client_interview_id) ?? null;
  return {
    application_id: row.application_id, profile_id: row.profile_id, client_id: row.client_id, profile_title: row.profile_title, full_name: row.full_name, zone: row.zone,
    municipality: row.municipality, education_level: row.education_level, stage: row.stage, stage_order: row.stage_order, stage_changed_at: row.stage_changed_at, applied_at: row.applied_at,
    discarded_from_stage: row.discarded_from_stage, client_decision: row.client_decision, client_decision_at: a.client_decision_at, hired_at: row.hired_at,
    prime_interview_at: pi?.scheduled_at ?? null, prime_interview_summary: pi?.summary ?? null, prime_interview_score: pi?.score ?? null,
    psych_verdict: row.psych_verdict, psych_fit_pct: row.psych_fit_pct, docs_validated: row.docs_validated, docs_required: row.docs_required,
    client_interview_at: ci?.scheduled_at ?? null, client_interview_status: ci?.status ?? null, client_interview_url: ci?.meeting_url ?? null,
  };
}

export const portalRows: PortalApplication[] = pipelineRows.filter((r) => clientVisible(r.stage!, r.discarded_from_stage)).map(toPortalRow);

export const portalDocuments: PortalDocument[] = candidateDocuments
  .filter((d) => d.status !== "rejected")
  .map((d) => {
    const t = documentTypes.find((x) => x.key === d.document_type_key)!;
    return { application_id: d.application_id, document_type_key: d.document_type_key, label: t.label, required: t.required, sort_order: t.sort_order, status: d.status, validated_at: d.validated_at };
  });

export function stageCounts(rows: PipelineRow[]): StageCounts {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as StageCounts;
  for (const r of rows) if (r.stage) counts[r.stage] += 1;
  return counts;
}

export const funnelRows: FunnelRow[] = profiles.flatMap((p) =>
  STAGES.map((stage) => ({
    client_id: p.client_id, profile_id: p.id, profile_title: p.title, stage, stage_order: idx(stage) + 1,
    applications: new Set(stageEvents.filter((e) => e.to_stage === stage && applications.find((a) => a.id === e.application_id)?.profile_id === p.id).map((e) => e.application_id)).size,
  })),
).filter((r) => r.applications > 0);

export const channelRows: ChannelRow[] = profiles.flatMap((p) =>
  (["pandape", "facebook", "linkedin", "prime_pool", "referral", "other"] as Channel[]).map((ch) => {
    const apps = applications.filter((a) => a.profile_id === p.id && a.source_channel === ch);
    return { client_id: p.client_id, profile_id: p.id, profile_title: p.title, source_channel: ch, applications: apps.length, hired: apps.filter((a) => a.stage === "hired").length, discarded: apps.filter((a) => a.stage === "discarded").length, prefilter_passed: apps.filter((a) => a.prefilter_status === "passed").length };
  }),
).filter((r) => r.applications > 0);

export const stageDurationRows: StageDurationRow[] = profiles.flatMap((p) =>
  STAGES.map((stage): StageDurationRow | null => {
    const hours: number[] = [];
    for (const a of applications.filter((x) => x.profile_id === p.id)) {
      const evs = stageEvents.filter((e) => e.application_id === a.id).sort((x, y) => x.created_at.localeCompare(y.created_at));
      evs.forEach((e, i) => { const next = evs[i + 1]; if (e.to_stage === stage && next) hours.push((new Date(next.created_at).getTime() - new Date(e.created_at).getTime()) / 36e5); });
    }
    if (!hours.length) return null;
    const sorted = hours.slice().sort((x, y) => x - y);
    return { client_id: p.client_id, profile_id: p.id, profile_title: p.title, stage, stage_order: idx(stage) + 1, samples: hours.length, avg_hours: Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10, median_hours: Math.round(sorted[Math.floor(sorted.length / 2)]! * 10) / 10 };
  }).filter((r): r is StageDurationRow => r !== null),
);

export const discardRows: DiscardReasonRow[] = Object.values(
  applications.filter((a) => a.stage === "discarded").reduce<Record<string, DiscardReasonRow>>((acc, a) => {
    const p = profileById(a.profile_id);
    const key = `${p.id}|${a.discarded_from_stage}|${a.discard_reason_key}`;
    acc[key] ??= { client_id: p.client_id, profile_id: p.id, profile_title: p.title, discarded_from_stage: a.discarded_from_stage, discard_reason_key: a.discard_reason_key, applications: 0 };
    acc[key].applications = (acc[key].applications ?? 0) + 1;
    return acc;
  }, {}),
);

export const prefilterFailureRows: PrefilterFailureRow[] = Object.values(
  prefilterAnswers.reduce<Record<string, PrefilterFailureRow>>((acc, pa) => {
    const a = applications.find((x) => x.id === pa.application_id)!;
    const p = profileById(a.profile_id);
    const key = `${p.id}|${pa.question_key}`;
    acc[key] ??= { client_id: p.client_id, profile_id: p.id, profile_title: p.title, question_key: pa.question_key, answered: 0, failed: 0 };
    acc[key].answered = (acc[key].answered ?? 0) + 1;
    if (pa.passes === false) acc[key].failed = (acc[key].failed ?? 0) + 1;
    return acc;
  }, {}),
);

export const recruiterNames = (profileId: string) =>
  profileAssignments.filter((a) => a.profile_id === profileId).map((a) => users.find((u) => u.id === a.recruiter_id)?.full_name ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
export const usersById = (id: string | null | undefined) => users.find((u) => u.id === id) ?? null;
export { profileById, clientById, aiConfigByProfile };
