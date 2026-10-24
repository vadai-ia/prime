import type { ReactNode } from "react";
import { STAGE_LABELS, STAGE_TONES, type Stage, type Tone } from "@/lib/labels";

const TONES: Record<Tone, string> = {
  forest: "bg-forest text-on-forest",
  mint: "bg-mint text-forest",
  leaf: "bg-leaf text-on-forest",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "border border-line bg-canvas text-ink-muted",
};

export function Pill({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StagePill({ stage }: { stage: Stage | null | undefined }) {
  if (!stage) return <Pill>—</Pill>;
  return <Pill tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Pill>;
}
