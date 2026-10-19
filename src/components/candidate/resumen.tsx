import { Check, X } from "lucide-react";
import type { ApplicationDetail } from "@/lib/queries/types";
import { asArray } from "@/lib/domain/json";
import type { CvBreakdownItem, PrefilterResultItem } from "@/lib/domain/json";
import { ACTOR_LABELS, DISCARD_REASON_LABELS, STAGE_LABELS } from "@/lib/labels";
import { fmtDateLong, fmtDateTime, fmtMinutes, fmtMoney, fmtMonths } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Bar } from "@/components/ui/bar";
import { Ring } from "@/components/ui/ring";
import { StagePill } from "@/components/ui/pill";
import { aiEnabled } from "@/lib/ai/client";
import { ScoreCvButton } from "./score-cv-button";

export function Resumen({ detail }: { detail: ApplicationDetail }) {
  const { application: a, pipeline: p, events, candidate, aiConfig } = detail;
  const breakdown = asArray<CvBreakdownItem>(a.cv_score_breakdown);
  const prefilter = asArray<PrefilterResultItem>(a.prefilter_result);
  const threshold = p.cv_threshold;
  const cvTone = a.cv_score !== null && threshold !== null ? (a.cv_score >= threshold ? "leaf" : "amber") : "neutral";
  // Calificado con otros pesos: la vacante cambió su evaluación después
  const stale = a.cv_score !== null && aiConfig !== null && a.cv_score_version !== null && a.cv_score_version !== aiConfig.version;
  const canScore = aiEnabled() && Boolean(candidate.cv_file_path || candidate.cv_text);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        {a.ai_note && (
          <div className="rounded-card border border-leaf/40 bg-mint px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">Nota de la IA</p>
            <p className="mt-1 text-sm text-ink">{a.ai_note}</p>
          </div>
        )}

        <Card
          title="Score de CV"
          subtitle={threshold !== null ? `Umbral de la vacante: ${threshold}` : undefined}
          action={canScore && a.cv_score !== null ? <ScoreCvButton applicationId={a.id} scored /> : undefined}
        >
          {stale && (
            <p className="mb-4 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">
              Calificado con los pesos v{a.cv_score_version}; la vacante ya va en la v{aiConfig?.version}. Recalifica para usar los vigentes.
            </p>
          )}
          {a.cv_score === null ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                {!candidate.cv_file_path && !candidate.cv_text
                  ? "Todavía no se califica el CV: el candidato no tiene CV adjunto."
                  : "Todavía no se califica el CV. Si acabas de darlo de alta, la IA tarda unos segundos: recarga la página."}
              </p>
              {canScore && <ScoreCvButton applicationId={a.id} scored={false} />}
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <Ring value={a.cv_score} size={88} tone={cvTone} label="de 100" />
                {threshold !== null && (
                  <p className={`text-xs font-medium ${a.cv_score >= threshold ? "text-leaf" : "text-amber"}`}>
                    {a.cv_score >= threshold ? "Sobre el umbral" : "Debajo del umbral"}
                  </p>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {breakdown.map((item) => (
                  <div key={item.key}>
                    <Bar value={item.score} max={item.weight} label={`${item.label} (peso ${item.weight})`} tone={item.score >= item.weight * 0.7 ? "leaf" : "amber"} />
                    {(item.note || item.evidence) && (
                      <p className="mt-1 text-xs text-ink-muted">
                        {item.note}
                        {item.evidence && <span className="text-ink-faint"> · «{item.evidence}»</span>}
                      </p>
                    )}
                  </div>
                ))}
                {a.cv_ai_rationale && <p className="pt-1 text-sm text-ink-muted">{a.cv_ai_rationale}</p>}
              </div>
            </div>
          )}
        </Card>

        <Card title="Prefiltro por WhatsApp" subtitle="Respuestas de Vale contra las reglas de la vacante">
          {prefilter.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin respuestas todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 font-semibold">Criterio</th>
                  <th className="pb-2 font-semibold">Respuesta</th>
                  <th className="pb-2 text-center font-semibold">Cumple</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prefilter.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 text-ink">
                      {item.criterion}
                      {!item.required && <span className="ml-1 text-[11px] text-ink-faint">(alerta)</span>}
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{item.answer}</td>
                    <td className="py-2 text-center">
                      {item.ok ? (
                        <Check className="mx-auto h-4 w-4 text-leaf" aria-label="Cumple" />
                      ) : (
                        <X className={`mx-auto h-4 w-4 ${item.required ? "text-danger" : "text-amber"}`} aria-label="No cumple" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Datos capturados">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Field label="Traslado" value={fmtMinutes(a.commute_minutes)} />
            <Field label="Experiencia" value={fmtMonths(a.experience_months)} />
            <Field label="Expectativa" value={fmtMoney(a.salary_expectation)} />
            <Field label="Disponible" value={a.available === null ? "—" : a.available ? "Sí" : "No"} />
          </dl>
          {a.availability_notes && <p className="mt-3 text-sm text-ink-muted">{a.availability_notes}</p>}
        </Card>
      </div>

      <div className="space-y-5 lg:col-span-2">
        {a.stage === "discarded" && (
          <div className="rounded-card border border-danger/30 bg-danger-soft px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-danger">Descartado</p>
            <p className="mt-1 text-sm font-medium text-ink">{a.discard_reason_key ? DISCARD_REASON_LABELS[a.discard_reason_key] : "Sin motivo categorizado"}</p>
            {a.discard_reason && <p className="mt-1 text-sm text-ink-muted">{a.discard_reason}</p>}
            <p className="mt-2 text-xs text-ink-muted">
              Desde {a.discarded_from_stage ? STAGE_LABELS[a.discarded_from_stage] : "—"} · por {a.discarded_by ? ACTOR_LABELS[a.discarded_by] : "—"} · {fmtDateLong(a.discarded_at)}
            </p>
          </div>
        )}

        {a.stage === "hired" && (
          <div className="rounded-card border border-leaf/40 bg-mint px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">Contratado</p>
            <dl className="mt-2 space-y-1 text-sm">
              <Field label="Fecha" value={fmtDateLong(a.hired_at)} inline />
              <Field label="Sueldo acordado" value={fmtMoney(a.agreed_salary)} inline />
              <Field label="Hoja de confirmación" value={a.confirmation_sheet_path ? (a.confirmation_signed_at ? "Firmada" : "Generada, sin firma") : "Pendiente"} inline />
            </dl>
          </div>
        )}

        <Card title="Línea de tiempo" subtitle="Cada cambio de etapa con quién lo hizo">
          <ol className="relative space-y-4 border-l border-line pl-4">
            {events
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-leaf" />
                  <div className="flex flex-wrap items-center gap-2">
                    {e.from_stage && (
                      <>
                        <StagePill stage={e.from_stage} />
                        <span className="text-xs text-ink-faint">→</span>
                      </>
                    )}
                    <StagePill stage={e.to_stage} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {ACTOR_LABELS[e.actor_type]} · {fmtDateTime(e.created_at)}
                  </p>
                  {e.reason && <p className="mt-0.5 text-sm text-ink">{e.reason}</p>}
                </li>
              ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, inline = false }: { label: string; value: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">{label}</dt>
        <dd className="text-right text-ink">{value}</dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
