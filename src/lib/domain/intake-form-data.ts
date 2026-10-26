import type { IntakeForm } from "./json";

const list = (v: FormDataEntryValue | null) =>
  typeof v === "string" ? v.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean) : [];
/** "Negociación: alto" por línea → { name, level }. Sin dos puntos, el nivel queda vacío. */
const levels = (v: FormDataEntryValue | null) =>
  list(v).map((line) => {
    const i = line.indexOf(":");
    return i < 0 ? { name: line, level: "" } : { name: line.slice(0, i).trim(), level: line.slice(i + 1).trim() };
  }).filter((c) => c.name);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Secciones II a VII del formulario (components/profile/position-fields.tsx) → la forma del levantamiento. */
export function positionFromFormData(formData: FormData, title: string): Omit<IntakeForm, "company"> {
  return {
    position: { title, unit: str(formData.get("unit")), reports_to: str(formData.get("reports_to")), openings: Number(formData.get("openings") ?? 1) || 1, work_zone: str(formData.get("work_zone")), objective: str(formData.get("objective")) },
    specs: { age: str(formData.get("spec_age")), sex: str(formData.get("spec_sex")), marital_status: str(formData.get("spec_marital")), children: str(formData.get("spec_children")), residence: str(formData.get("spec_residence")) },
    requirements: { education: str(formData.get("req_education")), experience: str(formData.get("req_experience")), knowledge: list(formData.get("req_knowledge")), languages: str(formData.get("req_languages")), systems: list(formData.get("req_systems")) },
    activities: list(formData.get("activities")),
    conditions: { salary: str(formData.get("cond_salary")), benefits: list(formData.get("cond_benefits")), schedule: str(formData.get("cond_schedule")), modality: str(formData.get("cond_modality")), travel: str(formData.get("cond_travel")), staff_in_charge: str(formData.get("cond_staff")), tools: list(formData.get("cond_tools")) },
    competencies: { functional: levels(formData.get("comp_functional")), leadership: levels(formData.get("comp_leadership")), labor: list(formData.get("comp_labor")) },
    notes: str(formData.get("notes")),
  };
}

export { str as formString };
