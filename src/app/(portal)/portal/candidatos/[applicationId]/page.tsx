import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalApplication } from "@/lib/queries/portal";
import {
  DOC_STATUS_LABELS,
  DOC_STATUS_TONES,
  INTERVIEW_STATUS_LABELS,
  PSYCH_VERDICT_LABELS,
  PSYCH_VERDICT_TONES,
} from "@/lib/labels";
import { fmtDate, fmtDateLong, fmtDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Pill, StagePill } from "@/components/ui/pill";
import { Ring } from "@/components/ui/ring";
import { Bar } from "@/components/ui/bar";
import { PageHeader } from "@/components/ui/page-header";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Candidato · Portal Prime HR" };

export default async function PortalCandidatePage(props: PageProps<"/portal/candidatos/[applicationId]">) {
  const { applicationId } = await props.params;
  const detail = await getPortalApplication(applicationId);
  if (!detail) notFound();

  const { application: a, documents } = detail;
  const docsRequired = a.docs_required ?? 10;
  const docsValidated = a.docs_validated ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/portal/candidatos"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={a.full_name} size="lg" />
            <span className="flex flex-col gap-1">
              <span>{a.full_name}</span>
              <StagePill stage={a.stage} />
            </span>
          </span>
        }
        subtitle={
          <>
            {a.profile_title} · Postulación del {fmtDateLong(a.applied_at)}
            {a.zone || a.municipality ? ` · ${a.zone ?? a.municipality}` : ""}
            {a.education_level ? ` · ${a.education_level}` : ""}
          </>
        }
      />

      <DecisionPanel application={a} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Entrevista con Prime" subtitle={a.prime_interview_at ? fmtDateTime(a.prime_interview_at) : "Sin fecha registrada"}>
          {a.prime_interview_score !== null || a.prime_interview_summary ? (
            <div className="flex items-start gap-4">
              {a.prime_interview_score !== null && <Ring value={a.prime_interview_score ?? 0} tone="forest" label="Evaluación" />}
              <p className="text-sm text-ink">{a.prime_interview_summary ?? "Sin resumen disponible."}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">La entrevista se realizó y el equipo de Prime está preparando el resumen.</p>
          )}
        </Card>

        <Card title="Psicométrico">
          {a.psych_verdict ? (
            <div className="flex items-center gap-4">
              {a.psych_fit_pct !== null && <Ring value={a.psych_fit_pct ?? 0} tone={PSYCH_VERDICT_TONES[a.psych_verdict]} label="Ajuste al perfil" />}
              <div>
                <Pill tone={PSYCH_VERDICT_TONES[a.psych_verdict]}>{PSYCH_VERDICT_LABELS[a.psych_verdict]}</Pill>
                <p className="mt-2 text-sm text-ink-muted">Resultado de la evaluación contra los mínimos definidos para la vacante.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">En proceso. Te avisamos cuando tengamos el resultado.</p>
          )}
        </Card>

        <Card title="Expediente" subtitle={`${docsValidated} de ${docsRequired} documentos validados`}>
          <Bar value={docsValidated} max={docsRequired} tone={docsValidated >= docsRequired ? "forest" : "leaf"} />
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Aún no hemos recibido documentos.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-line">
                {documents.map((d) => (
                  <tr key={`${d.application_id}-${d.document_type_key}`}>
                    <td className="py-2 pr-2 text-ink">
                      {d.label}
                      {d.required === false && <span className="ml-1 text-xs text-ink-faint">(opcional)</span>}
                    </td>
                    <td className="py-2 pr-2 text-right">{d.status && <Pill tone={DOC_STATUS_TONES[d.status]}>{DOC_STATUS_LABELS[d.status]}</Pill>}</td>
                    <td className="py-2 text-right text-xs text-ink-faint">{d.validated_at ? fmtDate(d.validated_at) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-faint">Los documentos los resguarda Prime; aquí solo ves su estado.</p>
        </Card>

        <Card title="Entrevista con tu equipo">
          {a.client_interview_at ? (
            <div className="space-y-2 text-sm">
              <p className="text-ink">{fmtDateTime(a.client_interview_at)}</p>
              {a.client_interview_status && <Pill tone="info">{INTERVIEW_STATUS_LABELS[a.client_interview_status]}</Pill>}
              {a.client_interview_url && (
                <p>
                  <a href={a.client_interview_url} target="_blank" rel="noopener noreferrer" className="text-forest underline-offset-2 hover:underline">
                    Abrir enlace de la videollamada
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              {a.stage === "client_interview" ? "Prime está coordinando la fecha con tu equipo." : "Se agenda cuando el candidato complete su expediente."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function DecisionPanel({ application: a }: { application: NonNullable<Awaited<ReturnType<typeof getPortalApplication>>>["application"] }) {
  if (a.client_decision) {
    const approved = a.client_decision === "approve";
    return (
      <Card title={approved ? "Diste tu Vo.Bo." : "Decidiste no continuar"}>
        <p className="text-sm text-ink">
          {approved ? (
            <>
              Registrado el {fmtDateLong(a.client_decision_at)}.
              {a.hired_at ? ` Contratación confirmada el ${fmtDateLong(a.hired_at)}.` : " Prime está cerrando la contratación."}
            </>
          ) : (
            <>Registrado el {fmtDateLong(a.client_decision_at)}. Prime te propondrá otro candidato.</>
          )}
        </p>
      </Card>
    );
  }

  if (a.stage === "client_interview") {
    return (
      <Card title="Tu decisión" subtitle="Cuando hayas entrevistado al candidato, indícanos si continúa.">
        <DecisionForm applicationId={a.application_id ?? ""} candidateName={a.full_name ?? "el candidato"} />
      </Card>
    );
  }

  if (a.stage === "discarded") {
    return (
      <div className="rounded-card border border-line bg-canvas px-5 py-4 text-sm text-ink-muted">
        Este candidato no continuó en el proceso{a.stage_changed_at ? ` (${fmtDateLong(a.stage_changed_at)})` : ""}.
      </div>
    );
  }

  return null;
}
