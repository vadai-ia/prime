/** Normaliza un teléfono a E.164. Sin lada de país se asume México (+52 y 10 dígitos). Devuelve null si no se puede. */
export function toE164Mx(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  let d = raw.replace(/\D/g, "");

  // Ya viene en E.164 de otro país
  if (raw.startsWith("+") && !d.startsWith("52")) return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;

  if (d.length === 13 && d.startsWith("521")) d = d.slice(3); // +52 1: móvil en el formato anterior a 2019
  else if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
  else if (d.length === 13 && /^04[45]/.test(d)) d = d.slice(3); // 044 y 045
  else if (d.length === 12 && d.startsWith("01")) d = d.slice(2); // 01 de larga distancia

  return d.length === 10 && d[0] !== "0" ? `+52${d}` : null;
}
