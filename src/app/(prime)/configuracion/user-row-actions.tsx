"use client";

import { useState, useTransition } from "react";
import { setUserActive, setUserName } from "@/actions/users";

export function UserRowActions({ userId, fullName, isActive, isSelf }: { userId: string; fullName: string; isActive: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fullName);

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center justify-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await setUserName(userId, name);
            setError(result?.error ?? null);
            if (!result?.error) setEditing(false);
          });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          autoFocus
          aria-label="Nombre"
          placeholder="Nombre y apellido"
          className="w-44 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink"
        />
        <button type="submit" disabled={pending} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-white transition hover:bg-forest-deep disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-canvas">
          Cancelar
        </button>
        {error && <p className="w-full text-right text-[11px] text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-canvas hover:text-ink">
          {fullName ? "Editar nombre" : "Poner nombre"}
        </button>
        {isSelf ? (
          <span className="text-xs text-ink-faint">Tu cuenta</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await setUserActive(userId, !isActive);
                setError(result?.error ?? null);
              })
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              isActive ? "bg-danger-soft text-danger hover:bg-danger hover:text-white" : "bg-mint text-forest hover:bg-forest hover:text-white"
            }`}
          >
            {pending ? "Guardando…" : isActive ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>
      {error && <p className="mt-1 max-w-56 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
