import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, backHref }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; backHref?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {backHref && (
          <a href={backHref} className="text-xs text-ink-muted hover:text-forest">
            ← Volver
          </a>
        )}
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
