import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { CHANNEL_LABELS } from "@/lib/labels";
import { fmtDateLong } from "@/lib/format";
import {
  asArray,
  asJson,
  type ProfileCompetencies,
  type ProfileConditions,
  type ProfileRelation,
  type ProfileRequirements,
  type ProfileSpecs,
} from "@/lib/domain/json";
import type { ProfileDetail, SourceChannel } from "@/lib/queries/types";
import { ChannelDot } from "@/components/ui/channel-dot";

// Bolsas donde Prime publica por omisión, si la vacante no dice otras.
const DEFAULT_CHANNELS: SourceChannel[] = ["pandape", "facebook", "linkedin", "prime_pool"];

/** Donde se publicó la vacante, más cualquier canal del que ya hayan llegado postulantes. */
function shownChannels(published: SourceChannel[], counts: Partial<Record<SourceChannel, number>>): SourceChannel[] {
  const base = published.length ? published : DEFAULT_CHANNELS;
  const extra = (Object.keys(counts) as SourceChannel[]).filter((c) => !base.includes(c));
  return [...base, ...extra];
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={`text-sm ${empty ? "text-ink-faint" : "text-ink"}`}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Bullets({ items }: { items: string[] | undefined }) {
  if (!items || items.length === 0) return <p className="text-sm text-ink-faint">—</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: string[] | undefined }) {
  if (!items || items.length === 0) return <span className="text-sm text-ink-faint">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Pill key={item} tone="neutral">
          {item}
        </Pill>
      ))}
    </div>
  );
}

/** Pestaña "Descriptivo": el D.P. tal como lo ve Prime y el cliente. */
export function Descriptivo({ profile, channels = {} }: { profile: ProfileDetail; channels?: Partial<Record<SourceChannel, number>> }) {
  const specs = asJson<ProfileSpecs>(profile.specs, {});
  const req = asJson<ProfileRequirements>(profile.requirements, {});
  const cond = asJson<ProfileConditions>(profile.conditions, {});
  const relations = asArray<ProfileRelation>(profile.relations);
  const comp = asJson<ProfileCompetencies>(profile.competencies, {});

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Puesto" className="lg:col-span-2">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Objetivo del puesto" value={profile.objective} />
          </div>
          <Field label="Reporta a" value={profile.reports_to} />
          <Field label="Unidad" value={profile.unit} />
          <Field label="Zona de trabajo" value={profile.work_zone} />
          <Field label="Plazas" value={profile.openings} />
          <Field label="Elaborado" value={profile.prepared_at ? fmtDateLong(profile.prepared_at) : null} />
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs text-ink-faint">Canales de publicación</dt>
            <dd className="mt-1">
              <Chips items={profile.published_channels.map((c) => CHANNEL_LABELS[c])} />
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Perfil" subtitle="Criterios demográficos: se configuran como alerta en Evaluación IA">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Edad" value={specs.age} />
          <Field label="Sexo" value={specs.sex} />
          <Field label="Estado civil" value={specs.marital_status} />
          <Field label="Hijos" value={specs.children} />
          <div className="sm:col-span-2">
            <Field label="Residencia" value={specs.residence} />
          </div>
        </dl>
      </Card>

      <Card title="Requisitos">
        <dl className="space-y-3">
          <Field label="Escolaridad" value={req.education} />
          <Field label="Experiencia" value={req.experience} />
          <Field label="Idiomas" value={req.languages} />
          <div>
            <dt className="text-xs text-ink-faint">Conocimientos</dt>
            <dd className="mt-1">
              <Chips items={req.knowledge} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Sistemas</dt>
            <dd className="mt-1">
              <Chips items={req.systems} />
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Actividades">
        <Bullets items={profile.activities} />
      </Card>

      <Card title="Condiciones">
        <dl className="space-y-3">
          <Field label="Sueldo" value={cond.salary} />
          <Field label="Horario" value={cond.schedule} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Modalidad" value={cond.modality} />
            <Field label="Viajes" value={cond.travel} />
          </div>
          <Field label="Personal a cargo" value={cond.staff_in_charge} />
          <div>
            <dt className="text-xs text-ink-faint">Prestaciones</dt>
            <dd className="mt-1">
              <Chips items={cond.benefits} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Herramientas</dt>
            <dd className="mt-1">
              <Chips items={cond.tools} />
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Relaciones de trabajo">
        {relations.length === 0 ? (
          <p className="text-sm text-ink-faint">—</p>
        ) : (
          <ul className="divide-y divide-line">
            {relations.map((r) => (
              <li key={`${r.with}-${r.purpose}`} className="flex items-start justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
                <span className="font-medium text-ink">{r.with}</span>
                <span className="text-right text-ink-muted">{r.purpose}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Competencias">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-ink-faint">Funcionales</p>
            <CompetencyList items={comp.functional} />
          </div>
          <div>
            <p className="text-xs text-ink-faint">Liderazgo</p>
            <CompetencyList items={comp.leadership} />
          </div>
          <div>
            <p className="text-xs text-ink-faint">Laborales</p>
            <div className="mt-1">
              <Chips items={comp.labor} />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Proceso de selección">
        {profile.selection_process.length === 0 ? (
          <p className="text-sm text-ink-faint">—</p>
        ) : (
          <ol className="space-y-2">
            {profile.selection_process.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm text-ink">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-semibold text-forest">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Publicación" subtitle="Prime publica a mano en cada bolsa; cada postulante entra al sistema con su canal de origen" className="lg:col-span-2">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {shownChannels(profile.published_channels, channels).map((c) => (
            <ChannelDot key={c} channel={c} count={channels[c] ?? 0} />
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-1 text-xs text-ink-faint">Texto de la vacante</p>
          {profile.posting_text ? (
            <p className="whitespace-pre-line text-sm text-ink">{profile.posting_text}</p>
          ) : (
            <p className="text-sm text-ink-faint">Sin texto todavía. Se genera junto con el perfil.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function CompetencyList({ items }: { items: { name: string; level: string }[] | undefined }) {
  if (!items || items.length === 0) return <p className="mt-1 text-sm text-ink-faint">—</p>;
  return (
    <ul className="mt-1 space-y-1">
      {items.map((c) => (
        <li key={c.name} className="flex items-center justify-between text-sm">
          <span className="text-ink">{c.name}</span>
          <Pill tone={c.level.toLowerCase().startsWith("alt") ? "mint" : "neutral"}>{c.level}</Pill>
        </li>
      ))}
    </ul>
  );
}
