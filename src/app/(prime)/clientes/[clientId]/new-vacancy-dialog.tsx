"use client";

import { useRef } from "react";
import { IntakeForm, type LockedClient } from "../../perfiles/levantamiento/intake-form";
import type { RecruiterOption } from "@/lib/queries/assignments";

/** "+" junto a Vacantes en la ficha del cliente: abre el levantamiento con la empresa ya fija. */
export function NewVacancyDialog({ client, recruiters }: { client: LockedClient; recruiters: RecruiterOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Nueva vacante para ${client.name}`}
        title="Nueva vacante"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-lg leading-none text-on-forest transition hover:bg-forest-deep"
      >
        +
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="new-vacancy-title"
        className="m-auto w-full max-w-4xl rounded-card border border-line bg-canvas p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
          <div>
            <h2 id="new-vacancy-title" className="text-base font-semibold text-ink">
              Nueva vacante · {client.name}
            </h2>
            <p className="text-xs text-ink-muted">Levantamiento, secciones I a VII.</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar" className="rounded-lg px-2 py-1 text-xl leading-none text-ink-muted transition hover:bg-canvas hover:text-ink">
            ×
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <IntakeForm clients={[client]} canCreateProfile lockedClient={client} recruiters={recruiters} />
        </div>
      </dialog>
    </>
  );
}
