import type { Enums } from "@/lib/db/types";
import { CHANNEL_LABELS } from "@/lib/labels";

// Colores de cada bolsa (los de la demo); Bolsa Prime usa el verde de marca.
const CHANNEL_COLORS: Record<Enums<"source_channel">, string> = {
  pandape: "#f26522",
  facebook: "#1877f2",
  linkedin: "#0a66c2",
  prime_pool: "var(--leaf)",
  referral: "var(--info)",
  other: "var(--ink-faint)",
};

export function ChannelDot({ channel, count }: { channel: Enums<"source_channel">; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="inline-block size-2 rounded-full" style={{ background: CHANNEL_COLORS[channel] }} />
      {CHANNEL_LABELS[channel]}
      {count !== undefined && <span className="font-semibold text-ink">{count}</span>}
    </span>
  );
}
