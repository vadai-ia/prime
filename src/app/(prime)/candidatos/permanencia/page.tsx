import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { countFollowups, listFollowups, UPCOMING_DAYS, type FollowupRow, type FollowupView } from "@/lib/queries/followups";
import { FOLLOWUP_OUTCOME_LABELS, FOLLOWUP_OUTCOME_TONES } from "@/lib/labels";
import { fmtDate, fmtDay, fmtPhone, todayLocal } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { ButtonLink } from "@/components/ui/button";
import { FollowupForm } from "@/components/candidate/followup-form";
import { SimpleTable } from "../../reportes/simple-table";

export const metadata: Metadata = { title: "Permanencia · Prime HR Innovation" };

const VIEWS: { key: FollowupView; label: string }[] = [
  { key: "vencidos", label: "Por capturar" },
  { key: "proximos", label: `Próximos ${UPCOMING_DAYS} días` },
  { key: "capturados", label: "Capturados" },
];

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function dueLabel(due: string, today: string): string {
  const d = daysBetween(today, due);
  if (d === 0) return "vence hoy";
  return d < 0 ? `venció hace ${-d} ${d === -1 ? "día" : "días"}` : `en ${d} ${d === 1 ? "día" : "días"}`;
}

/** Garantía: ¿sigue trabajando a los 30, 90 y 180 días? Los avisos salen solos cada mañana; aquí se capturan. */
export default async function PermanenciaPage({ searchParams }: PageProps<"/candidatos/permanencia">) {
  const session = await requireStaff();
  const vistaParam = (await searchParams).vista;
  const view: FollowupView = VIEWS.some((v) => v.key === vistaParam) ? (vistaParam as FollowupView) : "vencidos";
  const [rows, counts] = await Promise.all([listFollowups(view), countFollowups()]);
  const today = todayLocal();
  const isAdmin = session.role === "admin";

  const tab = (v: (typeof VIEWS)[number]) => {
    const n = v.key === "vencidos" ? counts.vencidos : v.key === "proximos" ? counts.proximos : null;
    const active = v.key === view;
    return (
      <Link
        key={v.key}
        href={`/candidatos/permanencia?vista=${v.key}`}
        className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${active ? "border-forest font-medium text-forest" : "border-transparent text-ink-muted hover:text-ink"}`}
      >
        {v.label}
        {n !== null && <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-mint text-forest" : "bg-canvas text-ink-muted"}`}>{n}</span>}
      </Link>
    );
  };

  const headers = ["Persona", "Vacante", "Ingreso", "Corte", ...(isAdmin ? ["Reclutador"] : []), view === "capturados" ? "Resultado" : "", ""];
  const align: ("left" | "right")[] = headers.map((_, i) => (i === headers.length - 1 ? "right" : "left"));

  const row = (r: FollowupRow) => [
    <div key="p" className="min-w-0">
      <Link href={`/candidatos/${r.application_id}`} className="font-medium text-ink hover:text-forest hover:underline">
        {r.full_name}
      </Link>
      {r.phone_e164 && <p className="text-xs text-ink-muted">{fmtPhone(r.phone_e164)}</p>}
    </div>,
    <div key="v">
      <p>{r.profile_title}</p>
      <p className="text-xs text-ink-muted">{r.client_name}</p>
    </div>,
    <span key="i" className="text-xs text-ink-muted">
      {r.start_date ? fmtDay(r.start_date, { year: "numeric" }) : fmtDate(r.hired_at, { year: "numeric" })}
    </span>,
    <div key="c">
      <p className="font-medium">{r.checkpoint_days} días</p>
      <p className={`text-xs ${r.outcome === "pending" && r.due_at <= today ? "text-amber" : "text-ink-muted"}`}>
        {fmtDay(r.due_at)} · {r.outcome === "pending" ? dueLabel(r.due_at, today) : `capturado ${fmtDate(r.recorded_at)}${r.recorded_by_name ? ` por ${r.recorded_by_name}` : ""}`}
      </p>
    </div>,
    ...(isAdmin ? [<span key="r" className="text-xs text-ink-muted">{r.recruiter_name ?? "—"}</span>] : []),
    view === "capturados" ? (
      <div key="o" className="max-w-xs">
        <Pill tone={FOLLOWUP_OUTCOME_TONES[r.outcome]}>{FOLLOWUP_OUTCOME_LABELS[r.outcome]}</Pill>
        {r.outcome === "left" && (
          <p className="mt-1 text-xs text-ink-muted">
            Salió el {fmtDay(r.left_at, { year: "numeric" })}
            {r.left_reason ? `: ${r.left_reason}` : ""}
          </p>
        )}
        {r.notes && <p className="mt-1 text-xs text-ink-muted">{r.notes}</p>}
      </div>
    ) : (
      ""
    ),
    <div key="a" className="flex justify-end">
      <FollowupForm followupId={r.id} applicationId={r.application_id} current={r.outcome} leftAt={r.left_at} leftReason={r.left_reason} notes={r.notes} />
    </div>,
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/candidatos" className="text-xs text-ink-muted hover:text-forest">
        ← Candidatos
      </Link>
      <PageHeader
        title="Permanencia"
        subtitle="¿Sigue trabajando a los 30, 90 y 180 días de su ingreso? Cada mañana llega un aviso cuando vence un corte."
        actions={
          can(session.role, "export") && (
            <ButtonLink href="/candidatos/exportar?tipo=permanencia" variant="ghost">
              Exportar a Excel
            </ButtonLink>
          )
        }
      />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line">{VIEWS.map(tab)}</nav>
      <SimpleTable
        headers={headers}
        align={align}
        empty={
          view === "vencidos"
            ? "Nada por capturar. Los cortes aparecen aquí cuando se cumplen los 30, 90 o 180 días."
            : view === "proximos"
              ? `Ningún corte vence en los próximos ${UPCOMING_DAYS} días.`
              : "Todavía no se captura ningún corte."
        }
        rows={rows.map(row)}
      />
      <p className="mt-3 text-xs text-ink-faint">&quot;Se fue&quot; en un corte cierra también los siguientes. La etapa del candidato no cambia: sigue como Contratado.</p>
    </div>
  );
}
