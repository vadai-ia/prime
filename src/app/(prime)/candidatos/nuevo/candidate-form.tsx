"use client";

import { useActionState, useState, type DragEvent } from "react";
import { FileText, Upload } from "lucide-react";
import { checkCandidatePhone, createCandidate, readCv, readCvWithAi, startCvUpload } from "@/actions/candidates";
import { AGE_MAX, AGE_MIN, type CvFields } from "@/lib/cv/parse";
import { CandidateHistory } from "@/components/candidate/history";
import type { CandidateHistoryRow } from "@/lib/queries/types";
import { createClient } from "@/lib/supabase/client";
import { CHANNEL_LABELS } from "@/lib/labels";
import { alertErrorClass, alertSuccessClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

type ProfileOption = { id: string; label: string };

const FIELDS = ["full_name", "phone", "email", "municipality", "zone", "education_level", "age_reported", "birth_date", "notes"] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;

const EMPTY = Object.fromEntries(FIELDS.map((f) => [f, ""])) as Values;

type CvState =
  | { status: "idle" }
  | { status: "uploading" | "reading"; name: string }
  | { status: "done"; name: string; path: string; tone: "ok" | "warn"; message: string }
  | { status: "error"; message: string };

export function CandidateForm({ profiles, defaultProfileId }: { profiles: ProfileOption[]; defaultProfileId?: string }) {
  const [state, action, pending] = useActionState(createCandidate, undefined);
  // Todo controlado: React reinicia los campos no controlados cuando el action devuelve un error
  const [profileId, setProfileId] = useState(defaultProfileId ?? "");
  const [channel, setChannel] = useState("pandape");
  const [values, setValues] = useState<Values>(EMPTY);
  const [fromCv, setFromCv] = useState<ReadonlySet<Field>>(new Set());
  const [cv, setCv] = useState<CvState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<CandidateHistoryRow[]>([]);

  const busy = cv.status === "uploading" || cv.status === "reading";

  /** ¿Esta persona ya estaba registrada? Se pregunta al salir del teléfono y cuando el CV lo llena. */
  async function lookup(phone: string) {
    setHistory(phone.replace(/\D/g, "").length >= 10 ? await checkCandidatePhone(phone) : []);
  }

  function edit(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setFromCv((s) => new Set([...s].filter((f) => f !== field)));
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setCv({ status: "uploading", name: file.name });

    const ticket = await startCvUpload({ size: file.size, type: file.type });
    if ("error" in ticket) return setCv({ status: "error", message: ticket.error });

    const { error } = await createClient().storage.from("cvs").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: "application/pdf" });
    if (error) return setCv({ status: "error", message: `No se pudo subir el CV: ${error.message}` });

    setCv({ status: "reading", name: file.name });
    const read = await readFile(ticket.path);
    if ("error" in read) return setCv({ status: "done", name: file.name, path: ticket.path, tone: "warn", message: read.error });

    // El CV solo llena campos vacíos o que él mismo había llenado; lo que tecleó el reclutador se respeta.
    const proposed = Object.entries(read.fields).map(([k, v]) => [k as Field, String(v)] as const);
    const applied = proposed.filter(([k]) => values[k] === "" || fromCv.has(k));
    setValues((v) => ({ ...v, ...Object.fromEntries(applied) }));
    setFromCv((s) => new Set([...s, ...applied.map(([k]) => k)]));
    const cvPhone = applied.find(([k]) => k === "phone")?.[1];
    if (cvPhone) void lookup(cvPhone);

    const notes = [
      read.note,
      read.ageIgnored !== null ? `El CV dice ${read.ageIgnored} años: fuera de ${AGE_MIN} a ${AGE_MAX}, no se llenó. Revísalo.` : null,
    ].filter(Boolean);
    const main = !read.isCv
      ? "Este PDF no parece un CV. Quedó adjunto; revísalo o cámbialo."
      : applied.length === 0
        ? "No se reconocieron datos en el CV. Quedó adjunto; captura los datos a mano."
        : `Se ${applied.length === 1 ? "llenó 1 campo" : `llenaron ${applied.length} campos`} desde el CV. Revísalos antes de guardar.`;
    const ok = read.isCv && applied.length > 0 && notes.length === 0;
    setCv({ status: "done", name: file.name, path: ticket.path, tone: ok ? "ok" : "warn", message: [main, ...notes].join(" ") });
  }

  /**
   * Claude lee el CV (también escaneado). Si la IA no está configurada o falla, se usa el lector de
   * texto del PDF, que no lee escaneados. Cada lectura con IA queda en Configuración → Logs técnicos.
   */
  async function readFile(path: string): Promise<{ fields: CvFields; isCv: boolean; ageIgnored: number | null; note: string | null } | { error: string }> {
    const ai = await readCvWithAi(path);
    if (!("error" in ai)) return { ...ai, note: null };
    const text = await readCv(path);
    if ("error" in text) return { error: `${ai.error} ${text.error}` };
    if (!text.hasText) return { error: `${ai.error} El PDF no trae texto (parece escaneado). El CV quedó adjunto; captura los datos a mano.` };
    return { fields: text.fields, isCv: true, ageIgnored: null, note: "No se pudo leer con IA; se usó el texto del PDF. Revisa los datos." };
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  const input = (field: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = false) => (
    <label className={`${labelClass} ${span ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center gap-2">
        {label}
        {fromCv.has(field) && <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-medium text-forest">del CV</span>}
      </span>
      <input name={field} value={values[field]} onChange={(e) => edit(field, e.target.value)} className={inputClass} {...props} />
    </label>
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-forest">Postulación</legend>
        <label className={labelClass}>
          Vacante
          <select name="profile_id" required value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Selecciona la vacante
            </option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Canal
          <select name="source_channel" required value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="border-t border-line pt-6">
        <legend className="text-sm font-semibold text-forest">CV</legend>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed px-6 py-8 text-center transition ${
            dragging ? "border-leaf bg-mint" : "border-line bg-canvas hover:border-leaf"
          } ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          {cv.status === "done" || busy ? <FileText className="h-6 w-6 text-forest" /> : <Upload className="h-6 w-6 text-ink-faint" />}
          <span className="text-sm font-medium text-ink">
            {cv.status === "uploading" && `Subiendo ${cv.name}…`}
            {cv.status === "reading" && `Leyendo ${cv.name}…`}
            {cv.status === "done" && cv.name}
            {(cv.status === "idle" || cv.status === "error") && "Arrastra el CV aquí o haz clic para elegirlo"}
          </span>
          <span className="text-xs text-ink-muted">{cv.status === "done" ? "Haz clic para cambiarlo por otro" : "Solo PDF, hasta 20 MB, también escaneado. La IA llena el formulario con lo que lea."}</span>
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {cv.status === "done" && (
          <p role="status" className={`mt-3 ${cv.tone === "ok" ? alertSuccessClass : "rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink"}`}>
            {cv.message}
          </p>
        )}
        {cv.status === "error" && (
          <p role="alert" className={`mt-3 ${alertErrorClass}`}>
            {cv.message}
          </p>
        )}
        <input type="hidden" name="cv_path" value={cv.status === "done" ? cv.path : ""} />
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-forest">Datos del candidato</legend>
        {input("full_name", "Nombre completo", { required: true, minLength: 3, placeholder: "María Fernanda López Ruiz" }, true)}
        {input("phone", "Teléfono (WhatsApp)", { required: true, type: "tel", placeholder: "449 123 4567", onBlur: (e) => void lookup(e.target.value) })}
        {input("email", "Correo", { type: "email", placeholder: "nombre@correo.com" })}
        {history.length > 0 && (
          <div className="sm:col-span-2">
            <CandidateHistory rows={history} />
          </div>
        )}
        {input("municipality", "Municipio", { placeholder: "Aguascalientes" })}
        {input("zone", "Zona o colonia", { placeholder: "Zona norte" })}
        {input("education_level", "Escolaridad", { placeholder: "Preparatoria" }, true)}
        {input("age_reported", "Edad", { inputMode: "numeric", pattern: "[0-9]{2}", maxLength: 2, autoComplete: "off", title: `De ${AGE_MIN} a ${AGE_MAX} años`, placeholder: `${AGE_MIN} a ${AGE_MAX}` })}
        {input("birth_date", "Fecha de nacimiento", { type: "date" })}
        <label className={`${labelClass} sm:col-span-2`}>
          Notas
          <textarea name="notes" rows={3} value={values.notes} onChange={(e) => edit("notes", e.target.value)} className={inputClass} placeholder="De dónde llegó, quién lo refirió, disponibilidad." />
        </label>
        <p className="text-xs text-ink-faint sm:col-span-2">El teléfono identifica al candidato: si ya existe en el sistema, se le agrega esta postulación en lugar de duplicarlo.</p>
      </fieldset>

      {state?.error && (
        <p role="alert" className={alertErrorClass}>
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending || busy} className={`${buttonPrimaryClass} w-auto`}>
          {pending ? "Guardando…" : "Guardar candidato"}
        </button>
      </div>
    </form>
  );
}
