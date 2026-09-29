import type { Tone } from "@/lib/labels";

const STROKE: Record<Tone, string> = {
  forest: "stroke-forest",
  mint: "stroke-mint",
  leaf: "stroke-leaf",
  amber: "stroke-amber",
  danger: "stroke-danger",
  info: "stroke-info",
  neutral: "stroke-ink-faint",
};

/** Anillo de porcentaje (score de CV, fit psicométrico, documentos). */
export function Ring({ value, size = 56, tone = "leaf", label }: { value: number; size?: number; tone?: Tone; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-canvas" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className={STROKE[tone]}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-ink text-xs font-semibold" style={{ transformOrigin: "center" }}>
          {Math.round(pct)}
        </text>
      </svg>
      {label && <span className="text-[11px] text-ink-muted">{label}</span>}
    </div>
  );
}
