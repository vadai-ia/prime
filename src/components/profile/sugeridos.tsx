"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addSuggestion, dismissSuggestion, searchProfileSuggestions } from "@/actions/suggestions";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { alertErrorClass, alertSuccessClass } from "@/components/ui/form";
import { DISCARD_REASON_LABELS, STAGE_LABELS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import type { ProfileSuggestion, SuggestionHistoryItem } from "@/lib/queries/suggestions";

/** Cada cuánto se recarga la lista mientras la IA califica. */
const POLL_MS = 5000;
/** Tras pedir la búsqueda, cuánto se espera a que aparezcan los primeros sugeridos. */
const SEARCH_WAIT_MS = 90_000;

/** Botón del menú de la vacante (solo admin): arranca la correlación y abre la pestaña Sugeridos. */
export function CorrelateButton({ profileId, disabledReason }: { profileId: string; disabledReason: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const r = await searchProfileSuggestions(profileId);
      if (r?.error) {
        setError(r.error);
        return;
      }
      router.push(`/perfiles/${profileId}?tab=sugeridos&buscando=${Date.now()}`, { scroll: false });
    });
  }

  return (
    <span className="relative inline-flex">
      <Button
        type="button"
        variant="secondary"
        onClick={run}
        disabled={pending || !!disabledReason}
        title={disabledReason ?? "La IA busca en otras vacantes (de cualquier cliente) a quien encaje en esta"}
      >
        {pending ? "Correlacionando…" : "Correlacionar candidatos de otra vacante"}
      </Button>
      {error && (
        <span role="alert" className={`${alertErrorClass} absolute right-0 top-full z-10 mt-2 w-72`}>
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Pestaña "Sugeridos" de la vacante (solo admin, plan §12.25): personas que ya pasaron por Prime en
 * otras vacantes, de cualquier cliente, calificadas por la IA con los criterios de esta vacante.
 */
export function Sugeridos({
  profileId,
  suggestions,
  canSearch,
  blockedReason,
  threshold,
  searchStartedAt,
}: {
  profileId: string;
  suggestions: ProfileSuggestion[];
  canSearch: boolean;
  blockedReason: string | null;
  threshold: number | null;
  /** Cuándo se pidió la búsqueda desde el menú de la vacante (?buscando=), para esperar resultados. */
  searchStartedAt: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startedAt, setStartedAt] = useState<number | null>(searchStartedAt);
  const [notice, setNotice] = useState<{ error?: string; message?: string } | null>(
    searchStartedAt ? { message: "Correlacionando… la IA califica a cada candidato (unos 30 a 60 s). La lista se actualiza sola." } : null,
  );
  const scoring = suggestions.some((s) => s.status === "pending");
  const [now, setNow] = useState(() => Date.now());
  const waiting = startedAt !== null && now - startedAt < SEARCH_WAIT_MS;

  // Mientras haya sugeridos por calificar (o se acaba de pedir la búsqueda), la lista se refresca sola.
  useEffect(() => {
    if (!scoring && !waiting) return;
    const t = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [scoring, waiting, router]);

  function search() {
    setNotice(null);
    startTransition(async () => {
      const r = await searchProfileSuggestions(profileId);
      setNotice(r?.error ? { error: r.error } : { message: r?.message });
      if (!r?.error) {
        setStartedAt(Date.now());
        setNow(Date.now());
      }
      router.refresh();
    });
  }

  const open = suggestions.filter((s) => s.status !== "added");
  const added = suggestions.filter((s) => s.status === "added");

  return (
    <div className="space-y-5">
      <Card
        title="Candidatos de otras vacantes"
        subtitle="Personas que ya pasaron por Prime en otra vacante (de cualquier cliente), calificadas por la IA con los criterios del CV de esta vacante. Solo las ve un administrador. No aparecen la lista negra, quien sigue en proceso ni quien trabaja por Prime."
        action={
          <Button type="button" onClick={search} disabled={!canSearch || pending || scoring} className="shrink-0">
            {pending ? "Correlacionando…" : scoring ? "Calificando…" : suggestions.length > 0 ? "Buscar más" : "Correlacionar candidatos"}
          </Button>
        }
      >
        {blockedReason && <p className="text-sm text-ink-muted">{blockedReason}</p>}
        {notice?.error && (
          <p role="alert" className={alertErrorClass}>
            {notice.error}
          </p>
        )}
        {notice?.message && !notice.error && (
          <p role="status" className={alertSuccessClass}>
            {notice.message}
          </p>
        )}
        {!blockedReason && !notice && open.length === 0 && (
          <p className="text-sm text-ink-muted">
            {suggestions.length === 0 ? "Todavía no se ha buscado. La IA califica hasta 12 candidatos por búsqueda." : "No hay sugerencias pendientes. Busca más para traer a los siguientes."}
          </p>
        )}
      </Card>

      {open.length > 0 && (
        <Card padded={false} title="Sugeridos" subtitle="Del más al menos parecido. Agregar crea una postulación nueva en esta vacante (canal Bolsa Prime) y le manda el primer contacto por WhatsApp.">
          <ul className="divide-y divide-line">
            {open.map((s) => (
              <SuggestionRow key={s.id} s={s} threshold={threshold} />
            ))}
          </ul>
        </Card>
      )}

      {added.length > 0 && (
        <Card padded={false} title="Agregados a esta vacante">
          <ul className="divide-y divide-line">
            {added.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{s.full_name}</span>
                {s.added_application_id && (
                  <Link href={`/candidatos/${s.added_application_id}`} className="shrink-0 text-forest hover:underline">
                    Abrir ficha
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SuggestionRow({ s, threshold }: { s: ProfileSuggestion; threshold: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const r = await action(s.id);
      if (r?.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{s.full_name}</span>
          <ScorePill s={s} threshold={threshold} />
          {s.municipality && <span className="text-xs text-ink-muted">{s.municipality}</span>}
        </div>
        <History items={s.history} />
        {s.rationale && <p className="text-sm text-ink">{s.rationale}</p>}
        {s.flags && <p className="text-xs text-amber">Revisar: {s.flags}</p>}
        {s.status === "failed" && s.error && <p className="text-xs text-danger">No se pudo calificar: {s.error} Se reintenta en la siguiente búsqueda.</p>}
        {error && (
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run(dismissSuggestion)}>
          No me sirve
        </Button>
        <Button type="button" disabled={pending} onClick={() => run(addSuggestion)}>
          {pending ? "Guardando…" : "Agregar a la vacante"}
        </Button>
      </div>
    </li>
  );
}

function ScorePill({ s, threshold }: { s: ProfileSuggestion; threshold: number | null }) {
  if (s.status === "pending") return <Pill tone="info">Calificando…</Pill>;
  if (s.status === "failed" || s.cv_score === null) return <Pill tone="danger">Sin calificar</Pill>;
  const passes = threshold === null || s.cv_score >= threshold;
  return <Pill tone={passes ? "leaf" : "amber"}>{s.cv_score} / 100</Pill>;
}

/** En qué vacantes se ha postulado la persona (cualquier cliente) y cómo le fue en cada una. */
function History({ items }: { items: SuggestionHistoryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="text-xs text-ink-muted">
      <p className="font-medium text-ink">
        Se ha postulado a {items.length} {items.length === 1 ? "vacante" : "vacantes"}:
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((h) => (
          <li key={h.application_id}>
            <Link href={`/candidatos/${h.application_id}`} className="text-forest hover:underline">
              {h.profile_title}
            </Link>{" "}
            · {h.client_name} · {outcome(h)} · {fmtDate(h.applied_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function outcome(h: SuggestionHistoryItem): string {
  if (h.stage === "discarded") return h.discard_reason_key ? `Descartado: ${DISCARD_REASON_LABELS[h.discard_reason_key].toLowerCase()}` : "Descartado";
  return STAGE_LABELS[h.stage];
}
