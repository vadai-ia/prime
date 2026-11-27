"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { setStage } from "@/actions/applications";
import {
  CHANNEL_LABELS,
  PIPELINE_STAGES,
  PREFILTER_LABELS,
  PREFILTER_TONES,
  PSYCH_VERDICT_LABELS,
  PSYCH_VERDICT_TONES,
  STAGE_LABELS,
  type Stage,
} from "@/lib/labels";
import type { PipelineRow } from "@/lib/queries/types";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { daysLabel, fmtDate, fmtTime } from "@/lib/format";
import { HiredBadge } from "@/components/candidate/hired-badge";
import { LeaveHiredDialog } from "@/components/candidate/leave-hired-dialog";
import { dayIndex } from "@/lib/metrics";

const DRAG_TYPE = "application/x-prime-application";

/**
 * Tablero del pipeline. Las tarjetas se arrastran entre columnas, hacia adelante o hacia atrás;
 * el cambio pasa por la misma acción que el botón de la ficha (queda en la línea de tiempo, y
 * RLS decide si ese candidato es tuyo). Descartar no se hace aquí: pide motivo, va en la ficha.
 * En la columna Contratado no se suelta: contratar lo hace el Vo.Bo. del cliente (o "Avanzar" en la
 * ficha). Sí se puede arrastrar desde ella, pero antes sale un aviso con motivo: se le quita el
 * distintivo de contratado (0034) y se borra lo que la contratación había fijado (0018).
 */
export function Kanban({ rows, onlyStage }: { rows: PipelineRow[]; onlyStage?: Stage }) {
  const stages: Stage[] = onlyStage ? [onlyStage] : PIPELINE_STAGES;
  // La tarjeta salta de columna al soltarla; si el servidor la rechaza, regresa sola al terminar la transición.
  const [board, moveCard] = useOptimistic(rows, (current, move: { id: string; stage: Stage }) =>
    current.map((r) => (r.application_id === move.id ? { ...r, stage: move.stage, days_in_stage: 0 } : r)),
  );
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState<{ id: string; to: Stage; name: string } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; from: Stage } | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hoy en la zona de México, para "Hoy"/"Mañana" en la entrevista de cada tarjeta.
  const [today] = useState(() => dayIndex(new Date()));

  function drop(e: DragEvent, to: Stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragging?.id;
    const from = dragging?.from;
    setOver(null);
    setDragging(null);
    if (!id || !from || from === to) return;

    setError(null);
    if (from === "hired") {
      setLeaving({ id, to, name: board.find((r) => r.application_id === id)?.full_name ?? "" });
      return;
    }
    startTransition(async () => {
      moveCard({ id, stage: to });
      const form = new FormData();
      form.set("applicationId", id);
      form.set("stage", to);
      form.set("reason", PIPELINE_STAGES.indexOf(to) < PIPELINE_STAGES.indexOf(from) ? `Regresó de ${STAGE_LABELS[from]} (tablero)` : "Movido en el tablero");
      const result = await setStage(undefined, form);
      if (result?.error) setError(result.error);
    });
  }

  function leaveHired(form: FormData) {
    const move = leaving;
    if (!move) return;
    setLeaving(null);
    startTransition(async () => {
      moveCard({ id: move.id, stage: move.to });
      const result = await setStage(undefined, form);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      {leaving && (
        <LeaveHiredDialog open onClose={() => setLeaving(null)} name={leaving.name} applicationId={leaving.id} to={leaving.to} action={leaveHired} pending={pending} />
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
          No se pudo mover: {error}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = board.filter((r) => r.stage === stage);
          const target = dragging !== null && dragging.from !== stage && stage !== "hired";
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                if (!target) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== stage) setOver(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((s) => (s === stage ? null : s));
              }}
              onDrop={(e) => drop(e, stage)}
              className={`flex w-64 shrink-0 flex-col rounded-card border transition ${over === stage && target ? "border-leaf bg-mint" : "border-line bg-canvas"}`}
            >
              <header className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{STAGE_LABELS[stage]}</h3>
                <span className="rounded-full border border-line bg-surface px-2 text-xs text-ink-muted">{cards.length}</span>
              </header>
              <div className="flex min-h-16 flex-col gap-2 px-2 pb-2">
                {cards.map((row) => (
                  <KanbanCard
                    key={row.application_id}
                    row={row}
                    today={today}
                    isDragging={dragging?.id === row.application_id}
                    onDragStart={(e) => {
                      if (!row.application_id || !row.stage) return;
                      e.dataTransfer.setData(DRAG_TYPE, row.application_id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging({ id: row.application_id, from: row.stage });
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-ink-faint">{target ? "Suelta aquí" : stage === "hired" && dragging ? "Se contrata desde la ficha o el portal" : "Sin candidatos"}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const LIVE = new Set(["scheduled", "confirmed"]);

/**
 * Entrevistas agendadas del candidato (Prime y con cliente), en cualquier etapa: "Entrevista Prime ·
 * Mañana 10:00". Las que ya pasaron y nadie cerró salen en ámbar para que se marquen en la ficha.
 */
function interviewBadges(row: PipelineRow, today: number) {
  const items = [
    { kind: "Prime", at: row.prime_interview_at, status: row.prime_interview_status },
    { kind: "Cliente", at: row.client_interview_at, status: row.client_interview_status },
  ].filter((i): i is { kind: string; at: string; status: NonNullable<typeof i.status> } => !!i.at && !!i.status && LIVE.has(i.status));
  return items
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((i) => {
      const d = dayIndex(i.at) - today;
      const when = d === 0 ? "Hoy" : d === 1 ? "Mañana" : fmtDate(i.at, { weekday: "short", day: "numeric", month: "short" });
      return {
        key: i.kind,
        tone: (d < 0 ? "amber" : d === 0 ? "forest" : "info") as "amber" | "forest" | "info",
        text: d < 0 ? `${i.kind} · ${fmtDate(i.at)} · sin cerrar` : `${i.kind} · ${when} ${fmtTime(i.at)}`,
        title: d < 0 ? `Entrevista ${i.kind === "Prime" ? "Prime" : "con cliente"}: ya pasó y sigue como agendada: márcala como realizada, no se presentó o cancelada en la ficha.` : `Entrevista ${i.kind === "Prime" ? "Prime" : "con cliente"} ${i.status === "confirmed" ? "confirmada" : "agendada"}: ${fmtDate(i.at, { weekday: "long", day: "numeric", month: "long" })} a las ${fmtTime(i.at)}`,
      };
    });
}

function KanbanCard({ row, today, isDragging, onDragStart, onDragEnd }: { row: PipelineRow; today: number; isDragging: boolean; onDragStart: (e: DragEvent) => void; onDragEnd: () => void }) {
  const interviews = interviewBadges(row, today);
  const cvTone = row.cv_score !== null && row.cv_threshold !== null ? (row.cv_score >= row.cv_threshold ? "mint" : "amber") : "neutral";
  const showDocs = (row.docs_validated ?? 0) > 0 || row.stage === "documents";

  return (
    <Link
      href={`/candidatos/${row.application_id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`block rounded-lg border border-line bg-surface p-3 shadow-sm transition hover:border-leaf hover:shadow cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Avatar name={row.full_name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{row.full_name}</p>
          <p className="truncate text-xs text-ink-muted">
            {row.profile_title} · {row.client_name}
          </p>
        </div>
        {row.wa_ai_paused && <span title="IA pausada" aria-label="IA pausada" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />}
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        {row.source_channel ? CHANNEL_LABELS[row.source_channel] : "—"} · {daysLabel(row.days_in_stage)} en etapa
      </p>
      {interviews.length > 0 && (
        <div className="mt-2 flex flex-col items-start gap-1">
          {interviews.map((i) => (
            <span key={i.key} title={i.title}>
              <Pill tone={i.tone}>
                <CalendarClock className="h-3 w-3" aria-hidden />
                {i.text}
              </Pill>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {row.cv_score !== null && <Pill tone={cvTone}>CV {row.cv_score}</Pill>}
        {(row.prefilter_status === "exception" || row.prefilter_status === "in_progress") && (
          <Pill tone={PREFILTER_TONES[row.prefilter_status]}>{PREFILTER_LABELS[row.prefilter_status]}</Pill>
        )}
        {row.psych_verdict && <Pill tone={PSYCH_VERDICT_TONES[row.psych_verdict]}>{PSYCH_VERDICT_LABELS[row.psych_verdict]}</Pill>}
        {showDocs && (
          <Pill tone={(row.docs_validated ?? 0) >= (row.docs_required ?? 0) ? "mint" : "neutral"}>
            {row.docs_validated}/{row.docs_required} docs
          </Pill>
        )}
        {row.wa_ai_paused && <Pill tone="danger">IA pausada</Pill>}
        <HiredBadge badgeAt={row.hired_badge_at} hiredApplicationId={row.hired_application_id} applicationId={row.application_id} />
      </div>
    </Link>
  );
}
