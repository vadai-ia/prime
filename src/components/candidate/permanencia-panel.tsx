import type { Tables } from "@/lib/db/types";
import { FOLLOWUP_OUTCOME_LABELS, FOLLOWUP_OUTCOME_TONES } from "@/lib/labels";
import { fmtDay } from "@/lib/format";
import { Pill } from "@/components/ui/pill";
import { FollowupForm } from "./followup-form";

/** En la ficha de un contratado: los tres cortes de permanencia y su captura. */
export function PermanenciaPanel({ applicationId, rows }: { applicationId: string; rows: Tables<"placement_followups">[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-forest">Permanencia</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {rows.map((f) => (
          <li key={f.id} className="flex flex-col gap-2 rounded-lg border border-line bg-canvas/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">{f.checkpoint_days} días</p>
              <Pill tone={FOLLOWUP_OUTCOME_TONES[f.outcome]}>{FOLLOWUP_OUTCOME_LABELS[f.outcome]}</Pill>
            </div>
            <p className="text-xs text-ink-muted">
              {f.outcome === "left" ? `Salió el ${fmtDay(f.left_at, { year: "numeric" })}${f.left_reason ? `: ${f.left_reason}` : ""}` : `Corte el ${fmtDay(f.due_at, { year: "numeric" })}`}
            </p>
            {f.notes && <p className="text-xs text-ink-muted">{f.notes}</p>}
            <div>
              <FollowupForm followupId={f.id} applicationId={applicationId} current={f.outcome} leftAt={f.left_at} leftReason={f.left_reason} notes={f.notes} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
