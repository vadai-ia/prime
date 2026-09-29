import "server-only";

/**
 * MOCK_DATA en .env.local controla qué vistas usan datos de demo:
 *   1 | all      → todo (clientes, vacantes, candidatos, reportes, portal)
 *   core         → solo clientes, vacantes, levantamientos, usuarios y templates
 *   pipeline     → solo candidatos, entrevistas, psicométricos, expediente, WhatsApp, reportes y portal
 *   (vacío)      → base de datos real en todo
 * Se pueden combinar: MOCK_DATA=core,pipeline equivale a 1.
 */
const scopes = new Set(
  (process.env.MOCK_DATA ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const all = scopes.has("1") || scopes.has("all") || scopes.has("true");

export const MOCK_CORE = all || scopes.has("core");
export const MOCK_PIPELINE = all || scopes.has("pipeline");
export const MOCK = MOCK_CORE || MOCK_PIPELINE;

export const MOCK_WRITE_ERROR = "Modo demo (MOCK_DATA): los cambios no se guardan.";
