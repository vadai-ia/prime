"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
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
import { daysLabel } from "@/lib/format";

const DRAG_TYPE = "application/x-prime-application";

/**
 * Tablero del pipeline. Las tarjetas se arrastran entre columnas, hacia adelante o hacia atrás;
 * el cambio pasa por la misma acción que el botón de la ficha (queda en la línea de tiempo, y
 * RLS decide si ese candidato es tuyo). Descartar no se hace aquí: pide motivo, va en la ficha.
 * La columna Contratado no participa: ni se arrastra desde ella ni se suelta en ella. Contratar lo
 * hace el Vo.Bo. del cliente (o "Avanzar" en la ficha) y cancelarlo, el botón de la ficha con motivo.
 */
export function Kanban({ rows, onlyStage }: { rows: PipelineRow[]; onlyStage?: Stage }) {
  const stages: Stage[] = onlyStage ? [onlyStage] : PIPELINE_STAGES;
  // La tarjeta salta de columna al soltarla; si el servidor la rechaza, regresa sola al terminar la transición.
  const [board, moveCard] = useOptimistic(rows, (current, move: { id: string; stage: Stage }) =>
    current.map((r) => (r.application_id === move.id ? { ...r, stage: move.stage, days_in_stage: 0 } : r)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<{ id: string; from: Stage } | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);

  function drop(e: DragEvent, to: Stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragging?.id;
    const from = dragging?.from;
    setOver(null);
    setDragging(null);
    if (!id || !from || from === to) return;

    setError(null);
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

  return (
    <div>
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

function KanbanCard({ row, isDragging, onDragStart, onDragEnd }: { row: PipelineRow; isDragging: boolean; onDragStart: (e: DragEvent) => void; onDragEnd: () => void }) {
  const cvTone = row.cv_score !== null && row.cv_threshold !== null ? (row.cv_score >= row.cv_threshold ? "mint" : "amber") : "neutral";
  const showDocs = (row.docs_validated ?? 0) > 0 || row.stage === "documents";
  const movable = row.stage !== "hired";

  return (
    <Link
      href={`/candidatos/${row.application_id}`}
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      className={`block rounded-lg border border-line bg-surface p-3 shadow-sm transition hover:border-leaf hover:shadow ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""}`}
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
      </div>
    </Link>
  );
}
