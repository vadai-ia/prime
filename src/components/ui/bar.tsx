import type { Tone } from "@/lib/labels";

const FILL: Record<Tone, string> = {
  forest: "bg-forest",
  mint: "bg-mint",
  leaf: "bg-leaf",
  amber: "bg-amber",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-faint",
};

export function Bar({ value, max = 100, tone = "leaf", label, className = "" }: { value: number; max?: number; tone?: Tone; label?: string; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-ink-muted">
          <span>{label}</span>
          <span className="text-ink">{Math.round(value)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
