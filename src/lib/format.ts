// Formato es-MX. Sin dependencias: Intl basta para fechas, moneda y números.
const TZ = process.env.APP_TIMEZONE ?? "America/Mexico_City";
const LOCALE = "es-MX";

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short", ...opts }).format(new Date(iso));
}

export function fmtDateLong(iso: string | null | undefined): string {
  return fmtDate(iso, { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function fmtMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function fmtMonths(months: number | null | undefined): string {
  if (months === null || months === undefined) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? "año" : "años"}`);
  if (m || !y) parts.push(`${m} ${m === 1 ? "mes" : "meses"}`);
  return parts.join(" ");
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  return `${min} min`;
}

export function daysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

export function hoursLabel(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 24) return `${Math.round(hours)} h`;
  const d = hours / 24;
  return `${d.toFixed(d < 10 ? 1 : 0)} d`;
}

export function fmtPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const m = e164.match(/^\+52(1)?(\d{3})(\d{3})(\d{4})$/);
  if (m) return `+52 ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/** Fecha sin hora de la base ("2026-11-20", columnas date): se formatea tal cual, sin moverla de zona. */
export function fmtDay(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short", ...opts }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/** Hoy en la zona de la app, como "2026-10-21". */
export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
