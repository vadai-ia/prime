"use client";

import { ControlledModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/form";
import { STAGE_LABELS, type Stage } from "@/lib/labels";

/**
 * Aviso antes de sacar a alguien de Contratado (ficha o tablero). La base le quita el distintivo
 * (0034) y borra fecha de contratación, decisión del cliente y seguimientos pendientes (0018).
 */
export function LeaveHiredDialog({
  open,
  onClose,
  name,
  applicationId,
  to,
  action,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  applicationId: string;
  to: Stage;
  action: (formData: FormData) => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <ControlledModal open={open} onClose={onClose} title="¿Sacar de Contratados?" subtitle={name}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="stage" value={to} />
        <div className="rounded-lg bg-amber-soft px-3 py-3 text-sm text-amber">
          <p className="font-semibold">Lo sacarás de Contratados y se le quitará el distintivo de contratado.</p>
          <p className="mt-1">
            Regresa a <strong>{STAGE_LABELS[to]}</strong>. Se borran la fecha de contratación, la decisión del cliente y los seguimientos pendientes. La línea de tiempo conserva todo.
          </p>
        </div>
        <label className={labelClass}>
          Motivo
          <textarea name="reason" rows={3} maxLength={500} required placeholder="No se presentó el primer día, declinó la oferta, el cliente cambió de opinión…" className={inputClass} />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            No, dejarlo
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? "Guardando…" : "Sí, sacarlo de Contratados"}
          </Button>
        </div>
      </form>
    </ControlledModal>
  );
}
