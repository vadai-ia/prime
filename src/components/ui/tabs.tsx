"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { key: string; label: string; badge?: ReactNode; content: ReactNode };

/** Pestañas con contenido ya renderizado en el servidor (se pasa como ReactNode). */
export function Tabs({ items, initial }: { items: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? items[0]?.key);
  const current = items.find((i) => i.key === active) ?? items[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item) => {
          const isActive = item.key === current?.key;
          return (
            <button
              key={item.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(item.key)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                isActive ? "border-forest font-medium text-forest" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
              {item.badge !== undefined && (
                <span className={`rounded-full px-1.5 text-[11px] ${isActive ? "bg-mint text-forest" : "bg-canvas text-ink-muted"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-5">{current?.content}</div>
    </div>
  );
}
