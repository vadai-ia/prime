"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Modal con <dialog>. El contenido se monta solo mientras está abierto, así que un formulario
 * empieza limpio cada vez y puede generar datos en el navegador (por ejemplo, una contraseña).
 */
export function Modal({
  title,
  subtitle,
  trigger,
  size = "md",
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trigger: (open: () => void) => ReactNode;
  size?: "md" | "lg";
  children: (close: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        className={`m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-2xl" : "max-w-md"} rounded-card border border-line bg-canvas p-0 text-left shadow-xl backdrop:bg-black/40`}
      >
        {open && (
          <>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                {subtitle && <div className="text-xs text-ink-muted">{subtitle}</div>}
              </div>
              <button type="button" onClick={close} aria-label="Cerrar" className="rounded-lg px-2 py-1 text-xl leading-none text-ink-muted transition hover:bg-canvas hover:text-ink">
                ×
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children(close)}</div>
          </>
        )}
      </dialog>
    </>
  );
}
