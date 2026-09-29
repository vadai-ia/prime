import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDateLong } from "@/lib/format";
import { asJson, type IntakeForm } from "@/lib/domain/json";
import type { ProfileDetail } from "@/lib/queries/types";

function Row({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={`text-right ${empty ? "text-ink-faint" : "text-ink"}`}>{empty ? "—" : value}</span>
    </div>
  );
}

function ListRow({ label, items }: { label: string; items: string[] | undefined }) {
  return (
    <div className="py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      {items && items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-faint">—</p>
      )}
    </div>
  );
}

/** Pestaña "Levantamiento": lo que se capturó con el cliente (secciones I a VI). Se conserva para auditoría y regeneración. */
export function Levantamiento({ intake }: { intake: ProfileDetail["intake"] }) {
  if (!intake) {
    return <EmptyState title="Sin levantamiento" hint="Este perfil se creó sin formulario de levantamiento. Puedes capturarlo desde Vacantes → Nuevo levantamiento." />;
  }

  const form = asJson<IntakeForm>(intake.form, {});
  const company = form.company ?? {};
  const position = form.position ?? {};
  const specs = form.specs ?? {};
  const req = form.requirements ?? {};
  const cond = form.conditions ?? {};
  const comp = form.competencies ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <Pill tone={intake.status === "generated" ? "mint" : "amber"}>{intake.status === "generated" ? "Perfil generado" : "Borrador"}</Pill>
        <span>Capturado el {fmtDateLong(intake.created_at)}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="I. Empresa">
          <Row label="Nombre" value={company.name} />
          <Row label="Giro" value={company.industry} />
          <Row label="Ciudad" value={company.city} />
          <Row label="Contacto" value={company.contact_name ? `${company.contact_name}${company.contact_title ? `, ${company.contact_title}` : ""}` : null} />
          <Row label="Correo" value={company.contact_email} />
          <Row label="Teléfono" value={company.contact_phone} />
        </Card>

        <Card title="II. Puesto">
          <Row label="Título" value={position.title} />
          <Row label="Unidad" value={position.unit} />
          <Row label="Reporta a" value={position.reports_to} />
          <Row label="Plazas" value={position.openings} />
          <Row label="Zona" value={position.work_zone} />
          <Row label="Objetivo" value={position.objective} />
        </Card>

        <Card title="III. Perfil">
          <Row label="Edad" value={specs.age} />
          <Row label="Sexo" value={specs.sex} />
          <Row label="Estado civil" value={specs.marital_status} />
          <Row label="Hijos" value={specs.children} />
          <Row label="Residencia" value={specs.residence} />
        </Card>

        <Card title="IV. Requisitos">
          <Row label="Escolaridad" value={req.education} />
          <Row label="Experiencia" value={req.experience} />
          <Row label="Idiomas" value={req.languages} />
          <ListRow label="Conocimientos" items={req.knowledge} />
          <ListRow label="Sistemas" items={req.systems} />
        </Card>

        <Card title="V. Actividades">
          <ListRow label="Principales actividades" items={form.activities} />
        </Card>

        <Card title="VI. Condiciones">
          <Row label="Sueldo" value={cond.salary} />
          <Row label="Horario" value={cond.schedule} />
          <Row label="Modalidad" value={cond.modality} />
          <Row label="Viajes" value={cond.travel} />
          <Row label="Personal a cargo" value={cond.staff_in_charge} />
          <ListRow label="Prestaciones" items={cond.benefits} />
          <ListRow label="Herramientas" items={cond.tools} />
        </Card>

        <Card title="Competencias laborales">
          <ListRow label="Competencias" items={comp.labor} />
        </Card>

        <Card title="Notas">
          {form.notes ? <p className="whitespace-pre-line text-sm text-ink">{form.notes}</p> : <p className="text-sm text-ink-faint">—</p>}
        </Card>
      </div>
    </div>
  );
}
