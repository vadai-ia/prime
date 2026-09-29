import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/form";

export type EmailKind = "interno" | "cliente" | "semanal";

export const EMAIL_KINDS: { key: EmailKind; label: string }[] = [
  { key: "interno", label: "Resumen diario interno" },
  { key: "cliente", label: "Diario al cliente" },
  { key: "semanal", label: "Semanal al cliente" },
];

export type EmailEnvelope = { to: string[]; subject: string; schedule: string; note?: string };

function recipientsLabel(to: string[]) {
  if (to.length === 0) return <span className="text-danger">Sin destinatarios: agrégalos en los datos del cliente.</span>;
  const shown = to.slice(0, 3).join(", ");
  return to.length > 3 ? `${shown} y ${to.length - 3} más` : shown;
}

/** Vista previa de un correo automático: selector de correo y de cliente, sobre y cuerpo tal como llegaría. */
export function EmailPreview({
  kind,
  clientId,
  clients,
  envelope,
  children,
}: {
  kind: EmailKind;
  clientId?: string;
  clients: { id: string; name: string }[];
  envelope: EmailEnvelope | null;
  children: ReactNode;
}) {
  const href = (k: EmailKind) => `/reportes?correo=${k}${clientId ? `&client=${clientId}` : ""}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-canvas p-1">
          {EMAIL_KINDS.map((k) => (
            <Link
              key={k.key}
              href={href(k.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${kind === k.key ? "bg-surface text-forest shadow-sm" : "text-ink-muted hover:text-ink"}`}
            >
              {k.label}
            </Link>
          ))}
        </div>
        {kind !== "interno" && (
          <form method="get" action="/reportes" className="flex items-center gap-2">
            <input type="hidden" name="correo" value={kind} />
            <select name="client" defaultValue={clientId ?? ""} className={`${inputClass} mt-0 min-w-48`} aria-label="Cliente">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-white transition hover:bg-forest-deep">
              Ver
            </button>
          </form>
        )}
      </div>

      {!envelope ? (
        <EmptyState title="Sin clientes con vacantes activas" hint="La vista previa del correo al cliente aparece cuando un cliente tiene al menos una vacante activa." />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 border-b border-line bg-canvas px-5 py-4 text-sm">
            <dt className="text-ink-muted">Para</dt>
            <dd className="text-ink">{recipientsLabel(envelope.to)}</dd>
            <dt className="text-ink-muted">Asunto</dt>
            <dd className="font-semibold text-ink">{envelope.subject}</dd>
            <dt className="text-ink-muted">Envío</dt>
            <dd className="flex flex-wrap items-center gap-2 text-ink">
              {envelope.schedule}
              <Pill tone="amber">Vista previa · se enviará al conectar Resend</Pill>
            </dd>
          </dl>
          {envelope.note && <p className="border-b border-line bg-info-soft px-5 py-2 text-xs text-info">{envelope.note}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
