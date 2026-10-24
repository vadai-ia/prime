"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { alertErrorClass } from "@/components/ui/form";

// Formulario de vacante por pasos (levantamiento nuevo y edición): barra de avance, secciones como pestañas
// y navegación anterior/siguiente. Cada sección es un <fieldset data-step={n}>; las ocultas se siguen enviando.

// Campos que el prefiltro y la evaluación necesitan; si faltan, se avisa sin bloquear el guardado.
const KEY_FIELDS: [name: string, label: string][] = [
  ["cond_salary", "sueldo"],
  ["cond_schedule", "horario"],
  ["work_zone", "zona de trabajo"],
  ["spec_age", "edad"],
  ["req_experience", "experiencia"],
  ["req_education", "escolaridad"],
];

// Obligatorios = el nombre del puesto (sin él no se guarda) más los campos clave.
const REQUIRED = new Set(["title", ...KEY_FIELDS.map(([name]) => name)]);

function listLabel(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? "");
}

type StepStatus = { filled: number; missingRequired: number };
type Progress = { filled: number; total: number; requiredDone: number; missing: string[]; steps: Record<number, StepStatus> };

/**
 * Avance del llenado sobre todos los campos capturables (sin selectores marcados con data-skip-progress ni ocultos).
 * `overrides` cubre campos que cambian de valor y todavía no se pintan.
 */
function measure(form: HTMLFormElement, overrides: Record<string, string> = {}): Progress {
  const fields = Array.from(form.elements).filter(
    (el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      ((el instanceof HTMLInputElement && el.type !== "hidden") || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) &&
      !(el as HTMLElement).dataset.skipProgress,
  );
  const value = (el: { name: string; value: string }) => (overrides[el.name] ?? el.value).trim();
  const steps: Record<number, StepStatus> = {};
  for (const el of fields) {
    const step = Number(el.closest<HTMLElement>("[data-step]")?.dataset.step ?? 0);
    const s = (steps[step] ??= { filled: 0, missingRequired: 0 });
    if (value(el)) s.filled++;
    else if (REQUIRED.has(el.name)) s.missingRequired++;
  }
  const byName = new Map(fields.map((el) => [el.name, value(el)]));
  return {
    filled: fields.filter((el) => value(el)).length,
    total: fields.length,
    requiredDone: [...REQUIRED].filter((name) => byName.get(name)).length,
    missing: KEY_FIELDS.filter(([name]) => !byName.get(name)).map(([, label]) => label),
    steps,
  };
}

export function useFormStepper() {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Ref estable: mide una vez al montar, sin efecto.
  const attachForm = useCallback((form: HTMLFormElement | null) => {
    formRef.current = form;
    if (form) setProgress(measure(form));
  }, []);

  function goTo(next: number) {
    setStep(next);
    const form = formRef.current;
    if (form && form.getBoundingClientRect().top < 0) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function remeasure(overrides?: Record<string, string>) {
    if (formRef.current) setProgress(measure(formRef.current, overrides));
  }

  // Sin validación del navegador (no puede enfocar campos de secciones ocultas): sin nombre del puesto se lleva al paso 2.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const title = e.currentTarget.elements.namedItem("title");
    if (title instanceof HTMLInputElement && !title.value.trim()) {
      e.preventDefault();
      setTitleMissing(true);
      goTo(2);
      requestAnimationFrame(() => title.focus());
    }
  }

  function onInput(e: FormEvent<HTMLFormElement>) {
    setProgress(measure(e.currentTarget));
    if (titleMissing) setTitleMissing(false);
  }

  return { step, goTo, progress, titleMissing, remeasure, formProps: { ref: attachForm, noValidate: true, onSubmit, onInput } };
}

type StepperState = ReturnType<typeof useFormStepper>;

/** Barra de avance y pestañas de sección, fija arriba. `inDialog`: pegada al área con scroll del diálogo. */
export function StepperHeader({ steps, stepper, inDialog }: { steps: string[]; stepper: StepperState; inDialog?: boolean }) {
  const { step, goTo, progress } = stepper;
  const pct = progress?.total ? Math.round((progress.filled / progress.total) * 100) : 0;
  const requiredDone = progress?.requiredDone ?? 0;

  return (
    // En la página queda bajo la barra del celular (52 px).
    <div className={`sticky z-20 space-y-3 rounded-card border border-line bg-surface px-4 py-3 shadow-sm ${inDialog ? "-top-5" : "top-[52px] md:top-0"}`}>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className="font-medium text-ink">
            Avance <span className="tabular-nums">{pct} %</span>
          </p>
          <p className={`text-xs tabular-nums ${requiredDone === REQUIRED.size ? "text-forest" : "text-ink-muted"}`}>
            Obligatorios (<span className="text-amber">*</span>): {requiredDone} de {REQUIRED.size}
          </p>
        </div>
        <div role="progressbar" aria-label="Avance del formulario" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <nav aria-label="Secciones" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {steps.map((label, i) => {
          const n = i + 1;
          const s = progress?.steps[n];
          const done = Boolean(s && s.filled > 0 && s.missingRequired === 0);
          const active = n === step;
          return (
            <button
              key={label}
              type="button"
              onClick={() => goTo(n)}
              aria-current={active ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${active ? "bg-forest text-on-forest" : "text-ink-muted hover:bg-canvas hover:text-ink"}`}
            >
              <span className={`flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums ${active ? "bg-on-forest/20" : done ? "bg-forest/10 text-forest" : "border border-line"}`}>
                {done && !active ? <Check className="size-3" aria-hidden /> : n}
              </span>
              {label}
              {s && s.missingRequired > 0 && <span className={`size-1.5 rounded-full ${active ? "bg-on-forest" : "bg-amber"}`} aria-label="faltan obligatorios" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** Anterior / siguiente con el nombre de la sección, el aviso de campos clave y el error de nombre del puesto. */
export function StepperFooter({ steps, stepper, error }: { steps: string[]; stepper: StepperState; error?: string }) {
  const { step, goTo, progress, titleMissing } = stepper;
  const missing = progress?.missing ?? KEY_FIELDS.map(([, label]) => label);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface hover:text-ink disabled:invisible"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {steps[step - 2] ?? "Anterior"}
        </button>
        <span className="text-xs tabular-nums text-ink-muted">
          Paso {step} de {steps.length}
        </span>
        <button
          type="button"
          onClick={() => goTo(step + 1)}
          disabled={step === steps.length}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:invisible"
        >
          {steps[step] ?? "Siguiente"}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      {missing.length > 0 && (
        <div role="status" className="flex gap-2.5 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Faltan {listLabel(missing)}. Puedes guardar y quedarán marcados para completar con el cliente; sin ellos, el prefiltro y la evaluación del CV no tienen contra qué comparar.
          </p>
        </div>
      )}

      {(titleMissing || error) && (
        <p role="alert" className={alertErrorClass}>
          {titleMissing ? "Captura el nombre del puesto para poder guardar." : error}
        </p>
      )}
    </>
  );
}
