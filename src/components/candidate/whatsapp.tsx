import { FileText, Image as ImageIcon, Mic, Video } from "lucide-react";
import type { ApplicationDetail, WaMessage } from "@/lib/queries/types";
import { asJson } from "@/lib/domain/json";
import { WA_FLOW_LABELS, WA_STATUS_LABELS } from "@/lib/labels";
import { fmtDateTime, fmtTime, timeAgo } from "@/lib/format";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_TEXT: Record<WaMessage["status"], string> = {
  queued: "en cola",
  sent: "enviado",
  delivered: "entregado",
  read: "leído",
  failed: "falló",
};

type InteractivePayload = { buttons?: { id: string; title: string }[] };

export function WhatsApp({ detail }: { detail: ApplicationDetail }) {
  const conv = detail.conversation;
  if (!conv) {
    return <EmptyState title="Sin conversación de WhatsApp" hint="Se abre cuando Vale manda el template de primer contacto." />;
  }

  const windowOpen = !!conv.window_expires_at && new Date(conv.window_expires_at) > new Date();

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="rounded-card border border-line bg-canvas p-4">
          <div className="space-y-3">
            {conv.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {conv.messages.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Sin mensajes.</p>}
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:col-span-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="info">{WA_FLOW_LABELS[conv.flow]}</Pill>
            <Pill tone={conv.status === "open" ? "mint" : conv.status === "handoff" ? "amber" : "neutral"}>{WA_STATUS_LABELS[conv.status]}</Pill>
            <Pill tone={windowOpen ? "mint" : "neutral"}>{windowOpen ? "Ventana de 24 h abierta" : "Fuera de ventana: usar template"}</Pill>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Último mensaje del candidato" value={conv.last_inbound_at ? `${timeAgo(conv.last_inbound_at)} · ${fmtDateTime(conv.last_inbound_at)}` : "Aún no responde"} />
            <Row label="Último mensaje enviado" value={conv.last_outbound_at ? fmtDateTime(conv.last_outbound_at) : "—"} />
            <Row label="Ventana expira" value={conv.window_expires_at ? fmtDateTime(conv.window_expires_at) : "—"} />
            <Row label="Teléfono" value={conv.phone_e164} />
          </dl>
        </div>

        {conv.ai_paused && (
          <div className="rounded-card border border-amber/40 bg-amber-soft px-5 py-4 text-sm">
            <p className="font-semibold text-amber">Vale está pausada en esta conversación</p>
            <p className="mt-1 text-ink">
              Un reclutador tomó el hilo{conv.paused_by ? "" : " desde el inbox de Whaapy"}. El agente no contesta hasta que se reanude.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Bubble({ message: m }: { message: WaMessage }) {
  const outbound = m.direction === "outbound";
  const payload = asJson<InteractivePayload>(m.interactive_payload, {});
  const fileName = m.media_path?.split("/").pop();

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${outbound ? "rounded-br-md bg-mint text-ink" : "rounded-bl-md border border-line bg-surface text-ink"}`}>
        {m.type === "template" && <span className="mb-1 inline-block rounded bg-forest/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-forest">Template</span>}
        {(m.type === "image" || m.type === "document" || m.type === "audio" || m.type === "video") && (
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-dashed border-line bg-canvas px-3 py-2 text-xs text-ink-muted">
            {m.type === "image" && <ImageIcon className="h-4 w-4" />}
            {m.type === "document" && <FileText className="h-4 w-4" />}
            {m.type === "audio" && <Mic className="h-4 w-4" />}
            {m.type === "video" && <Video className="h-4 w-4" />}
            <span className="truncate">{fileName ?? m.type}</span>
          </div>
        )}
        {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
        {m.type === "interactive" && payload.buttons && payload.buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {payload.buttons.map((b) => (
              <span key={b.id} className="rounded-full border border-forest/30 bg-surface px-2.5 py-0.5 text-xs text-forest">
                {b.title}
              </span>
            ))}
          </div>
        )}
        <p className={`mt-1 text-[10px] ${outbound ? "text-forest/70" : "text-ink-faint"}`}>
          {fmtTime(m.created_at)}
          {outbound && ` · ${STATUS_TEXT[m.status]}`}
          {m.error && ` · ${m.error}`}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
