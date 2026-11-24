import { utcIsoToZoned, zonedToUtcIso } from "@/lib/domain/time";

// Cuándo salen los correos (decidido el 23 nov 2026): todos con el cron de las 8:00 y con lo del día
// que terminó ayer. Lo comparten el envío (reports.ts) y la vista previa en Reportes.

const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** El "ahora" de los reportes de la mañana: ayer a las 23:59 en México ("hoy" = ayer, "mañana" = hoy). */
export function reportReferenceNow(now = new Date()): Date {
  const today = utcIsoToZoned(now.toISOString(), TZ).date;
  return new Date(zonedToUtcIso(addDays(today, -1), "23:59", TZ)!);
}

/** Día de la semana local (0 = domingo), como clients.weekly_report_dow. */
export function localDow(now = new Date()): number {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
}
