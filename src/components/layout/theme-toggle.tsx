"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { readThemePref, saveThemePref, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

// La preferencia vive en localStorage: se lee como store externo (sin efecto) y se avisa a quien la muestre.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Selector Claro / Oscuro / Sistema. `onChrome`: sobre el menú negro; si no, sobre una tarjeta o header. `vertical`: menú plegado. */
export function ThemeToggle({ onChrome = false, vertical = false }: { onChrome?: boolean; vertical?: boolean }) {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => "system" as const);

  function choose(value: ThemePref) {
    saveThemePref(value);
    listeners.forEach((l) => l());
  }

  return (
    <div role="radiogroup" aria-label="Tema" className={`inline-flex rounded-lg p-0.5 ${vertical ? "flex-col" : ""} ${onChrome ? "bg-white/10" : "border border-line bg-canvas"}`}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={`inline-flex size-7 items-center justify-center rounded-md transition ${
              onChrome
                ? active
                  ? "bg-lime text-black"
                  : "text-white/70 hover:text-white"
                : active
                  ? "bg-surface text-forest shadow-sm"
                  : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
