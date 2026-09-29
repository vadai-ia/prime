import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHANNEL_LABELS, PREFILTER_LABELS, PREFILTER_TONES, PSYCH_VERDICT_LABELS, PSYCH_VERDICT_TONES } from "@/lib/labels";
import type { PipelineRow } from "@/lib/queries/types";
import { Avatar } from "@/components/ui/avatar";
import { Pill, StagePill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { daysLabel, fmtPhone, timeAgo } from "@/lib/format";

const th = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "px-3 py-3 align-middle";

export function PipelineList({ rows }: { rows: PipelineRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <EmptyState title="Sin candidatos con estos filtros" hint="Cambia los filtros o carga candidatos nuevos." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-sm">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b border-line bg-canvas">
          <tr>
            <th className={th}>Candidato</th>
            <th className={th}>Vacante</th>
            <th className={th}>Etapa</th>
            <th className={th}>Canal</th>
            <th className={th}>CV</th>
            <th className={th}>Prefiltro</th>
            <th className={th}>Psicométrico</th>
            <th className={th}>Expediente</th>
            <th className={th}>En etapa</th>
            <th className={th}>Último WhatsApp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const href = `/candidatos/${row.application_id}`;
            const cvTone = row.cv_score !== null && row.cv_threshold !== null ? (row.cv_score >= row.cv_threshold ? "mint" : "amber") : "neutral";
            return (
              <tr key={row.application_id} onClick={() => router.push(href)} className="cursor-pointer transition hover:bg-canvas">
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <Avatar name={row.full_name} size="sm" />
                    <div className="min-w-0">
                      <Link href={href} className="block truncate font-medium text-ink hover:text-forest" onClick={(e) => e.stopPropagation()}>
                        {row.full_name}
                      </Link>
                      <p className="text-xs text-ink-muted">{fmtPhone(row.phone_e164)}</p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <p className="text-ink">{row.profile_title}</p>
                  <p className="text-xs text-ink-muted">{row.client_name}</p>
                </td>
                <td className={td}>
                  <StagePill stage={row.stage} />
                </td>
                <td className={`${td} text-ink-muted`}>{row.source_channel ? CHANNEL_LABELS[row.source_channel] : "—"}</td>
                <td className={td}>{row.cv_score !== null ? <Pill tone={cvTone}>{row.cv_score}</Pill> : <span className="text-ink-faint">—</span>}</td>
                <td className={td}>
                  {row.prefilter_status ? <Pill tone={PREFILTER_TONES[row.prefilter_status]}>{PREFILTER_LABELS[row.prefilter_status]}</Pill> : "—"}
                </td>
                <td className={td}>
                  {row.psych_verdict ? (
                    <Pill tone={PSYCH_VERDICT_TONES[row.psych_verdict]}>{PSYCH_VERDICT_LABELS[row.psych_verdict]}</Pill>
                  ) : row.psych_status === "sent" ? (
                    <Pill tone="info">Enviado</Pill>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className={`${td} text-ink-muted`}>
                  {(row.docs_validated ?? 0) > 0 || row.stage === "documents" ? `${row.docs_validated}/${row.docs_required}` : "—"}
                </td>
                <td className={`${td} text-ink-muted`}>{daysLabel(row.days_in_stage)}</td>
                <td className={`${td} text-ink-muted`}>
                  {row.wa_last_inbound_at ? timeAgo(row.wa_last_inbound_at) : "—"}
                  {row.wa_ai_paused && (
                    <Pill tone="danger" className="ml-2">
                      IA pausada
                    </Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
