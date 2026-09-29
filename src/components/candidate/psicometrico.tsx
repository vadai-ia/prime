import { Check, ExternalLink, X } from "lucide-react";
import type { ApplicationDetail } from "@/lib/queries/types";
import { asArray, asJson } from "@/lib/domain/json";
import type { PsychFitRow, PsychMinimum, PsychParsed } from "@/lib/domain/json";
import { PSYCH_STATUS_LABELS, PSYCH_VERDICT_LABELS, PSYCH_VERDICT_TONES } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Ring } from "@/components/ui/ring";
import { Bar } from "@/components/ui/bar";
import { EmptyState } from "@/components/ui/empty-state";
import { utcIsoToZoned } from "@/lib/domain/time";
import { PsychManual } from "./psych-forms";

export function Psicometrico({ detail }: { detail: ApplicationDetail }) {
  const psych = detail.psych;
  const minimums = asArray<PsychMinimum>(detail.aiConfig?.psych_minimums);
  const blocking = asArray<PsychMinimum>(detail.aiConfig?.psych_blocking);

  const manual = (
    <Card title="Captura manual" subtitle="Psicotest no tiene API: registra el enlace, sube el PDF y captura el veredicto.">
      <PsychManual
        applicationId={detail.application.id}
        testLink={psych?.test_link ?? null}
        dueDate={utcIsoToZoned(psych?.due_at).date}
        hasReport={Boolean(psych?.report_file_path)}
        verdict={psych?.verdict ?? null}
        fitPct={psych?.fit_pct ?? null}
      />
    </Card>
  );

  if (!psych) {
    return (
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <EmptyState title="Sin psicométrico" hint="Crea la evaluación en Psicotest, mándale el enlace al candidato y regístralo aquí." />
          {minimums.length > 0 && <Minimums minimums={minimums} blocking={blocking} />}
        </div>
        <div className="lg:col-span-2">{manual}</div>
      </div>
    );
  }

  const parsed = asJson<PsychParsed>(psych.parsed, {});
  const fitRows = asArray<PsychFitRow>(psych.fit_rows);
  const isParsed = psych.status === "parsed";
  // Veredicto capturado a mano: hay resultado, pero no escalas ni resumen leídos del PDF.
  const hasScales = fitRows.length > 0;
  const hasSummary = Object.keys(parsed).length > 0;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <Card
          title="Evaluación Psicotest"
          action={
            <div className="flex items-center gap-2">
              <Pill tone={psych.status === "parsed" ? "mint" : psych.status === "failed" ? "danger" : "info"}>{PSYCH_STATUS_LABELS[psych.status]}</Pill>
              {psych.verdict && <Pill tone={PSYCH_VERDICT_TONES[psych.verdict]}>{PSYCH_VERDICT_LABELS[psych.verdict]}</Pill>}
            </div>
          }
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Enviado" value={fmtDateTime(psych.sent_at)} />
            <Field label="Fecha límite" value={fmtDateTime(psych.due_at)} />
            <Field label="Recordatorio" value={psych.reminder_sent_at ? fmtDateTime(psych.reminder_sent_at) : "Sin enviar"} />
            <Field label="Completado" value={psych.completed_at ? fmtDateTime(psych.completed_at) : "Pendiente"} />
          </dl>
          {psych.test_link && (
            <a href={psych.test_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
              Enlace de la evaluación <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </Card>

        {isParsed ? (
          <Card title="Ajuste contra los mínimos del perfil" subtitle="Escalas del reporte comparadas con job_profile_ai_configs">
            <div className="flex flex-col gap-5 sm:flex-row">
              {psych.fit_pct !== null && (
                <div className="shrink-0">
                  <Ring value={psych.fit_pct} size={88} tone={psych.fit_pct >= 75 ? "leaf" : psych.fit_pct >= 60 ? "amber" : "danger"} label="fit" />
                </div>
              )}
              {!hasScales && <p className="text-sm text-ink-muted">Veredicto capturado por el reclutador a partir del reporte. Las escalas contra los mínimos del perfil saldrán cuando la IA lea el PDF.</p>}
              <table className={hasScales ? "w-full text-sm" : "hidden"}>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="pb-2 font-semibold">Escala</th>
                    <th className="pb-2 text-right font-semibold">Mínimo</th>
                    <th className="pb-2 text-right font-semibold">Obtenido</th>
                    <th className="pb-2 text-center font-semibold">Cumple</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {fitRows.map((row) => (
                    <tr key={row.scale}>
                      <td className="py-2 pr-3 text-ink">
                        {row.scale}
                        {row.blocking && (
                          <Pill tone="danger" className="ml-2">
                            bloqueante
                          </Pill>
                        )}
                      </td>
                      <td className="py-2 text-right text-ink-muted">{row.min}</td>
                      <td className="py-2 text-right font-medium text-ink">{row.score}</td>
                      <td className="py-2 text-center">
                        {row.ok ? <Check className="mx-auto h-4 w-4 text-leaf" aria-label="Cumple" /> : <X className="mx-auto h-4 w-4 text-danger" aria-label="No cumple" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          minimums.length > 0 && <Minimums minimums={minimums} blocking={blocking} />
        )}
      </div>

      <div className="space-y-5 lg:col-span-2">
        {manual}
        {isParsed && hasSummary && (
          <Card title="Resumen del reporte">
            {parsed.iq !== undefined && (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-forest">{parsed.iq}</span>
                <span className="text-sm text-ink-muted">CI · {parsed.iq_level ?? "—"}</span>
              </div>
            )}
            {parsed.cacter && <p className="mt-2 text-sm text-ink-muted">Temperamento: {parsed.cacter}</p>}

            {(parsed.cibain_high?.length ?? 0) > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rasgos altos</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {parsed.cibain_high!.map((t) => (
                    <Pill key={t} tone="mint">
                      {t}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
            {(parsed.cibain_low?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rasgos bajos</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {parsed.cibain_low!.map((t) => (
                    <Pill key={t} tone="amber">
                      {t}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
            {parsed.inceval && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Integridad</p>
                <Bar value={parsed.inceval.trust} label="Confianza" />
                <Bar value={parsed.inceval.honesty} label="Honestidad" />
                <Bar value={parsed.inceval.ethics} label="Ética" />
              </div>
            )}
            {(parsed.ciesman_low?.length ?? 0) > 0 && (
              <p className="mt-3 text-xs text-ink-muted">Áreas de atención: {parsed.ciesman_low!.join(", ")}</p>
            )}
            {psych.report_file_path && <p className="mt-4 text-xs text-ink-faint">PDF: {psych.report_file_path.split("/").pop()}</p>}
          </Card>
        )}
        {psych.status === "failed" && (
          <div className="rounded-card border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger">
            No se pudo leer el PDF de Psicotest. Revisa el archivo o captura las escalas a mano.
          </div>
        )}
      </div>
    </div>
  );
}

function Minimums({ minimums, blocking }: { minimums: PsychMinimum[]; blocking: PsychMinimum[] }) {
  return (
    <Card title="Mínimos esperados para la vacante" subtitle="Lo que Claude compara cuando llega el reporte">
      <ul className="divide-y divide-line text-sm">
        {minimums.map((m) => {
          const block = blocking.find((b) => b.scale === m.scale);
          return (
            <li key={m.scale} className="flex items-center justify-between py-2">
              <span className="text-ink">{m.scale}</span>
              <span className="text-ink-muted">
                mínimo {m.min}
                {block && <span className="ml-2 text-xs text-danger">bloquea debajo de {block.min}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
