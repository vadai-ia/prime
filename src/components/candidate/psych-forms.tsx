"use client";

import { useActionState, useRef } from "react";
import { FileText, Upload } from "lucide-react";
import { registerPsychReport, savePsychResult, savePsychSent, startPsychUpload } from "@/actions/psychometrics";
import { PSYCH_VERDICT_LABELS } from "@/lib/labels";
import { inputClass, labelClass } from "@/components/ui/form";
import type { Enums } from "@/lib/db/types";
import { useTicketUpload } from "./use-ticket-upload";

const VERDICTS = Object.keys(PSYCH_VERDICT_LABELS) as Enums<"psych_verdict">[];
const smallButton = "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60";

type Props = {
  applicationId: string;
  testLink: string | null;
  dueDate: string; // AAAA-MM-DD en la zona de la app, o ""
  hasReport: boolean;
  verdict: Enums<"psych_verdict"> | null;
  fitPct: number | null;
};

/** Captura manual del psicométrico: Psicotest no tiene API, así que el reclutador registra el enlace, sube el PDF y captura el veredicto. */
export function PsychManual({ applicationId, testLink, dueDate, hasReport, verdict, fitPct }: Props) {
  const [sent, sentAction, sentPending] = useActionState(savePsychSent, undefined);
  const [result, resultAction, resultPending] = useActionState(savePsychResult, undefined);
  const input = useRef<HTMLInputElement>(null);
  const { state: up, busy, upload } = useTicketUpload("psychometrics");

  return (
    <div className="space-y-5 text-sm">
      <form action={sentAction} className="space-y-2">
        <input type="hidden" name="application_id" value={applicationId} />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">1. Enlace enviado</p>
        <label className={labelClass}>
          Enlace de Psicotest
          <input name="test_link" type="url" required defaultValue={testLink ?? ""} placeholder="https://psicotest.mx/…" className={inputClass} />
        </label>
        <label className={labelClass}>
          Fecha límite
          <input name="due_date" type="date" defaultValue={dueDate} className={inputClass} />
        </label>
        <button type="submit" disabled={sentPending} className={smallButton}>
          {sentPending ? "Guardando…" : "Guardar enlace"}
        </button>
        {sent?.error && <p role="alert" className="text-xs text-danger">{sent.error}</p>}
      </form>

      <div className="space-y-2 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">2. Reporte en PDF</p>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            upload(file, (meta) => startPsychUpload({ applicationId, ...meta }), (path) => registerPsychReport({ applicationId, path }));
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`inline-flex items-center gap-1.5 ${smallButton}`}>
            <Upload className="h-3.5 w-3.5" />
            {up.status === "uploading" ? "Subiendo…" : up.status === "saving" ? "Guardando…" : hasReport ? "Reemplazar PDF" : "Subir PDF"}
          </button>
          {hasReport && (
            <a href={`/candidatos/${applicationId}/psicometrico`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline">
              <FileText className="h-3.5 w-3.5" /> Ver reporte
            </a>
          )}
        </div>
        {up.status === "error" && <p role="alert" className="text-xs text-danger">{up.message}</p>}
      </div>

      <form action={resultAction} className="space-y-2 border-t border-line pt-4">
        <input type="hidden" name="application_id" value={applicationId} />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">3. Veredicto</p>
        <label className={labelClass}>
          Resultado
          <select name="verdict" required defaultValue={verdict ?? ""} className={inputClass}>
            <option value="" disabled>
              Selecciona…
            </option>
            {VERDICTS.map((v) => (
              <option key={v} value={v}>
                {PSYCH_VERDICT_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Ajuste al perfil (%)
          <input name="fit_pct" type="number" min={0} max={100} defaultValue={fitPct ?? ""} placeholder="Opcional" className={inputClass} />
        </label>
        <button type="submit" disabled={resultPending} className={smallButton}>
          {resultPending ? "Guardando…" : "Guardar veredicto"}
        </button>
        <p className="text-xs text-ink-faint">El veredicto y el ajuste son lo que ve el cliente en su portal; el PDF no.</p>
        {result?.error && <p role="alert" className="text-xs text-danger">{result.error}</p>}
      </form>
    </div>
  );
}
