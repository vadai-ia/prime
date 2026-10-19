"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { scoreCv } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { alertErrorClass } from "@/components/ui/form";

/** "Calificar CV" o "Recalificar": corre la IA contra los pesos vigentes de la vacante. */
export function ScoreCvButton({ applicationId, scored }: { applicationId: string; scored: boolean }) {
  const [state, action, pending] = useActionState(scoreCv, undefined);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="application_id" value={applicationId} />
      <Button type="submit" variant={scored ? "secondary" : "primary"} disabled={pending}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {pending ? "Calificando…" : scored ? "Recalificar" : "Calificar CV"}
      </Button>
      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}
    </form>
  );
}
