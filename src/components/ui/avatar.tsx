import { initials } from "@/lib/format";

const SIZES = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" };

export function Avatar({ name, size = "md" }: { name: string | null | undefined; size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-mint font-semibold text-forest ${SIZES[size]}`}>
      {initials(name)}
    </span>
  );
}
