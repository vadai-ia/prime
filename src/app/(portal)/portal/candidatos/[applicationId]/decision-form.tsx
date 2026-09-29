"use client";

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { decide } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass, inputClass, labelClass } from "@/components/ui/form";

export function DecisionForm({ applicationId, candidateName }: { applicationId: string; candidateName: string }) {
  const [state, action, pending] = useActionState(decide, undefined);

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
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Guardando…" : "Dar Vo.Bo."}
        </Button>
        <Button type="submit" name="decision" value="reject" variant="danger" disabled={pending}>
          <XCircle className="h-4 w-4" />
          No continuar
        </Button>
      </div>
      <p className="text-xs text-ink-faint">Tu decisión se registra con fecha y queda visible para el equipo de Prime.</p>
    </form>
  );
}
