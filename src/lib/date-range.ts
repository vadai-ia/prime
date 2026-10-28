// Rango de fechas de los filtros (Tablero). Trabaja con días calendario como enteros (días desde 1970,
// los mismos de `dayIndex` en lib/metrics) para comparar sin líos de zona horaria. Sin imports de servidor:
// lo usan la página y el selector del cliente.

export const RANGE_PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
  { key: "anio", label: "Este año" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["key"];

/** Días inclusivos. `preset` es null cuando el rango se eligió en el calendario. */
export type DayRange = { from: number; to: number; preset: RangePreset | null };

export const DEFAULT_PRESET: RangePreset = "30d";
/** Tope de un rango personalizado: tres años. */
export const MAX_RANGE_DAYS = 3 * 366;

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const ymd = (idx: number) => {
  const d = new Date(idx * 864e5);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};
const fromYmd = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 864e5;

export const rangeDays = (r: { from: number; to: number }) => r.to - r.from + 1;

/** "2026-10-27" ↔ día. */
export function dayKey(idx: number): string {
  return new Date(idx * 864e5).toISOString().slice(0, 10);
}

export function parseDayKey(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const idx = fromYmd(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayKey(idx) === s ? idx : null;
}

export function presetRange(preset: RangePreset, today: number): DayRange {
  const { y, m } = ymd(today);
  const span = (days: number) => ({ from: today - days + 1, to: today });
  const r = {
    hoy: span(1),
    "7d": span(7),
    "30d": span(30),
    "90d": span(90),
    mes: { from: fromYmd(y, m, 1), to: today },
    "mes-pasado": { from: fromYmd(y, m - 1, 1), to: fromYmd(y, m, 0) },
    anio: { from: fromYmd(y, 0, 1), to: today },
  }[preset];
  return { ...r, preset };
}

const isPreset = (v: unknown): v is RangePreset => RANGE_PRESETS.some((p) => p.key === v);

/** Lee `periodo` o `desde`/`hasta` de la URL. Lo que no cuadre (fechas al revés, futuras, rango enorme) regresa al predeterminado. */
export function parseRange(sp: Record<string, string | string[] | undefined>, today: number): DayRange {
  if (isPreset(sp.periodo)) return presetRange(sp.periodo, today);
  const from = typeof sp.desde === "string" ? parseDayKey(sp.desde) : null;
  const to = typeof sp.hasta === "string" ? parseDayKey(sp.hasta) : null;
  if (from !== null && to !== null && from <= to && to <= today && to - from < MAX_RANGE_DAYS) return { from, to, preset: null };
  return presetRange(DEFAULT_PRESET, today);
}

/** Parámetros de URL del rango. El predeterminado no se escribe, para que la URL quede limpia. */
export function rangeParams(r: DayRange): Record<string, string> {
  if (r.preset === DEFAULT_PRESET) return {};
  if (r.preset) return { periodo: r.preset };
  return { desde: dayKey(r.from), hasta: dayKey(r.to) };
}

/** El periodo inmediato anterior con los mismos días, para comparar. */
export function previousRange(r: DayRange): DayRange {
  const n = rangeDays(r);
  return { from: r.from - n, to: r.from - 1, preset: null };
}

export function fmtDay(idx: number, withYear = true): string {
  const { y, m, d } = ymd(idx);
  return `${d} ${MONTHS_SHORT[m]}${withYear ? ` ${y}` : ""}`;
}

/** "3 – 15 oct 2026", "28 sep – 27 oct 2026", "15 dic 2025 – 10 ene 2026" o "27 oct 2026". */
export function fmtDayRange(r: { from: number; to: number }): string {
  if (r.from === r.to) return fmtDay(r.from);
  const a = ymd(r.from);
  const b = ymd(r.to);
  if (a.y !== b.y) return `${fmtDay(r.from)} – ${fmtDay(r.to)}`;
  if (a.m !== b.m) return `${fmtDay(r.from, false)} – ${fmtDay(r.to)}`;
  return `${a.d} – ${fmtDay(r.to)}`;
}

export function rangeLabel(r: DayRange): string {
  return RANGE_PRESETS.find((p) => p.key === r.preset)?.label ?? fmtDayRange(r);
}

/** Para los subtítulos: "en los últimos 30 días", "hoy", "este mes", "del 3 al 15 oct 2026". */
const PRESET_PHRASES: Record<RangePreset, string> = {
  hoy: "hoy",
  "7d": "en los últimos 7 días",
  "30d": "en los últimos 30 días",
  "90d": "en los últimos 90 días",
  mes: "este mes",
  "mes-pasado": "el mes pasado",
  anio: "este año",
};

export function rangePhrase(r: DayRange): string {
  if (r.preset) return PRESET_PHRASES[r.preset];
  if (r.from === r.to) return `el ${fmtDay(r.from)}`;
  return `del ${fmtDayRange(r).replace(" – ", " al ")}`;
}

// Calendario: un mes es y*12+m.
export const monthOf = (idx: number) => {
  const { y, m } = ymd(idx);
  return y * 12 + m;
};
export const monthStart = (month: number) => fromYmd(Math.floor(month / 12), month % 12, 1);
export const monthEnd = (month: number) => monthStart(month + 1) - 1;
export function monthLabel(month: number): string {
  const name = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][month % 12];
  return `${name[0].toUpperCase()}${name.slice(1)} ${Math.floor(month / 12)}`;
}
/** Lunes = 0. */
export const weekdayMon = (idx: number) => (new Date(idx * 864e5).getUTCDay() + 6) % 7;
export const dayOfMonth = (idx: number) => ymd(idx).d;
export const monthShort = (month: number) => `${MONTHS_SHORT[month % 12]} ${Math.floor(month / 12)}`;
