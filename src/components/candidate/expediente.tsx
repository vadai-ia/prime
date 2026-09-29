import type { ApplicationDetail, DocumentWithType } from "@/lib/queries/types";
import { asJson } from "@/lib/domain/json";
import type { DocAiCheck } from "@/lib/domain/json";
import { DOC_STATUS_LABELS, DOC_STATUS_TONES } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { Pill } from "@/components/ui/pill";
import { Bar } from "@/components/ui/bar";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentReview, DocumentUpload } from "./document-actions";

const VIA_LABELS = { whatsapp: "WhatsApp", upload: "Carga manual", email: "Correo" } as const;

export function Expediente({ detail }: { detail: ApplicationDetail }) {
  const { documentTypes, documents } = detail;
  const applicationId = detail.application.id;
  const required = documentTypes.filter((t) => t.required).length;
  const validated = new Set(documents.filter((d) => d.status === "validated").map((d) => d.document_type_key)).size;

  // Sin catálogo no hay qué pedir ni qué subir: mejor decirlo que pintar una tabla vacía.
  if (documentTypes.length === 0) {
    return (
      <EmptyState
        title="Falta el catálogo de documentos"
        hint="La tabla document_types está vacía. Aplica supabase/manual/06_catalogos.sql en el SQL Editor y recarga."
      />
    );
  }

  const rows = documentTypes
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((type) => {
      const mine = documents.filter((d) => d.document_type_key === type.key);
      const live = mine.filter((d) => d.status !== "rejected").sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      const rejected = mine.filter((d) => d.status === "rejected");
      return { type, live, rejected };
    });

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-surface px-5 py-4">
        <Bar value={validated} max={required} tone={validated >= required ? "leaf" : "forest"} label={`Documentos validados: ${validated} de ${required}`} />
        {validated >= required && required > 0 && (
          <p className="mt-2 text-xs text-forest">Expediente completo: se puede generar la hoja de confirmación y enviar al cliente.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Documento</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
              <th className="px-4 py-2.5 font-semibold">Recibido por</th>
              <th className="px-4 py-2.5 font-semibold">Validado</th>
              <th className="px-4 py-2.5 font-semibold">Revisión de la IA</th>
              <th className="px-4 py-2.5 font-semibold">Archivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ type, live, rejected }) => (
              <tr key={type.key} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{type.label}</p>
                  <p className="text-xs text-ink-faint">
                    {type.required ? "Obligatorio" : "Opcional"}
                    {type.validation_hints ? ` · ${type.validation_hints}` : ""}
                  </p>
                  {rejected.length > 0 && <RejectedHistory docs={rejected} />}
                </td>
                <td className="px-4 py-3">
                  <Pill tone={live ? DOC_STATUS_TONES[live.status] : "neutral"}>{live ? DOC_STATUS_LABELS[live.status] : DOC_STATUS_LABELS.pending}</Pill>
                </td>
                <td className="px-4 py-3 text-ink-muted">{live?.received_via ? VIA_LABELS[live.received_via] : "—"}</td>
                <td className="px-4 py-3 text-ink-muted">{live?.validated_at ? fmtDate(live.validated_at, { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-4 py-3">{live ? <AiCheck doc={live} /> : <span className="text-ink-faint">—</span>}</td>
                <td className="px-4 py-3">
                  {live ? (
                    <div className="space-y-1.5">
                      {live.file_path && (
                        <a href={`/candidatos/${applicationId}/documentos/${live.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-forest hover:underline">
                          Ver archivo
                        </a>
                      )}
                      {live.status !== "validated" && <DocumentReview applicationId={applicationId} documentId={live.id} />}
                    </div>
                  ) : (
                    <DocumentUpload applicationId={applicationId} documentTypeKey={type.key} accepts={type.accepts} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AiCheck({ doc }: { doc: DocumentWithType }) {
  // Carga manual, o la IA todavía no lo revisa: no se afirma nada que nadie verificó.
  if (doc.ai_check === null) return <span className="text-xs text-ink-faint">Sin revisión automática</span>;
  const check = asJson<DocAiCheck>(doc.ai_check, { legible: true, name_matches: true });
  const issues = check.issues ?? [];
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-1">
        <Pill tone={check.legible ? "mint" : "danger"}>{check.legible ? "Legible" : "Ilegible"}</Pill>
        <Pill tone={check.name_matches ? "mint" : "danger"}>{check.name_matches ? "Nombre coincide" : "Nombre no coincide"}</Pill>
      </div>
      {issues.length > 0 && <p className="text-amber">{issues.join(" · ")}</p>}
      {check.extracted && Object.keys(check.extracted).length > 0 && (
        <p className="text-ink-faint">
          {Object.entries(check.extracted)
            .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function RejectedHistory({ docs }: { docs: DocumentWithType[] }) {
  return (
    <ul className="mt-1.5 space-y-0.5">
      {docs.map((d) => (
        <li key={d.id} className="text-xs text-danger">
          Rechazado el {fmtDate(d.created_at)}
          {d.rejected_reason ? `: ${d.rejected_reason}` : ""}
        </li>
      ))}
    </ul>
  );
}
