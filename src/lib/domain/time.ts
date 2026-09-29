// Fechas de negocio en la zona de la app (America/Mexico_City). Sin dependencias: Intl basta.
const TZ = process.env.APP_TIMEZONE ?? "America/Mexico_City";

/** Minutos que la zona va adelantada respecto a UTC en ese instante (negativo al oeste). */
function offsetMinutes(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-09-25" + "10:30" en la zona de la app → ISO en UTC. Null si la fecha o la hora no son válidas. */
export function zonedToUtcIso(date: string, time: string, tz: string = TZ): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Date.UTC desborda en silencio (mes 13, día 40, hora 25): si no regresa lo mismo, no era válida
  if (Number.isNaN(wall) || new Date(wall).toISOString().slice(0, 16) !== `${date}T${time}`) return null;
  // dos pasadas por si el primer cálculo cae del otro lado de un cambio de horario
  let utc = wall - offsetMinutes(new Date(wall), tz) * 60000;
  utc = wall - offsetMinutes(new Date(utc), tz) * 60000;
  return new Date(utc).toISOString();
}

/** ISO → { date: "2026-09-25", time: "10:30" } en la zona de la app, para los valores por defecto de un formulario. */
export function utcIsoToZoned(iso: string | null | undefined, tz: string = TZ): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const instant = new Date(iso);
  const shifted = new Date(instant.getTime() + offsetMinutes(instant, tz) * 60000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
