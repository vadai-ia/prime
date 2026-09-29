import { Check, ExternalLink, X } from "lucide-react";
import type { ApplicationDetail, Interview } from "@/lib/queries/types";
import { asArray } from "@/lib/domain/json";
import type { InterviewFinding } from "@/lib/domain/json";
import { INTERVIEW_STATUS_LABELS, INTERVIEW_STATUS_TONES as STATUS_TONE, INTERVIEW_TYPE_LABELS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Ring } from "@/components/ui/ring";
import { EmptyState } from "@/components/ui/empty-state";
import { utcIsoToZoned } from "@/lib/domain/time";
import { InterviewActions, ScheduleInterviewForm, type StaffOption } from "./interview-forms";

export function Entrevista({ detail, staff, currentUserId }: { detail: ApplicationDetail; staff: StaffOption[]; currentUserId: string }) {
  const { application, interviews } = detail;
  const closed = application.stage === "discarded" || application.stage === "hired";
  // pasada la entrevista Prime, lo siguiente que se agenda es la del cliente
  const defaultType = ["documents", "client_interview"].includes(application.stage) ? "client" : "prime";

  return (
    <div className="space-y-5">
      {!closed && <ScheduleInterviewForm applicationId={application.id} staff={staff} currentUserId={currentUserId} defaultType={defaultType} open={interviews.length === 0} />}
      {interviews.length === 0 && <EmptyState title="Sin entrevistas" hint="Agéndala aquí arriba. El enlace se pega a mano mientras no esté conectado Google Calendar." />}
      {interviews
        .slice()
        .reverse()
        .map((iv) => (
          <InterviewCard key={iv.id} interview={iv} applicationId={application.id} staff={staff} />
        ))}
    </div>
  );
}

function InterviewCard({ interview: iv, applicationId, staff }: { interview: Interview; applicationId: string; staff: StaffOption[] }) {
  const findings = asArray<InterviewFinding>(iv.findings);
  // "Realizada" trae notas y calificación del entrevistador; "Analizada", además, los hallazgos de la IA
  const analyzed = iv.status === "analyzed" || iv.status === "completed";
  const when = utcIsoToZoned(iv.scheduled_at);

  return (
    <Card
      title={INTERVIEW_TYPE_LABELS[iv.type]}
      subtitle={fmtDateTime(iv.scheduled_at)}
      action={<Pill tone={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABELS[iv.status]}</Pill>}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Field label="Duración" value={`${iv.duration_min} min`} />
        <Field label="Plataforma" value={iv.platform === "meet" ? "Google Meet" : "Zoom"} />
        <Field label={iv.type === "client" ? "Entrevista" : "Entrevistador"} value={iv.client_interviewer_name ?? (iv.interviewer_user_id ? (staff.find((u) => u.id === iv.interviewer_user_id)?.full_name ?? "Reclutador Prime") : "—")} />
        <div>
          <dt className="text-xs text-ink-muted">Enlace</dt>
          <dd className="mt-0.5">
            {iv.meeting_url ? (
              <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-forest hover:underline">
                Abrir <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-ink-faint">—</span>
            )}
          </dd>
        </div>
      </dl>

      {analyzed && (
        <div className="mt-5 flex flex-col gap-5 border-t border-line pt-5 sm:flex-row">
          {iv.score !== null && (
            <div className="shrink-0">
              <Ring value={iv.score} size={88} tone={iv.score >= 75 ? "leaf" : iv.score >= 60 ? "amber" : "danger"} label="score" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {iv.summary && <p className="text-sm text-ink">{iv.summary}</p>}
            {findings.length > 0 && (
              <ul className="mt-4 space-y-3">
                {findings.map((f, i) => (
                  <li key={i} className="flex gap-3">
                    {f.ok ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-label="Cumple" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="No cumple" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{f.criterion}</p>
                      <p className="text-sm text-ink-muted">{f.evidence}</p>
                      {f.quote && (
                        <p className="mt-1 text-sm italic text-ink-muted">
                          “{f.quote}”{f.at && <span className="ml-1 not-italic text-xs text-ink-faint">{f.at}</span>}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!analyzed && (iv.status === "recorded" || iv.status === "transcribed") && (
        <p className="mt-4 text-sm text-ink-muted">Grabación recibida; el análisis de Claude aparece aquí cuando termina.</p>
      )}

      <InterviewActions
        applicationId={applicationId}
        interview={{ id: iv.id, status: iv.status, date: when.date, time: when.time, meetingUrl: iv.meeting_url, summary: iv.summary, score: iv.score }}
      />
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
