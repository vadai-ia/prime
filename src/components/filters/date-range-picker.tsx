"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  MAX_RANGE_DAYS,
  RANGE_PRESETS,
  dayOfMonth,
  fmtDay,
  fmtDayRange,
  monthEnd,
  monthLabel,
  monthOf,
  monthStart,
  presetRange,
  rangeDays,
  rangeLabel,
  rangeParams,
  weekdayMon,
  type DayRange,
} from "@/lib/date-range";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** Arriba de este ancho se ven dos meses; abajo, uno. Igual que `lg:` de Tailwind. */
const TWO_MONTHS_QUERY = "(min-width: 1024px)";

type Draft = { from: number | null; to: number | null };

/**
 * Selector de periodo: atajos (un clic aplica) y calendario para un rango propio (día inicial, día final, Aplicar).
 * Escribe `periodo` o `desde`/`hasta` en la URL y el servidor recalcula; `keep` conserva los demás filtros.
 * Los días son enteros de `lib/date-range` y `today` viene del servidor, para que servidor y navegador coincidan.
 */
export function DateRangePicker({ path, today, value, keep = {} }: { path: string; today: number; value: DayRange; keep?: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ from: value.from, to: value.to });
  const [hover, setHover] = useState<number | null>(null);
  // Mes de la derecha (el único en pantallas chicas).
  const [view, setView] = useState(monthOf(value.to));
  const [focusDay, setFocusDay] = useState(value.to);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  function show() {
    setDraft({ from: value.from, to: value.to });
    setHover(null);
    setView(monthOf(value.to));
    setFocusDay(value.to);
    moveFocus.current = true;
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function apply(r: DayRange) {
    setOpen(false);
    const p = new URLSearchParams({ ...keep, ...rangeParams(r) });
    const qs = p.toString();
    startTransition(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Solo se mueve el foco cuando lo pidió el teclado o al abrir, no con el mouse.
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay, view]);

  function pick(d: number) {
    setFocusDay(d);
    if (draft.from === null || draft.to !== null) setDraft({ from: d, to: null });
    else setDraft(d < draft.from ? { from: d, to: draft.from } : { from: draft.from, to: d });
  }

  function onDayKey(e: KeyboardEvent<HTMLButtonElement>, d: number) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekdayMon(d), End: 6 - weekdayMon(d) };
    let next: number | undefined;
    if (e.key in step) next = d + step[e.key];
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const target = monthOf(d) + (e.key === "PageUp" ? -1 : 1);
      next = Math.min(monthStart(target) + dayOfMonth(d) - 1, monthEnd(target));
    }
    if (next === undefined) return;
    e.preventDefault();
    next = Math.min(next, today);
    const first = window.matchMedia(TWO_MONTHS_QUERY).matches ? view - 1 : view;
    const m = monthOf(next);
    if (m > view) setView(m);
    else if (m < first) setView(m + (view - first));
    moveFocus.current = true;
    setFocusDay(next);
    if (draft.from !== null && draft.to === null) setHover(next);
  }

  // Banda que se pinta: el borrador completo, o del día inicial al que está bajo el cursor.
  const end = draft.to ?? (draft.from !== null ? hover : null);
  const lo = draft.from === null ? null : end === null ? draft.from : Math.min(draft.from, end);
  const hi = draft.from === null ? null : end === null ? draft.from : Math.max(draft.from, end);
  const previewing = draft.from !== null && draft.to === null;
  const complete = draft.from !== null && draft.to !== null;
  const tooLong = complete && rangeDays({ from: draft.from!, to: draft.to! }) > MAX_RANGE_DAYS;

  // Función y no componente: un componente declarado aquí se volvería a montar en cada render y perdería el foco.
  function renderMonth(month: number, className = "") {
    const first = monthStart(month);
    const last = monthEnd(month);
    const lead = weekdayMon(first);
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: last - first + 1 }, (_, i) => first + i)];
    while (cells.length < 42) cells.push(null);
    return (
      <div key={month} className={className}>
        <p className="mb-2 h-8 text-center text-sm font-semibold leading-8 text-ink">{monthLabel(month)}</p>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-faint" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="pb-1">
              {w}
            </span>
          ))}
        </div>
        <div role="grid" aria-label={monthLabel(month)} className="grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} className="size-9" />;
            const future = d > today;
            const inBand = lo !== null && hi !== null && d >= lo && d <= hi;
            const isEdge = d === lo || d === hi;
            const col = i % 7;
            const band = inBand && lo !== hi ? (previewing ? "bg-leaf/10" : "bg-leaf/15") : "";
            const roundL = d === lo || col === 0 || d === first ? "rounded-l-lg" : "";
            const roundR = d === hi || col === 6 || d === last ? "rounded-r-lg" : "";
            return (
              <div key={d} role="gridcell" aria-selected={inBand} className={`flex justify-center ${band} ${band ? `${roundL} ${roundR}` : ""}`}>
                <button
                  type="button"
                  data-day={d}
                  disabled={future}
                  tabIndex={d === focusDay ? 0 : -1}
                  onClick={() => pick(d)}
                  onMouseEnter={() => previewing && setHover(d)}
                  onFocus={() => previewing && setHover(d)}
                  onKeyDown={(e) => onDayKey(e, d)}
                  aria-label={`${WEEKDAY_NAMES[weekdayMon(d)]} ${fmtDay(d)}${d === today ? ", hoy" : ""}`}
                  aria-current={d === today ? "date" : undefined}
                  className={`relative size-9 rounded-lg text-sm tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-leaf ${
                    isEdge && inBand
                      ? "bg-forest font-semibold text-on-forest"
                      : future
                        ? "cursor-not-allowed text-ink-faint/40"
                        : inBand
                          ? "text-ink hover:bg-leaf/25"
                          : "text-ink hover:bg-canvas"
                  } ${d === today && !(isEdge && inBand) ? "font-semibold text-forest" : ""}`}
                >
                  {dayOfMonth(d)}
                  {d === today && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${isEdge && inBand ? "bg-on-forest" : "bg-forest"}`} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const status = tooLong
    ? "El periodo no puede pasar de tres años"
    : complete
      ? `${fmtDayRange({ from: draft.from!, to: draft.to! })} · ${rangeDays({ from: draft.from!, to: draft.to! })} ${rangeDays({ from: draft.from!, to: draft.to! }) === 1 ? "día" : "días"}`
      : draft.from !== null
        ? `Desde ${fmtDay(draft.from)} · elige el día final`
        : "Elige el día inicial";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Periodo: ${rangeLabel(value)}, ${fmtDayRange(value)}`}
        className={`inline-flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none transition hover:bg-canvas focus-visible:border-leaf focus-visible:ring-2 focus-visible:ring-leaf/25 ${open ? "border-leaf ring-2 ring-leaf/25" : "border-line"}`}
      >
        {pending ? <Loader2 className="size-4 animate-spin text-forest" aria-hidden /> : <CalendarDays className="size-4 text-forest" aria-hidden />}
        <span className="font-medium">{rangeLabel(value)}</span>
        {value.preset && <span className="hidden text-ink-faint sm:inline">{fmtDayRange(value)}</span>}
        <ChevronDown className={`size-4 text-ink-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Elegir periodo"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:overflow-visible md:rounded-card"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
            <div className="flex flex-col md:flex-row">
              <ul className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line p-3 md:w-44 md:flex-col md:gap-0.5 md:overflow-visible md:border-b-0 md:border-r">
                {RANGE_PRESETS.map((p) => {
                  const active = value.preset === p.key;
                  return (
                    <li key={p.key} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => apply(presetRange(p.key, today))}
                        aria-pressed={active}
                        className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition md:rounded-lg md:border-0 md:py-2 ${
                          active ? "border-forest bg-forest/10 font-medium text-forest" : "border-line text-ink hover:bg-canvas"
                        }`}
                      >
                        {p.label}
                        {active && <Check className="hidden size-4 md:block" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
                <li className="hidden px-3 pt-2 text-[11px] leading-snug text-ink-faint md:block">O elige el día inicial y el final en el calendario.</li>
              </ul>

              <div className="p-4">
                <div ref={gridRef} className="relative flex justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => setView((v) => v - 1)}
                    aria-label="Mes anterior"
                    className="absolute left-0 top-0 grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-canvas hover:text-ink"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView((v) => v + 1)}
                    disabled={view >= monthOf(today)}
                    aria-label="Mes siguiente"
                    className="absolute right-0 top-0 grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  {renderMonth(view - 1, "hidden lg:block")}
                  {renderMonth(view)}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-sm ${tooLong ? "text-danger" : complete ? "font-medium text-ink" : "text-ink-muted"}`} aria-live="polite">
                    {status}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={close} className="flex-1 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink sm:flex-none">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!complete || tooLong}
                      onClick={() => apply({ from: draft.from!, to: draft.to!, preset: null })}
                      className="flex-1 rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep disabled:opacity-40 sm:flex-none"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
