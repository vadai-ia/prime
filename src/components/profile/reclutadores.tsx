import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { fmtDateTime } from "@/lib/format";
import { ASSIGNMENT_SOURCE_LABELS } from "@/lib/labels";
import type { ProfileRecruiters } from "@/lib/queries/types";
import { RecruiterChecklist } from "./recruiter-checklist";

/** Pestaña "Reclutadores" del perfil (solo admin): quién trabaja la vacante y el historial de cambios. */
export function Reclutadores({ profileId, data }: { profileId: string; data: ProfileRecruiters }) {
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card
        className="lg:col-span-3"
        title="Quién trabaja esta vacante"
        subtitle="Los reclutadores marcados ven esta vacante, su cliente y a todos sus candidatos."
      >
        <RecruiterChecklist profileId={profileId} recruiters={data.recruiters} />
      </Card>

      <Card className="lg:col-span-2" title="Historial" subtitle="Quién asignó o quitó a quién, y cuándo." padded={false}>
        {data.history.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">Sin cambios todavía.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.history.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{e.recruiter_name || "Usuario eliminado"}</p>
                  <p className="text-xs text-ink-muted">
                    {e.actor_name ?? "Sistema"} · {fmtDateTime(e.created_at)}
                    {e.source !== "manual" && <> · {ASSIGNMENT_SOURCE_LABELS[e.source]}</>}
                  </p>
                </div>
                <Pill tone={e.action === "assigned" ? "mint" : "neutral"}>{e.action === "assigned" ? "Asignado" : "Quitado"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
