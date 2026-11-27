"use client";

import { ControlledModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Confirmación antes de pasar a alguien a Contratado desde la ficha. La base le pone el distintivo
 * (0034), fija la fecha de contratación y programa los seguimientos a 30, 90 y 180 días (0013).
 * Si fue un error, se corrige con "Cancelar contratación", que deshace todo eso.
 */
export function HireConfirmDialog({
  open,
  onClose,
  name,
  applicationId,
  action,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  applicationId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <ControlledModal open={open} onClose={onClose} title="¿Marcar como contratado?" subtitle={name}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="stage" value="hired" />
        <input type="hidden" name="reason" value="Contratado desde la ficha" />
        <div className="rounded-lg bg-mint px-3 py-3 text-sm text-forest">
          <p className="font-semibold">{name} pasará a Contratado y se le pondrá el distintivo de contratado.</p>
          <p className="mt-1">Se fija hoy como fecha de contratación y se programan los seguimientos a 30, 90 y 180 días.</p>
        </div>
        <p className="text-xs text-ink-muted">Si te equivocas, se corrige con &quot;Cancelar contratación&quot; en esta ficha: regresa a Entrevista con cliente y se le quita el distintivo.</p>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            No, todavía no
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Sí, está contratado"}
          </Button>
        </div>
      </form>
    </ControlledModal>
  );
}
