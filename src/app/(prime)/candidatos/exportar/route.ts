import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK } from "@/lib/mock";
import { listPipeline } from "@/lib/queries/pipeline";
import { listAllFollowups, type FollowupRow } from "@/lib/queries/followups";
import { INACTIVE_MONTHS, listInactive, type InactiveMonths, type InactiveRow } from "@/lib/queries/inactive";
import { toXlsx, XLSX_MIME, type Column } from "@/lib/export/xlsx";
import { CHANNEL_LABELS, DISCARD_REASON_LABELS, FOLLOWUP_OUTCOME_LABELS, PREFILTER_LABELS, PSYCH_VERDICT_LABELS, STAGE_LABELS, STAGES, type Stage } from "@/lib/labels";
import { fmtPhone, todayLocal } from "@/lib/format";
import type { PipelineRow, SourceChannel } from "@/lib/queries/types";

// Exportar a Excel: solo admin (plan §2.3). Cada descarga queda en audit_log con log_audit('export'),
// que además la rechaza en la base si no es admin. Sin registro no hay archivo.

const TZ = process.env.APP_TIMEZONE ?? "America/Mexico_City";
const dateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("es-MX", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : null;
const date = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat("es-MX", { timeZone: TZ, dateStyle: "short" }).format(new Date(iso)) : null);
const day = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : null);
const phone = (e164: string | null | undefined) => (e164 ? fmtPhone(e164) : null);

const PIPELINE_COLUMNS: Column<PipelineRow>[] = [
  { header: "Nombre", width: 30, value: (r) => r.full_name },
  { header: "Teléfono", width: 16, value: (r) => phone(r.phone_e164) },
  { header: "Correo", width: 26, value: (r) => r.email },
  { header: "Municipio", value: (r) => r.municipality },
  { header: "Zona", value: (r) => r.zone },
  { header: "Escolaridad", value: (r) => r.education_level },
  { header: "Edad", width: 8, value: (r) => r.age_reported },
  { header: "Vacante", width: 26, value: (r) => r.profile_title },
  { header: "Cliente", width: 22, value: (r) => r.client_name },
  { header: "Etapa", value: (r) => (r.stage ? STAGE_LABELS[r.stage] : null) },
  { header: "Días en la etapa", width: 10, value: (r) => r.days_in_stage },
  { header: "Canal", value: (r) => (r.source_channel ? CHANNEL_LABELS[r.source_channel] : null) },
  { header: "Reclutador", width: 22, value: (r) => r.assigned_recruiter_name },
  { header: "Score CV", width: 10, value: (r) => r.cv_score },
  { header: "Umbral", width: 10, value: (r) => r.cv_threshold },
  { header: "Prefiltro", value: (r) => (r.prefilter_status ? PREFILTER_LABELS[r.prefilter_status] : null) },
  { header: "Entrevista Prime", width: 10, value: (r) => r.prime_interview_score },
  { header: "Psicométrico", value: (r) => (r.psych_verdict ? PSYCH_VERDICT_LABELS[r.psych_verdict] : null) },
  { header: "Ajuste psicométrico %", width: 10, value: (r) => r.psych_fit_pct },
  { header: "Expectativa de sueldo", value: (r) => r.salary_expectation },
  { header: "Postulado", value: (r) => dateTime(r.applied_at) },
  { header: "Contratado", value: (r) => date(r.hired_at) },
  { header: "Motivo de descarte", width: 24, value: (r) => (r.discard_reason_key ? DISCARD_REASON_LABELS[r.discard_reason_key] : null) },
  { header: "Detalle del descarte", width: 30, value: (r) => r.discard_reason },
];

const INACTIVE_COLUMNS: Column<InactiveRow>[] = [
  { header: "Nombre", width: 30, value: (r) => r.full_name },
  { header: "Teléfono", width: 16, value: (r) => phone(r.phone_e164) },
  { header: "Correo", width: 26, value: (r) => r.email },
  { header: "Municipio", value: (r) => r.municipality },
  { header: "Escolaridad", value: (r) => r.education_level },
  { header: "Postulaciones", width: 10, value: (r) => r.applications_count },
  { header: "Mejor score CV", width: 10, value: (r) => r.best_cv_score },
  { header: "Trabajó por Prime", width: 10, value: (r) => (r.was_hired ? "Sí" : "No") },
  { header: "Última vacante", width: 26, value: (r) => r.last_profile_title },
  { header: "Último cliente", width: 22, value: (r) => r.last_client_name },
  { header: "Cómo terminó", value: (r) => (r.last_stage ? STAGE_LABELS[r.last_stage] : null) },
  { header: "Motivo", width: 24, value: (r) => (r.last_discard_reason_key ? DISCARD_REASON_LABELS[r.last_discard_reason_key] : null) },
  { header: "Llegó hasta", value: (r) => (r.last_discarded_from_stage ? STAGE_LABELS[r.last_discarded_from_stage] : null) },
  { header: "Último movimiento", value: (r) => date(r.last_activity_at) },
];

const FOLLOWUP_COLUMNS: Column<FollowupRow>[] = [
  { header: "Nombre", width: 30, value: (r) => r.full_name },
  { header: "Teléfono", width: 16, value: (r) => phone(r.phone_e164) },
  { header: "Vacante", width: 26, value: (r) => r.profile_title },
  { header: "Cliente", width: 22, value: (r) => r.client_name },
  { header: "Reclutador", width: 22, value: (r) => r.recruiter_name },
  { header: "Ingreso", value: (r) => day(r.start_date) ?? date(r.hired_at) },
  { header: "Corte (días)", width: 10, value: (r) => r.checkpoint_days },
  { header: "Vence", value: (r) => day(r.due_at) },
  { header: "Resultado", value: (r) => FOLLOWUP_OUTCOME_LABELS[r.outcome] },
  { header: "Fecha de salida", value: (r) => day(r.left_at) },
  { header: "Motivo de salida", width: 26, value: (r) => r.left_reason },
  { header: "Nota", width: 30, value: (r) => r.notes },
  { header: "Capturó", width: 22, value: (r) => r.recorded_by_name },
  { header: "Capturado", value: (r) => dateTime(r.recorded_at) },
];

const str = (v: string | null) => (v ? v : undefined);

export async function GET(req: NextRequest) {
  try {
    await assertPermission("export");
  } catch {
    return new NextResponse("Solo un administrador puede exportar.", { status: 403 });
  }
  if (MOCK) return new NextResponse("Modo demo (MOCK_DATA): no hay datos que exportar.", { status: 404 });

  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "candidatos";
  let file: { name: string; sheet: string; entity: string; filters: Record<string, string | number>; rows: number; build: () => Promise<ArrayBuffer> };

  if (tipo === "inactivos") {
    const m = Number(sp.get("meses") ?? 0);
    const months: InactiveMonths = (INACTIVE_MONTHS as readonly number[]).includes(m) ? (m as InactiveMonths) : 0;
    const search = str(sp.get("q"));
    const rows = await listInactive({ months, search });
    file = { name: "inactivos", sheet: "Inactivos", entity: "inactive_candidates", filters: { meses: months, ...(search ? { q: search } : {}) }, rows: rows.length, build: () => toXlsx("Inactivos", INACTIVE_COLUMNS, rows) };
  } else if (tipo === "permanencia") {
    const rows = await listAllFollowups();
    file = { name: "permanencia", sheet: "Permanencia", entity: "placement_followups", filters: {}, rows: rows.length, build: () => toXlsx("Permanencia", FOLLOWUP_COLUMNS, rows) };
  } else {
    // mismos filtros que la pantalla de Candidatos
    const stageParam = sp.get("stage");
    const stage = STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : undefined;
    const channelParam = sp.get("channel");
    const channel = channelParam && channelParam in CHANNEL_LABELS ? (channelParam as SourceChannel) : undefined;
    const filters = { profileId: str(sp.get("profile")), clientId: str(sp.get("client")), stage, channel, search: str(sp.get("q")) };
    const rows = await listPipeline({ ...filters, includeDiscarded: stage === "discarded" || sp.get("todos") === "1" });
    const applied = Object.fromEntries(Object.entries({ ...filters, todos: sp.get("todos") === "1" ? "1" : undefined }).filter(([, v]) => v)) as Record<string, string>;
    file = { name: "candidatos", sheet: "Candidatos", entity: "applications", filters: applied, rows: rows.length, build: () => toXlsx("Candidatos", PIPELINE_COLUMNS, rows) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_audit", {
    p_action: "export",
    p_entity_type: file.entity,
    p_entity_id: null,
    p_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    p_metadata: { tipo: file.name, filtros: file.filters, filas: file.rows },
  });
  if (error) return new NextResponse(`No se pudo registrar la exportación: ${error.message}`, { status: 403 });

  const body = await file.build();
  return new NextResponse(body, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="prime-${file.name}-${todayLocal()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
