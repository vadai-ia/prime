"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { decide } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass, inputClass, labelClass } from "@/components/ui/form";
import { ControlledModal } from "@/components/ui/modal";

export function DecisionForm({ applicationId, candidateName }: { applicationId: string; candidateName: string }) {
  const [state, action, pending] = useActionState(decide, undefined);
  const [confirming, setConfirming] = useState(false);

  if (state?.ok) {
    return (
      <p className={alertSuccessClass}>
        {state.decision === "approve"
          ? `Registramos tu Vo.Bo. para ${candidateName}. Prime se pondrá en contacto para cerrar la contratación.`
          : `Registramos que ${candidateName} no continúa. Prime te propondrá otro candidato.`}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className={labelClass}>
        Comentario (opcional)
        <textarea name="comment" rows={3} maxLength={500} placeholder="Por ejemplo: nos gustó su experiencia en campo…" className={inputClass} />
      </label>
      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setConfirming(true)} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Guardando…" : "Dar Vo.Bo."}
        </Button>
        <Button type="submit" name="decision" value="reject" variant="danger" disabled={pending}>
          <XCircle className="h-4 w-4" />
          No continuar
        </Button>
      </div>
      <p className="text-xs text-ink-faint">Tu decisión se registra con fecha y queda visible para el equipo de Prime.</p>
      {/* Dentro del form: el botón de confirmar lo envía con decision=approve y el comentario. */}
      <ControlledModal open={confirming} onClose={() => setConfirming(false)} title="¿Dar Vo.Bo.?" subtitle={candidateName}>
        <div className="space-y-4">
          <p className="rounded-lg bg-mint px-3 py-3 text-sm text-forest">
            Con tu Vo.Bo., <strong>{candidateName}</strong> queda como contratado y Prime se pondrá en contacto para cerrar la contratación. Si fue un error, avísale a Prime para corregirlo.
          </p>
          {state?.error && (
            <p role="alert" className={alertErrorClass}>
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              No, regresar
            </Button>
            <Button type="submit" name="decision" value="approve" disabled={pending}>
              {pending ? "Guardando…" : "Sí, dar Vo.Bo."}
            </Button>
          </div>
        </div>
      </ControlledModal>
    </form>
  );
}
