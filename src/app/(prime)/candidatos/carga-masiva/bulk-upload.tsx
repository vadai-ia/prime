"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Loader2, Trash2, TriangleAlert, Upload, XCircle } from "lucide-react";
import { checkCandidatePhone, createCandidateFromBulk, readCv, readCvWithAi, startCvUpload } from "@/actions/candidates";
import { createClient } from "@/lib/supabase/client";
import { CHANNEL_LABELS } from "@/lib/labels";
import { AGE_MAX, AGE_MIN } from "@/lib/cv/parse";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";

type ProfileOption = { id: string; label: string };

const FIELDS = ["full_name", "phone", "email", "municipality", "education_level", "age_reported", "birth_date"] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f, ""])) as Values;

type Status = "queued" | "uploading" | "reading" | "ready" | "error" | "saving" | "saved" | "failed";

type Row = {
  key: string;
  fileName: string;
  file?: File;
  status: Status;
  path?: string;
  values: Values;
  message?: string; // error de lectura o de alta, o aviso del CV
  history?: number; // vacantes en las que ya estaba registrado (por teléfono)
  applicationId?: string;
};

const MAX_FILES = 30;
const READ_CONCURRENCY = 3;
const MAX_BYTES = 20 * 1024 * 1024;

const isBusy = (s: Status) => s === "queued" || s === "uploading" || s === "reading" || s === "saving";
const missingRequired = (v: Values) => v.full_name.trim().length < 3 || v.phone.replace(/\D/g, "").length < 10;

/**
 * Carga masiva: cada PDF se sube directo a Storage (URL firmada, como el alta individual), la IA lee sus
 * datos de contacto y se muestran en una tabla editable. "Dar de alta" usa la misma acción que el alta
 * individual: lista negra, duplicados por teléfono y la base asigna al reclutador por turno.
 */
export function BulkUpload({ profiles, defaultProfileId, withAi }: { profiles: ProfileOption[]; defaultProfileId?: string; withAi: boolean }) {
  const [profileId, setProfileId] = useState(defaultProfileId ?? "");
  const [channel, setChannel] = useState("pandape");
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(key: string, change: Partial<Row> | ((r: Row) => Partial<Row>)) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...(typeof change === "function" ? change(r) : change) } : r)));
  }

  /** Sube y lee un PDF. Nunca lanza: cualquier problema queda en la fila. */
  async function readRow(row: Row) {
    const file = row.file!;
    patch(row.key, { status: "uploading" });
    const ticket = await startCvUpload({ size: file.size, type: file.type });
    if ("error" in ticket) return patch(row.key, { status: "error", message: ticket.error });
    const { error } = await createClient().storage.from("cvs").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: "application/pdf" });
    if (error) return patch(row.key, { status: "error", message: `No se pudo subir: ${error.message}` });

    patch(row.key, { status: "reading", path: ticket.path, file: undefined });
    let fields: Partial<Record<Field, string | number>> = {};
    let message: string | undefined;
    if (withAi) {
      const read = await readCvWithAi(ticket.path);
      if ("error" in read) message = `${read.error} Captura los datos a mano.`;
      else {
        fields = read.fields;
        if (!read.isCv) message = "Este PDF no parece un CV. Revísalo o quítalo.";
        else if (read.ageIgnored !== null) message = `El CV dice ${read.ageIgnored} años: fuera de ${AGE_MIN} a ${AGE_MAX}, no se llenó.`;
      }
    } else {
      const read = await readCv(ticket.path);
      if ("error" in read) message = read.error;
      else {
        fields = read.fields;
        if (!read.hasText) message = "PDF escaneado sin texto: captura los datos a mano.";
      }
    }
    const values = { ...EMPTY, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])) } as Values;
    const history = values.phone ? (await checkCandidatePhone(values.phone)).length : 0;
    patch(row.key, { status: "ready", values, message, history });
  }

  /** Lee hasta READ_CONCURRENCY archivos a la vez para no saturar la IA ni el navegador. */
  async function processAll(batch: Row[]) {
    const pending = [...batch];
    const worker = async () => {
      for (let row = pending.shift(); row; row = pending.shift()) await readRow(row);
    };
    await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, pending.length) }, worker));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setNotice(null);
    const files = [...list];
    const pdfs = files.filter((f) => f.type === "application/pdf" && f.size > 0 && f.size <= MAX_BYTES);
    const room = MAX_FILES - rows.length;
    const accepted = pdfs.slice(0, Math.max(room, 0));
    const skipped = files.length - accepted.length;
    if (skipped > 0) {
      setNotice(
        `${skipped} ${skipped === 1 ? "archivo no se agregó" : "archivos no se agregaron"}: solo PDF de hasta 20 MB y máximo ${MAX_FILES} por carga.`,
      );
    }
    if (accepted.length === 0) return;
    const batch: Row[] = accepted.map((file) => ({ key: crypto.randomUUID(), fileName: file.name, file, status: "queued", values: EMPTY }));
    setRows((all) => [...all, ...batch]);
    void processAll(batch);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function edit(key: string, field: Field, value: string) {
    patch(key, (r) => ({ values: { ...r.values, [field]: value } }));
  }

  const ready = rows.filter((r) => (r.status === "ready" || r.status === "failed") && r.path && !missingRequired(r.values));
  const reading = rows.some((r) => r.status === "queued" || r.status === "uploading" || r.status === "reading");
  const saved = rows.filter((r) => r.status === "saved");

  async function saveAll() {
    if (!profileId || ready.length === 0) return;
    setSaving(true);
    // Una por una: cada alta pasa por la lista negra, los duplicados y el round robin en la base.
    for (const row of ready) {
      patch(row.key, { status: "saving", message: undefined });
      const result = await createCandidateFromBulk({ profile_id: profileId, source_channel: channel, cv_path: row.path!, ...row.values });
      if ("error" in result) patch(row.key, { status: "failed", message: result.error });
      else patch(row.key, { status: "saved", applicationId: result.applicationId, message: undefined });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-sm sm:grid-cols-2">
        <label className={labelClass}>
          Vacante
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} disabled={saving} className={inputClass}>
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
          Canal de origen
          <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={saving} className={inputClass}>
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center transition sm:col-span-2 ${dragging ? "border-leaf bg-mint" : "border-line bg-canvas hover:border-leaf"}`}
        >
          <Upload className="size-6 text-forest" aria-hidden />
          <span className="text-sm font-medium text-ink">Arrastra aquí los CV en PDF o haz clic para elegirlos</span>
          <span className="text-xs text-ink-muted">
            Hasta {MAX_FILES} por carga, 20 MB cada uno.{" "}
            {withAi ? "La IA lee cada CV en unos segundos, también los escaneados." : "Sin IA configurada: se leen los PDF con texto; los escaneados se capturan a mano."}
          </span>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {notice && <p className="text-sm text-amber sm:col-span-2">{notice}</p>}
      </div>

      {rows.length > 0 && (
        <div className="rounded-card border border-line bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink">{rows.length}</span> {rows.length === 1 ? "archivo" : "archivos"} ·{" "}
              <span className="font-medium text-ink">{ready.length}</span> listos para dar de alta
              {saved.length > 0 && (
                <>
                  {" "}
                  · <span className="font-medium text-forest">{saved.length}</span> dados de alta
                </>
              )}
            </p>
            <p className="text-xs text-ink-faint">Nombre y teléfono son obligatorios. Corrige en la tabla lo que la IA haya leído mal.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">CV</th>
                  <th className="px-2 py-2 font-medium">Nombre *</th>
                  <th className="px-2 py-2 font-medium">Teléfono *</th>
                  <th className="px-2 py-2 font-medium">Correo</th>
                  <th className="px-2 py-2 font-medium">Municipio</th>
                  <th className="px-2 py-2 font-medium">Escolaridad</th>
                  <th className="w-20 px-2 py-2 font-medium">Edad</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const locked = isBusy(r.status) || r.status === "saved" || r.status === "error";
                  const cell = (field: Field, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
                    <input
                      value={r.values[field]}
                      onChange={(e) => edit(r.key, field, e.target.value)}
                      disabled={locked}
                      aria-label={field}
                      className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/25 disabled:border-transparent disabled:bg-transparent"
                      {...props}
                    />
                  );
                  return (
                    <tr key={r.key} className="align-top">
                      <td className="px-4 py-2.5">
                        <p className="flex max-w-56 items-center gap-1.5 truncate text-ink" title={r.fileName}>
                          <FileText className="size-4 shrink-0 text-ink-faint" aria-hidden />
                          <span className="truncate">{r.fileName}</span>
                        </p>
                        <RowStatus row={r} />
                      </td>
                      <td className="px-2 py-2">{cell("full_name", { placeholder: r.status === "ready" ? "Nombre completo" : "" })}</td>
                      <td className="px-2 py-2">{cell("phone", { type: "tel", placeholder: r.status === "ready" ? "10 dígitos" : "" })}</td>
                      <td className="px-2 py-2">{cell("email", { type: "email" })}</td>
                      <td className="px-2 py-2">{cell("municipality")}</td>
                      <td className="px-2 py-2">{cell("education_level")}</td>
                      <td className="px-2 py-2">{cell("age_reported", { inputMode: "numeric", pattern: "[0-9]{2}", maxLength: 2, autoComplete: "off", title: `De ${AGE_MIN} a ${AGE_MAX} años` })}</td>
                      <td className="px-2 py-2">
                        {r.status !== "saved" && !isBusy(r.status) && (
                          <button
                            type="button"
                            onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                            aria-label={`Quitar ${r.fileName}`}
                            title="Quitar de la carga"
                            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4">
            <p className="mr-auto text-xs text-ink-muted">
              {!profileId
                ? "Selecciona la vacante para poder dar de alta."
                : "Se postulan en etapa Nuevo. La base asigna a cada uno un reclutador de la vacante por turno y la IA califica su CV."}
            </p>
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={!profileId || ready.length === 0 || saving || reading}
              className={`${buttonPrimaryClass} mt-0 w-auto`}
            >
              {saving ? "Dando de alta…" : reading ? "Leyendo CV…" : `Dar de alta ${ready.length} ${ready.length === 1 ? "candidato" : "candidatos"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowStatus({ row: r }: { row: Row }) {
  const base = "mt-1 flex items-start gap-1 text-xs";
  if (r.status === "queued") return <p className={`${base} text-ink-faint`}>En espera…</p>;
  if (r.status === "uploading" || r.status === "reading" || r.status === "saving") {
    return (
      <p className={`${base} text-ink-muted`}>
        <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" aria-hidden />
        {r.status === "uploading" ? "Subiendo…" : r.status === "reading" ? "Leyendo con IA…" : "Dando de alta…"}
      </p>
    );
  }
  if (r.status === "saved") {
    return (
      <p className={`${base} text-forest`}>
        <CheckCircle2 className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>
          Dado de alta ·{" "}
          <Link href={`/candidatos/${r.applicationId}`} className="font-medium underline-offset-2 hover:underline">
            ver ficha
          </Link>
        </span>
      </p>
    );
  }
  if (r.status === "error" || r.status === "failed") {
    return (
      <p className={`${base} max-w-56 text-danger`}>
        <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
        {r.message ?? "Error"}
      </p>
    );
  }
  const warnings = [
    missingRequired(r.values) ? "Falta nombre o teléfono" : null,
    r.history ? `Ya registrado (${r.history} ${r.history === 1 ? "postulación" : "postulaciones"})` : null,
    r.message ?? null,
  ].filter(Boolean);
  if (warnings.length === 0) return <p className={`${base} text-forest`}>Listo</p>;
  return (
    <p className={`${base} max-w-56 text-amber`}>
      <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
      {warnings.join(" · ")}
    </p>
  );
}
