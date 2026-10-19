# Próxima sesión · Prime HR Innovation

Escrito el 19 de octubre de 2026 al cierre del día. **Léelo primero.** Después: `tasks.md` (qué está hecho, qué falta y qué pedir a Prime), `plan.md` §12.5 y §12.6 (detalle de lo de hoy) y `CLAUDE.md` (reglas).

## Dónde quedamos

- **Base hospedada en la migración 0018.** Archivos `supabase/manual/01` a `07` aplicados. Lo de hoy no lleva SQL.
- **IA programada, sin probar contra la API** (plan §12.5):
  - wrapper `runAi()` en `src/lib/ai/` (salida con zod, caché, `fallbacks`, registro en `ai_runs`), modelo `claude-opus-5-5`;
  - "Generar con IA" y edición a mano de pesos y umbral en la pestaña Evaluación IA de la vacante;
  - score del CV al dar de alta (en segundo plano con `after()`) y con "Calificar CV" / "Recalificar" en la ficha.
  - Reglas puras en `src/lib/domain/scoring.ts` con 9 pruebas (`npm run test:domain`).
- **Templates de WhatsApp** enviados a revisión de Meta el 19 oct (cuenta y número de prueba del usuario; con el número definitivo hay que mandarlos otra vez).
- **Decisión:** entrevistas por **Teams con Outlook**; ya no Google Meet (plan §4.4 y §12.6). Fireflies se mantiene y entra a Teams; la transcripción nativa de Teams es la alternativa a probar.
- **Verificado:** `tsc`, `eslint src scripts`, `npm run test:domain`, `npm run db:rls-lite` y `next build`.
- **Sin commit.** Todo lo de hoy está en el árbol de trabajo; se commitea cuando el usuario lo decida.

## Siguiente sesión, en este orden

1. **Probar la IA** con la llave puesta (`tasks.md` §7):
   - "Generar con IA" en la vacante de Telasist: revisar criterios, pesos, umbral, preguntas y datos faltantes.
   - Calificar dos o tres CV reales (bueno, regular, malo) y comparar contra el criterio del reclutador.
   - Revisar `ai_runs` (costo, latencia, errores).
   - Ajustar prompts en `src/lib/ai/prompts/` subiendo `PROMPT_VERSION`.
   - Si algo falla contra la API real (forma de la petición, `fallbacks`, esquema), corregir en `src/lib/ai/run.ts`.
2. **`psych_parse`**: leer el PDF de Psicotest ya subido y llenar escalas, `fit_rows`, `fit_pct` y veredicto con el mismo wrapper. Necesita 3 o 4 PDF reales.
3. **Teams sin depender de Prime todavía**: migración con `teams` en `meeting_platform` (por defecto al agendar) y `microsoft` en `integration_provider` y `webhook_source`, con su archivo manual 08, verificación en `db:rls-lite` y el formulario de entrevista con Teams.
4. Cuando el admin de Microsoft 365 de Prime registre la app (`tasks.md` §6): `src/lib/integrations/microsoft-graph.ts` y los tres puntos `INTEGRACIÓN` de `src/actions/interviews.ts`; spike con Fireflies y con la transcripción de Teams.

Si sobra tiempo: cola de tareas (`/api/cron/tick`), o algo sin dependencias de `tasks.md` §8.

## Lo que el usuario tiene pendiente

- Poner `ANTHROPIC_API_KEY` en `.env.local` (y en Vercel) con crédito en la cuenta.
- Conseguir CV reales y PDF de Psicotest.
- Preguntar a Prime quién es el admin de Microsoft 365 y pasarle los pasos de `tasks.md` §6.
- El resto de lo que hay que pedir a Prime está en `tasks.md` §9.

## Cómo se trabaja el SQL aquí

- Cada migración nueva en `supabase/migrations/` lleva su archivo en `supabase/manual/NN_*.sql`, generado con `python scripts/build-manual.py`. Es re-ejecutable, va en una transacción y termina con un checklist de ok / FALTA.
- Antes de pegar algo en el SQL Editor: `npm run db:rls-lite`. Corre en PGlite (Postgres en WASM), sin Docker. Revisar el código de salida de cada suite, no solo la última línea.
- `src/lib/db/types.ts` se edita a mano cuando la migración agrega columnas, enums o RPC.
- Un dato sin el que una pantalla no funciona (catálogos) va en migración, no en `seed.sql`.

## Comandos útiles

- `npm run dev`: app en http://localhost:3000.
- Antes de cerrar: `npm run typecheck`, `npx eslint src scripts`, `npm run test:domain`, `npm run db:rls-lite`, `npm run build`.
- `npm run db:rls-check`, `npm run smoke`, `npm run smoke:pages`: solo con el stack local (Docker), que no se usa aquí.

## Gotchas

- `SUPABASE_SERVICE_ROLE_KEY` con dos llaves pegadas dio "Invalid API key" e "Invalid Compact JWS". Revisar la forma de la llave sin imprimirla.
- Los archivos manuales tienen que poder correrse dos veces: el SQL Editor no lleva historial.
- El SDK de Anthropic manda los `z.enum` como texto libre: en los esquemas de salida de IA se usa `z.string()` y el código normaliza (plan §12.5).
- `next` de este repo es 16.3: leer `node_modules/next/dist/docs/` antes de usar una API (por ejemplo `after()`).

## Decisiones vigentes

- Sin magic link: los tres roles entran con correo y contraseña; las cuentas las crea un admin.
- Una sola organización (Prime) con muchos clientes.
- Claude lee y extrae; el código decide. Ningún descarte automático sale de la IA. Edad como alerta, no bloqueo.
- El cliente ve a los candidatos desde la etapa Psicométrico.
- Contratado → Descartado es "se fue"; "Cancelar contratación" limpia la contratación.
- Videollamadas por Teams con Outlook (Microsoft Graph); Zoom y Meet fuera del MVP.
