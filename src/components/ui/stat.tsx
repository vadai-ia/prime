import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "forest" | "amber" | "danger" | "leaf";
}) {
  const color = { ink: "text-ink", forest: "text-forest", amber: "text-amber", danger: "text-danger", leaf: "text-leaf" }[tone];
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
