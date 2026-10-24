"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/actions/notifications";
import { timeAgo } from "@/lib/format";
import type { NotificationRow } from "@/lib/queries/notifications";

const KIND_DOT: Record<NotificationRow["kind"], string> = {
  client_decision: "bg-leaf",
  candidate_hired: "bg-forest",
  prefilter_exception: "bg-amber",
  document_received: "bg-info",
  interview_analyzed: "bg-info",
  psych_parsed: "bg-info",
  task_failed: "bg-danger",
  followup_due: "bg-amber",
  candidate_assigned: "bg-leaf",
  interview_scheduled: "bg-info",
  blacklist_attempt: "bg-danger",
  other: "bg-ink-faint",
};

/** Campana del menú lateral: avisos propios (notifications), con marcar leídas una o todas. */
export function NotificationBell({ items, unread }: { items: NotificationRow[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function openItem(n: NotificationRow) {
    setOpen(false);
    startTransition(async () => {
      if (!n.read_at) await markNotificationsRead([n.id]);
      if (n.href) router.push(n.href);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4.5 rounded-full bg-lime px-1 text-center text-[10px] font-bold leading-4.5 text-black">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Cerrar notificaciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card border border-line bg-surface text-ink shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold">Notificaciones</p>
              {unread > 0 && (
                <button type="button" disabled={pending} onClick={() => startTransition(async () => void (await markNotificationsRead()))} className="text-xs font-medium text-forest hover:underline disabled:opacity-60">
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">Sin notificaciones por ahora.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-canvas ${n.read_at ? "" : "bg-mint/40"}`}>
                      <span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${n.read_at ? "bg-line" : KIND_DOT[n.kind]}`} />
                      <span className="min-w-0">
                        <span className={`block text-sm ${n.read_at ? "text-ink-muted" : "font-medium text-ink"}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block text-xs text-ink-muted">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-ink-faint">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
