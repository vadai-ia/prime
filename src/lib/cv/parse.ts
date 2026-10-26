// Reglas para proponer los campos del alta a partir del texto del CV.
// Son una propuesta: el reclutador revisa y guarda. Sin IO, para poder probarlas solas.
import { toE164Mx } from "@/lib/domain/phone";

export type CvFields = {
  full_name?: string;
  phone?: string; // E.164
  email?: string;
  municipality?: string;
  education_level?: string;
  age_reported?: number;
  birth_date?: string; // yyyy-mm-dd
};

/** Edad válida en el alta (decidido el 26 oct 2026): Prime no registra menores. La base acepta 14 a 99. */
export const AGE_MIN = 18;
export const AGE_MAX = 80;

export function isValidAge(age: number): boolean {
  return Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX;
}

const HEADINGS =
  /^(curr[ií]culum( vitae)?|cv|hoja de vida|datos (personales|generales|de contacto)|informaci[oó]n (personal|de contacto)|perfil( profesional)?|resumen( profesional)?|objetivo( profesional)?|experiencia( laboral| profesional)?|educaci[oó]n|formaci[oó]n( acad[eé]mica)?|contacto|habilidades|aptitudes|idiomas|referencias|sobre m[ií]|acerca de m[ií])$/i;
const NAME_WORD = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+$/;
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "san", "santa"]);
// Puestos y títulos que suelen ir en la primera línea junto al nombre
const NOT_A_NAME =
  /^(ingenier[oa]|ing|licenciad[oa]|lic|t[eé]cnic[oa]|auxiliar|asistente|ejecutiv[oa]|gerente|supervisor[a]?|operador[a]?|operari[oa]|vendedor[a]?|contador[a]?|analista|administrador[a]?|dise[ñn]ador[a]?|desarrollador[a]?|profesional|estudiante|egresad[oa]|pasante|practicante|coordinador[a]?|jefe|jefa|director[a]?|chofer|almacenista|recepcionista|cajer[oa]|promotor[a]?|industrial|gr[aá]fico|ventas|cobranza)$/i;

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// De mayor a menor: gana el nivel más alto que aparezca
const EDUCATION: [RegExp, string][] = [
  [/\bdoctorado\b/i, "Doctorado"],
  [/\bmaestr[ií]a\b/i, "Maestría"],
  [/\b(licenciatura|ingenier[ií]a)\b|\b(lic|ing)\./i, "Licenciatura"],
  [/\bt\.?s\.?u\b|\bt[eé]cnico superior\b/i, "TSU"],
  [/\bcarrera t[eé]cnica\b|\bt[eé]cnico en\b/i, "Carrera técnica"],
  [/\b(preparatoria|bachillerato|cbtis|cetis|conalep|cecyt)\b/i, "Preparatoria"],
  [/\bsecundaria\b/i, "Secundaria"],
  [/\bprimaria\b/i, "Primaria"],
];

const STATE_NAMES: Record<string, string> = {
  ags: "Aguascalientes", jal: "Jalisco", gto: "Guanajuato", qro: "Querétaro", slp: "San Luis Potosí", zac: "Zacatecas", nl: "Nuevo León", cdmx: "Ciudad de México",
};
const STATES =
  "Aguascalientes|Ags|Baja California Sur|Baja California|Campeche|Chiapas|Chihuahua|Ciudad de M[eé]xico|CDMX|Coahuila|Colima|Durango|Guanajuato|Gto|Guerrero|Hidalgo|Jalisco|Jal|Estado de M[eé]xico|Edo\\.? ?M[eé]x|Michoac[aá]n|Morelos|Nayarit|Nuevo Le[oó]n|N\\.?L|Oaxaca|Puebla|Quer[eé]taro|Qro|Quintana Roo|San Luis Potos[ií]|S\\.?L\\.?P|Sinaloa|Sonora|Tabasco|Tamaulipas|Tlaxcala|Veracruz|Yucat[aá]n|Zacatecas|Zac";
const CITY_STATE = new RegExp(`([^,\\n\\d]{3,40}),\\s*(${STATES})\\b`, "i");
const STREET_PART = /^(col|colonia|fracc|fraccionamiento|calle|av|avenida|c\.?p|priv|privada|and|andador|blvd|boulevard)\b/i;

export function parseCvText(raw: string): CvFields {
  const text = raw.replace(/\r/g, "").replace(/[   ]/g, " ");
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const head = lines.slice(0, 40).join("\n");

  const birth = findBirthDate(text);
  return clean({
    full_name: findName(lines),
    phone: findPhone(text),
    email: findEmail(text),
    municipality: findMunicipality(lines, head),
    education_level: findEducation(lines),
    birth_date: birth,
    age_reported: findAge(text) ?? (birth && isValidAge(ageFrom(birth)) ? ageFrom(birth) : undefined),
  });
}

function clean(fields: CvFields): CvFields {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== "")) as CvFields;
}

function findEmail(text: string): string | undefined {
  // Algunos PDF separan la arroba con espacios
  const m = text.replace(/\s*@\s*/g, "@").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
  return m?.[0].toLowerCase();
}

function findPhone(text: string): string | undefined {
  const re = /(?<!\d)(?:\+?52[\s.-]?)?(?:1[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/g;
  let best: { phone: string; score: number } | undefined;
  for (const m of text.matchAll(re)) {
    const phone = toE164Mx(m[0]);
    if (!phone) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const score = /(tel|cel|m[oó]vil|whats|contacto|phone)/i.test(before) ? 2 : 1;
    if (!best || score > best.score) best = { phone, score };
  }
  return best?.phone;
}

function looksLikeName(line: string): boolean {
  if (line.length < 5 || line.length > 60 || /[\d@:/]/.test(line) || HEADINGS.test(line)) return false;
  const words = line.split(" ");
  if (words.length < 2 || words.length > 6) return false;
  if (!words.every((w) => NAME_WORD.test(w)) || words.some((w) => NOT_A_NAME.test(w.replace(/\.$/, "")))) return false;
  return words.filter((w) => w.length >= 2 && !PARTICLES.has(w.toLowerCase())).length >= 2;
}

function titleCase(name: string): string {
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function findName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 40)) {
    const labeled = line.match(/^nombre(?: completo)?\s*[:-]\s*(.+)$/i)?.[1]?.trim();
    if (labeled && looksLikeName(labeled)) return titleCase(labeled);
  }
  const first = lines.slice(0, 12).find(looksLikeName);
  return first ? titleCase(first) : undefined;
}

function findAge(text: string): number | undefined {
  const m = text.match(/\bedad\s*[:-]?\s*(\d{2})\b/i) ?? text.match(/\b(\d{2})\s*años de edad\b/i);
  const age = m ? Number(m[1]) : NaN;
  return isValidAge(age) ? age : undefined;
}

function findBirthDate(text: string): string | undefined {
  const after = text.match(/nacimiento\s*[:-]?\s*([^\n]{6,40})/i)?.[1];
  if (!after) return undefined;
  const numeric = after.match(/(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})/);
  const written = after.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\s*(?:del?\s+)?(\d{4})/i);
  const [d, m, y] = numeric
    ? [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    : written
      ? [Number(written[1]), MONTHS[written[2]!.toLowerCase()] ?? 0, Number(written[3])]
      : [0, 0, 0];
  if (!d || !m || m > 12 || d > 31 || y < 1940 || y > new Date().getFullYear() - 14) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ageFrom(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const now = new Date();
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  return now.getFullYear() - y - (hadBirthday ? 0 : 1);
}

function findMunicipality(lines: string[], head: string): string | undefined {
  for (const line of lines.slice(0, 40)) {
    const labeled = line.match(/^(?:ciudad|municipio|localidad|(?:lugar de )?residencia)\s*[:-]\s*([^,;|]{3,40})/i)?.[1]?.trim();
    if (labeled) return labeled;
  }
  const m = head.match(CITY_STATE);
  if (!m) return undefined;
  const city = m[1]!.replace(/^.*[|•·]/, "").trim();
  if (city && !STREET_PART.test(city)) return city;
  // "Col. Centro, Aguascalientes": la colonia no sirve, pero el estado también es la ciudad
  const state = m[2]!.replace(/\./g, "").toLowerCase();
  return STATE_NAMES[state] ?? (m[2]!.length > 4 ? m[2] : undefined);
}

function findEducation(lines: string[]): string | undefined {
  for (const [re, label] of EDUCATION) {
    const line = lines.find((l) => re.test(l))?.replace(/^(escolaridad|educaci[oó]n|estudios|formaci[oó]n( acad[eé]mica)?)\s*[:-]\s*/i, "");
    if (line) return line.length <= 70 ? line : label;
  }
  return undefined;
}
