"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Send } from "lucide-react";
import { listWhatsAppTemplates, sendWhatsAppTemplate, sendWhatsAppText, syncWhatsAppConversation, type WhatsAppTemplateOption } from "@/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass, inputClass, labelClass } from "@/components/ui/form";

type Mode = "text" | "template";
type Notice = { tone: "error" | "ok"; text: string } | null;

/** Mensaje libre (ventana de 24 h abierta) o plantilla aprobada, y traer el historial de Whaapy. */
export function WhatsAppComposer({ applicationId, firstName, jobTitle, windowOpen }: { applicationId: string; firstName: string; jobTitle: string; windowOpen: boolean }) {
  const [mode, setMode] = useState<Mode>(windowOpen ? "text" : "template");
  const [text, setText] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [params, setParams] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  const template = templates?.find((t) => `${t.name}|${t.language}` === selected) ?? null;
  const preview = template ? template.content.replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n: string) => params[Number(n) - 1] || all) : "";

  function loadTemplates() {
    if (templates) return;
    startTransition(async () => {
      const r = await listWhatsAppTemplates();
      if (!r.ok) return setNotice({ tone: "error", text: r.error });
      setTemplates(r.templates);
      if (r.templates.length === 0) setNotice({ tone: "error", text: "No hay plantillas aprobadas en Whaapy." });
    });
  }

  function pick(key: string) {
    setSelected(key);
    const t = templates?.find((x) => `${x.name}|${x.language}` === key);
    // Las plantillas de Prime empiezan con {{1}} nombre y {{2}} vacante.
    setParams(Array.from({ length: t?.variables ?? 0 }, (_, i) => (i === 0 ? firstName : i === 1 ? jobTitle : "")));
  }

  function switchTo(next: Mode) {
    setMode(next);
    setNotice(null);
    if (next === "template") loadTemplates();
  }

  function run(action: () => Promise<{ ok: true; detail?: string } | { ok: false; error: string }>, onOk?: () => void) {
    setNotice(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return setNotice({ tone: "error", text: r.error });
      onOk?.();
      setNotice({ tone: "ok", text: r.detail ?? "Enviado" });
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
          {(["text", "template"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchTo(m)}
              className={`rounded-md px-3 py-1 ${mode === m ? "bg-forest text-on-forest" : "text-ink-muted hover:text-ink"}`}
            >
              {m === "text" ? "Mensaje" : "Plantilla"}
            </button>
          ))}
        </div>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => syncWhatsAppConversation(applicationId))}>
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          Traer de Whaapy
        </Button>
      </div>

      {mode === "text" ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => sendWhatsAppText(applicationId, text), () => setText(""));
          }}
        >
          {!windowOpen && (
            <p className="text-xs text-amber">El candidato no ha escrito en las últimas 24 h: WhatsApp solo deja mandar una plantilla.</p>
          )}
          <textarea className={`${inputClass} min-h-20`} value={text} onChange={(e) => setText(e.target.value)} maxLength={4096} placeholder="Escribe un mensaje…" />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !text.trim()}>
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!template) return;
            run(() => sendWhatsAppTemplate(applicationId, { name: template.name, language: template.language, parameters: params }), () => setSelected(""));
          }}
        >
          <label className={labelClass}>
            Plantilla
            <select className={inputClass} value={selected} onChange={(e) => pick(e.target.value)} disabled={!templates || pending}>
              <option value="">{templates ? "Elige una plantilla" : "Cargando…"}</option>
              {templates?.map((t) => (
                <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
          </label>
          {template &&
            params.map((value, i) => (
              <label key={i} className={labelClass}>
                Variable {`{{${i + 1}}}`}
                <input className={inputClass} value={value} onChange={(e) => setParams((p) => p.map((v, j) => (j === i ? e.target.value : v)))} />
              </label>
            ))}
          {template && <p className="whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{preview}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !template || params.some((p) => !p.trim())}>
              <Send className="h-4 w-4" />
              Enviar plantilla
            </Button>
          </div>
        </form>
      )}

      {notice && <p className={`mt-3 ${notice.tone === "error" ? alertErrorClass : alertSuccessClass}`}>{notice.text}</p>}
    </div>
  );
}
