import type { TablesInsert } from "@/lib/db/types";
import type { IntakeForm } from "./json";

/**
 * Vacante a partir del levantamiento, sin IA: copia las secciones tal cual.
 * La generación con IA completará después relaciones, competencias por nivel,
 * proceso de selección y la configuración de evaluación.
 */
export function profileFromIntake(
  form: IntakeForm,
  ctx: { clientId: string; intakeId: string; userId: string; today: string },
): TablesInsert<"job_profiles"> {
  const p = form.position ?? {};
  return {
    client_id: ctx.clientId,
    intake_id: ctx.intakeId,
    title: p.title?.trim() || "Sin puesto",
    status: "active",
    openings: p.openings && p.openings > 0 ? p.openings : 1,
    unit: p.unit ?? null,
    work_zone: p.work_zone ?? null,
    objective: p.objective ?? null,
    reports_to: p.reports_to ?? null,
    prepared_by: ctx.userId,
    prepared_at: ctx.today,
    specs: form.specs ?? {},
    requirements: form.requirements ?? {},
    activities: form.activities ?? [],
    conditions: form.conditions ?? {},
    competencies: form.competencies ?? {},
  };
}
