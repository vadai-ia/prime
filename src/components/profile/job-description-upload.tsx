"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { readJobDescription } from "@/actions/intakes";
import { alertErrorClass, alertSuccessClass } from "@/components/ui/form";
import type { IntakeForm } from "@/lib/domain/json";

type Position = Omit<IntakeForm, "company">;

/**
 * "Subir descriptivo" arriba del levantamiento: Claude lee el D.P. del cliente (PDF o Word) y el formulario
 * llena las secciones II a VII. `onRead` decide qué se llena (solo lo vacío) y devuelve cuántos campos.
 */
export function JobDescriptionUpload({ onRead }: { onRead: (form: Position) => number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string; warning?: string } | null>(null);

  function read(file: File) {
    setResult(null);
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      const res = await readJobDescription(data);
      if (inputRef.current) inputRef.current.value = "";
      if (!res.ok) {
        setResult({ error: res.error });
        return;
      }
      const filled = onRead(res.form);
      setResult({
        message:
          filled > 0
            ? `Se llenaron ${filled} ${filled === 1 ? "campo" : "campos"} de los pasos 2 a 7 con «${file.name}». Lo que ya habías capturado se quedó igual. Revisa cada paso antes de guardar.`
            : "El documento no trae datos para los campos que faltan. Lo que ya habías capturado se quedó igual.",
        warning: res.isJobDescription ? undefined : "Este documento no parece un descriptivo de puesto. Revisa lo que se llenó.",
      });
    });
  }

  return (
    <div className="space-y-3 rounded-card border border-dashed border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="size-5 shrink-0 text-forest" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-ink">
          ¿El cliente mandó su descriptivo de puesto? Súbelo y la IA llena el levantamiento.
          <span className="block text-xs text-ink-muted">PDF (también escaneado) o Word .docx, hasta 4 MB. Tarda de 20 a 60 segundos.</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read(file);
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Leyendo…" : "Subir descriptivo"}
        </button>
      </div>
      {result?.error && (
        <p role="alert" className={alertErrorClass}>
          {result.error}
        </p>
      )}
      {result?.message && (
        <p role="status" className={alertSuccessClass}>
          {result.message}
        </p>
      )}
      {result?.warning && (
        <p role="status" className="rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          {result.warning}
        </p>
      )}
    </div>
  );
}
