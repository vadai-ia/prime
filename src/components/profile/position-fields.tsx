import type { ReactNode } from "react";
import { inputClass, labelClass } from "@/components/ui/form";
import type { ProfileCompetencies, ProfileConditions, ProfileRequirements, ProfileSpecs } from "@/lib/domain/json";

// Secciones II a VII del levantamiento. Las comparten el levantamiento nuevo y la edición de la
// vacante: mismos nombres de campo, que lee positionFromFormData (src/lib/domain/intake-form-data.ts).

export type PositionDefaults = {
  title?: string;
  unit?: string | null;
  reports_to?: string | null;
  openings?: number;
  work_zone?: string | null;
  objective?: string | null;
  specs?: ProfileSpecs;
  requirements?: ProfileRequirements;
  activities?: string[];
  conditions?: ProfileConditions;
  competencies?: ProfileCompetencies;
  notes?: string;
};

// `step` identifica la sección en el levantamiento por pasos; `hidden` la oculta sin sacarla del formulario
// (sus campos se siguen enviando).
export function Section({ number, title, hint, step, hidden, children }: { number: string; title: string; hint?: string; step?: number; hidden?: boolean; children: ReactNode }) {
  return (
    <fieldset data-step={step} hidden={hidden} className="rounded-card border border-line bg-surface p-5 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-forest">
        {number}. {title}
      </legend>
      {hint && <p className="mb-3 text-xs text-ink-muted">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Asterisco de campo obligatorio. `important` marca los que el prefiltro y la evaluación necesitan: avisan, no bloquean. */
function Mark() {
  return (
    <span className="text-amber" aria-hidden>
      {" "}*
    </span>
  );
}

export function Text({ name, label, span, placeholder, type = "text", required, important, value }: { name: string; label: string; span?: boolean; placeholder?: string; type?: string; required?: boolean; important?: boolean; value?: string | null }) {
  return (
    <label className={`${labelClass} ${span ? "sm:col-span-2" : ""}`}>
      {label}
      {(required || important) && <Mark />}
      <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={value ?? ""} className={inputClass} />
    </label>
  );
}

export function Area({ name, label, span = true, placeholder, rows = 3, value }: { name: string; label: string; span?: boolean; placeholder?: string; rows?: number; value?: string | string[] | null }) {
  return (
    <label className={`${labelClass} ${span ? "sm:col-span-2" : ""}`}>
      {label}
      <textarea name={name} rows={rows} placeholder={placeholder} defaultValue={Array.isArray(value) ? value.join("\n") : (value ?? "")} className={inputClass} />
    </label>
  );
}

const MODALITIES = ["Presencial", "Híbrido", "Remoto"];

const withLevel = (c: { name: string; level: string }) => (c.level ? `${c.name}: ${c.level}` : c.name);

/** `step`: paso visible del levantamiento (2 a 7); sin él se muestran todas las secciones, como en la edición. */
export function PositionFields({ defaults: d = {}, withNotes = true, step }: { defaults?: PositionDefaults; withNotes?: boolean; step?: number }) {
  const modality = d.conditions?.modality ?? "Presencial";
  const at = (n: number) => ({ step: n, hidden: step !== undefined && step !== n });

  return (
    <>
      <Section number="II" title="Puesto" {...at(2)}>
        <Text name="title" label="Nombre del puesto" required placeholder="Ej.: Ejecutivo de cobranza" value={d.title} />
        <Text name="unit" label="Unidad o área" placeholder="Ej.: Crédito y cobranza" value={d.unit} />
        <Text name="reports_to" label="Reporta a" placeholder="Ej.: Gerente de crédito" value={d.reports_to} />
        <label className={labelClass}>
          Plazas
          <input name="openings" type="number" min={1} defaultValue={d.openings ?? 1} className={inputClass} />
        </label>
        <Text name="work_zone" label="Zona de trabajo" span important placeholder="Ej.: Aguascalientes, zona norte" value={d.work_zone} />
        <Area name="objective" label="Objetivo del puesto" placeholder="Para qué existe el puesto en una o dos líneas" value={d.objective} />
      </Section>

      <Section number="III" title="Perfil" {...at(3)} hint="Edad y sexo se configuran como alerta, no como bloqueo, salvo acuerdo expreso con el cliente.">
        <Text name="spec_age" label="Edad" important placeholder="Ej.: 25 a 45 años" value={d.specs?.age} />
        <Text name="spec_sex" label="Sexo" placeholder="Indistinto" value={d.specs?.sex} />
        <Text name="spec_marital" label="Estado civil" placeholder="Indistinto" value={d.specs?.marital_status} />
        <Text name="spec_children" label="Hijos" placeholder="Indistinto" value={d.specs?.children} />
        <Text name="spec_residence" label="Residencia" span placeholder="Ej.: Aguascalientes o municipios conurbados" value={d.specs?.residence} />
      </Section>

      <Section number="IV" title="Requisitos" {...at(4)} hint="En las listas, un elemento por línea.">
        <Text name="req_education" label="Escolaridad" important placeholder="Ej.: Preparatoria terminada" value={d.requirements?.education} />
        <Text name="req_experience" label="Experiencia" important placeholder="Ej.: 1 año en cobranza" value={d.requirements?.experience} />
        <Text name="req_languages" label="Idiomas" span placeholder="Ej.: Español; inglés técnico" value={d.requirements?.languages} />
        <Area name="req_knowledge" label="Conocimientos" span={false} placeholder={"Negociación\nManejo de objeciones"} value={d.requirements?.knowledge} />
        <Area name="req_systems" label="Sistemas" span={false} placeholder={"Excel intermedio\nCRM"} value={d.requirements?.systems} />
      </Section>

      <Section number="V" title="Actividades" {...at(5)} hint="Una actividad por línea, de la más frecuente a la menos.">
        <Area name="activities" label="Principales actividades" rows={5} placeholder={"Gestionar cartera asignada\nVisitar clientes con adeudo\nRegistrar gestiones en el CRM"} value={d.activities} />
      </Section>

      <Section number="VI" title="Condiciones" {...at(6)} hint="En las listas, un elemento por línea.">
        <Text name="cond_salary" label="Sueldo" important placeholder="Ej.: $9,000 a $11,000 más bono" value={d.conditions?.salary} />
        <Text name="cond_schedule" label="Horario" important placeholder="Ej.: L-V 8:30 a 18:00, sábado 9:00 a 13:00" value={d.conditions?.schedule} />
        <label className={labelClass}>
          Modalidad
          <select name="cond_modality" defaultValue={modality} className={inputClass}>
            {(MODALITIES.includes(modality) ? MODALITIES : [...MODALITIES, modality]).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <Text name="cond_travel" label="Viajes" placeholder="Ej.: Local, 2 días por semana" value={d.conditions?.travel} />
        <Text name="cond_staff" label="Personal a cargo" span placeholder="Ej.: Ninguno" value={d.conditions?.staff_in_charge} />
        <Area name="cond_benefits" label="Prestaciones" span={false} placeholder={"Prestaciones de ley\nVales de despensa"} value={d.conditions?.benefits} />
        <Area name="cond_tools" label="Herramientas" span={false} placeholder={"Celular de empresa\nLaptop"} value={d.conditions?.tools} />
      </Section>

      <Section number="VII" {...at(7)} title={withNotes ? "Competencias y notas" : "Competencias"} hint="Una por línea. En funcionales y de liderazgo, el nivel va después de dos puntos.">
        <Area name="comp_functional" label="Competencias funcionales" span={false} placeholder={"Negociación: alto\nOrientación a resultados: medio"} value={d.competencies?.functional?.map(withLevel)} />
        <Area name="comp_leadership" label="Competencias de liderazgo" span={false} placeholder={"Trabajo en equipo: medio"} value={d.competencies?.leadership?.map(withLevel)} />
        <Area name="comp_labor" label="Competencias laborales" placeholder={"Tolerancia a la presión\nHonestidad\nPersistencia"} value={d.competencies?.labor} />
        {withNotes && (
          <Area name="notes" label="Notas del levantamiento" placeholder="Todo lo que el cliente dijo y no cabe arriba: urgencia, rotación, contexto del equipo." rows={4} value={d.notes} />
        )}
      </Section>
    </>
  );
}
