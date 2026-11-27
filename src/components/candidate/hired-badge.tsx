import { BadgeCheck } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { fmtDate } from "@/lib/format";

/**
 * Distintivo de contratado (migración 0034, `candidates.hired_badge_at`). Lo pone y lo quita la base.
 * En la postulación por la que está contratado dice "Contratado"; en cualquier otra vacante avisa que
 * la persona ya trabaja por Prime (sin decir el cliente: quizá quien la ve no tiene esa vacante).
 */
export function HiredBadge({ badgeAt, hiredApplicationId, applicationId }: { badgeAt: string | null; hiredApplicationId: string | null; applicationId: string | null }) {
  if (!badgeAt) return null;
  const here = hiredApplicationId === applicationId;
  return (
    <span title={here ? `Contratado por Prime desde el ${fmtDate(badgeAt, { day: "numeric", month: "long", year: "numeric" })}` : `Esta persona ya está contratada por Prime en otra vacante desde el ${fmtDate(badgeAt, { day: "numeric", month: "long", year: "numeric" })}`}>
      <Pill tone={here ? "forest" : "amber"}>
        <BadgeCheck className="h-3 w-3" aria-hidden />
        {here ? `Contratado · ${fmtDate(badgeAt)}` : "Ya contratado por Prime"}
      </Pill>
    </span>
  );
}
