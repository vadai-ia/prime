"use client";

import { useActionState, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { registerDocument, reviewDocument, startDocumentUpload } from "@/actions/documents";
import { useTicketUpload } from "./use-ticket-upload";

const ACCEPT = { pdf: "application/pdf", image: "image/jpeg,image/png,image/webp" } as const;

/** Carga manual de un documento del expediente cuando el candidato lo entrega por otro medio que no es WhatsApp. */
export function DocumentUpload({ applicationId, documentTypeKey, accepts }: { applicationId: string; documentTypeKey: string; accepts: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const { state, busy, upload } = useTicketUpload("documents");
  const accept = accepts.flatMap((a) => (a === "pdf" || a === "image" ? [ACCEPT[a]] : [])).join(",");

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          upload(
            file,
            (meta) => startDocumentUpload({ applicationId, documentTypeKey, ...meta }),
            (path) => registerDocument({ applicationId, documentTypeKey, path, mime: file!.type, size: file!.size }),
          );
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" />
        {state.status === "uploading" ? "Subiendo…" : state.status === "saving" ? "Guardando…" : "Subir"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 max-w-56 text-[11px] text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

/** Validar o rechazar (con motivo) un documento recibido. */
export function DocumentReview({ applicationId, documentId }: { applicationId: string; documentId: string }) {
  const [state, action, pending] = useActionState(reviewDocument, undefined);
  const [rejecting, setRejecting] = useState(false);

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="document_id" value={documentId} />
      {rejecting ? (
        <>
          <input name="reason" type="text" required minLength={3} maxLength={300} autoFocus placeholder="Motivo: ilegible, vencido, no coincide…" className="block w-56 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
          <div className="flex gap-1.5">
            <button type="submit" name="decision" value="reject" disabled={pending} className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger transition hover:bg-danger hover:text-white disabled:opacity-60">
              {pending ? "Guardando…" : "Rechazar"}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-2.5 py-1.5 text-xs text-ink-muted hover:bg-canvas">
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-1.5">
          <button type="submit" name="decision" value="validate" disabled={pending} className="rounded-lg bg-mint px-2.5 py-1.5 text-xs font-medium text-forest transition hover:bg-forest hover:text-on-forest disabled:opacity-60">
            {pending ? "Guardando…" : "Validar"}
          </button>
          <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-canvas">
            Rechazar
          </button>
        </div>
      )}
      {state?.error && (
        <p role="alert" className="max-w-56 text-[11px] text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
