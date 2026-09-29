import Link from "next/link";
import { History } from "lucide-react";
import type { CandidateHistoryRow } from "@/lib/queries/types";
import { DISCARD_REASON_LABELS } from "@/lib/labels";
import { fmtDate, timeAgo } from "@/lib/format";
import { StagePill } from "@/components/ui/pill";

/**
 * Otras postulaciones de la misma persona ("ya se envió a X cliente hace 2 meses").
 * Las ajenas se ven como texto; solo las propias (o todas, si es admin) llevan enlace.
 */
export function CandidateHistory({ rows, currentApplicationId }: { rows: CandidateHistoryRow[]; currentApplicationId?: string }) {
  const others = rows.filter((r) => r.application_id !== currentApplicationId);
  if (others.length === 0) return null;

  return (
    <section className="rounded-card border border-amber/40 bg-amber-soft px-5 py-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <History className="h-4 w-4 text-amber" />
        {currentApplicationId
          ? `Esta persona tiene ${others.length === 1 ? "otra postulación" : `otras ${others.length} postulaciones`}`
          : `Este teléfono ya está registrado: ${others.length === 1 ? "1 postulación" : `${others.length} postulaciones`}`}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {others.map((r) => (
          <li key={r.application_id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {r.is_mine ? (
              <Link href={`/candidatos/${r.application_id}`} className="font-medium text-forest hover:underline">
                {r.profile_title}
              </Link>
            ) : (
              <span className="font-medium text-ink">{r.profile_title}</span>
            )}
            <span className="text-ink-muted">· {r.client_name}</span>
            <StagePill stage={r.stage} />
            {r.stage === "discarded" && r.discard_reason_key && <span className="text-xs text-ink-muted">{DISCARD_REASON_LABELS[r.discard_reason_key]}</span>}
            <span className="text-xs text-ink-muted">
              · postuló el {fmtDate(r.applied_at, { day: "numeric", month: "short", year: "numeric" })} ({timeAgo(r.applied_at)})
            </span>
            {r.recruiter_name && <span className="text-xs text-ink-faint">· {r.recruiter_name}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
