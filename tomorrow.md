# Próxima sesión · Prime HR Innovation

Escrito el 21 de septiembre de 2026 al cierre del día. Léelo primero; `plan.md` (§12.2 a §12.4) tiene el detalle de lo que se hizo y `CLAUDE.md` las reglas.

## Dónde quedamos

- **Base hospedada en la migración 0017.** Los archivos `supabase/manual/01` a `06` ya están aplicados. Falta el `07` (ver abajo).
- **Datos reales.** `MOCK_DATA=` vacío. Telasist con datos completos, una vacante con reclutador asignado y un candidato que pasó por CV, entrevista, psicométrico y expediente. Probado a mano hasta el aislamiento del reclutador (pasos 1 a 14 del recorrido). Falta el portal del cliente (pasos 15 y 16).
- **Reglas nuevas desde la junta del 11 sep:** el reclutador solo ve sus vacantes asignadas y sus candidatos; round robin al entrar un candidato; exportar, inactivos y lista negra son solo de admin.
- **Captura manual completa:** editar cliente y vacante, agenda de entrevistas (agendar, reagendar, confirmar, no se presentó, cancelar, realizada con notas), psicométrico (enlace, PDF, veredicto), expediente (subir, ver, validar, rechazar), historial de la persona por teléfono, kanban arrastrable en ambos sentidos, regresar de etapa y cancelar contratación.
- **Verificado:** `tsc`, `eslint`, `next build` (29 rutas) y `npm run db:rls-lite` (4 suites, 114 verificaciones, por migraciones y por archivos manuales). Lo que no se probó en navegador: cancelar contratación, el arrastre del kanban y el portal.
- **Nada está commiteado.** Se commitea cuando tú lo decidas.

## Mañana, en este orden

1. ~~Pegar `supabase/manual/07_cancelar_contratacion.sql`~~ Aplicado (checklist 2/2 ok, confirmado el 23 sep 2026). La base hospedada está en la 0018.
2. **Terminar el recorrido:** pasos 15 y 16 (portal del cliente y Vo.Bo.), y de paso probar en navegador el arrastre del kanban y "Cancelar contratación" en el contratado.
3. ~~Borrar `src/app/api/webhooks/cvtest/route.ts`~~ Borrada el 23 sep 2026.
4. **IA.** Poner `ANTHROPIC_API_KEY` en `.env.local` y construir, en este orden:
   - `src/lib/ai/client.ts` y `run.ts`: wrapper con `messages.parse()`, esquema zod, registro en `ai_runs`, `fallbacks`.
   - `profile_generation`: del levantamiento al descriptivo y a la configuración de evaluación (pesos del CV, umbral, preguntas del agente, mínimos psicométricos). Botón "Generar evaluación" en la pestaña Evaluación IA de la vacante, con edición a mano de lo que genere.
   - `cv_score`: puntuación del CV contra los pesos al dar de alta al candidato. Lo que la propuesta llama "evaluación automática".
   - `psych_parse`: leer el PDF de Psicotest ya subido y llenar escalas y resumen (hoy el veredicto se captura a mano).
   - `interview_analysis` queda para cuando Fireflies entregue transcripciones.
   Reglas ya decididas: Claude lee y extrae, el código decide; ningún descarte automático sale de la IA; edad y sexo como alerta, no bloqueo.
5. **Google Calendar + Fireflies.** Entran en los tres puntos marcados `INTEGRACIÓN` en `src/actions/interviews.ts` (crear, mover, cancelar el evento). Necesita credenciales OAuth de Google Cloud y la API key de Fireflies de Prime.
6. **Whaapy** al final: entrada inbound (el candidato escribe primero y el agente pide el CV), prefiltro, documentos por WhatsApp.

Si sobra tiempo, sin dependencias externas: campana de notificaciones en el menú (`notifications`, `mark_notifications_read`); pantalla de permanencia a 30/90/180 días (`placement_followups`, `v_bi_retention`); filtro por reclutador en Tablero y Entrevistas para admin (`v_pipeline` ya trae `assigned_recruiter_name`); lista negra e inactivos; importación de Excel, clientes y vacantes; PDF del reporte semanal.

## Lo que hay que pedir a Prime

- De quién será la cuenta de Anthropic (bloquea el paso 4).
- Google Meet o Zoom, y quién autoriza el proyecto de Google Cloud (bloquea el paso 5).
- Cuenta de Fireflies de la empresa y su API key.
- Número de WhatsApp nuevo para Whaapy.
- Archivos de muestra: el Excel de levantamiento, el formato D.P., dos o tres CV reales, tres o cuatro PDF de Psicotest, el guion de entrevista, la base histórica de Excel, muestras de Black Trust y socioeconómico.
- El texto del aviso de privacidad y el plazo de conservación de datos de descartados.
- El formato de la hoja de confirmación.
- Quién captura la permanencia a 30, 90 y 180 días: reclutador o cliente.
- Confirmar tres decisiones que tomé: solo se asignan candidatos a usuarios con rol reclutador (un admin no recibe); al relevar a un reclutador sus candidatos se reparten solos; el reclutador no ve quién más trabaja su vacante.

## Pendientes de configuración (no bloquean)

- Colores reales: sustituir los provisionales de `src/app/globals.css` cuando lleguen los valores del diseño.
- Dashboard de Supabase: Site URL y redirect URLs con el dominio, templates de invitación y recuperación (`supabase/templates/`), SMTP de Resend. Mientras, las cuentas se crean con contraseña temporal desde Configuración.
- Vercel: proyecto, dominio y variables de entorno.
- Whaapy: mandar los seis templates a aprobación de Meta cuanto antes, tardan días. Ya están registrados en la base (inactivos).
- "Última vez" en Configuración siempre dice "Nunca": nada actualiza `last_seen_at` todavía.

## Cómo se trabaja el SQL aquí

- Cada migración nueva en `supabase/migrations/` lleva su archivo en `supabase/manual/NN_*.sql`, generado con `python scripts/build-manual.py`. Es re-ejecutable, va en una transacción y termina con un checklist de ok / FALTA.
- Antes de pegar algo en el SQL Editor: `npm run db:rls-lite`. Corre en PGlite (Postgres en WASM), sin Docker. Con `RLS_LITE_VIA_MANUAL=1` arma la base con los archivos manuales en lugar de las migraciones. Revisar el código de salida de cada suite, no solo la última línea.
- `src/lib/db/types.ts` se edita a mano cuando la migración agrega columnas, enums o RPC (no hay stack local para `db:types`).
- Un dato sin el que una pantalla no funciona (catálogos) va en migración, no en `seed.sql`.

## Comandos útiles

- `npm run dev`: app en http://localhost:3000.
- `npm run typecheck`, `npx eslint src scripts`, `npm run build`: antes de cerrar.
- `npm run db:rls-lite`: verificaciones de RLS y de los archivos manuales.
- `npm run db:rls-check`, `npm run smoke`, `npm run smoke:pages`: solo con el stack local (Docker), que no se usa aquí.

## Gotchas que costaron tiempo hoy

- `SUPABASE_SERVICE_ROLE_KEY` traía dos llaves pegadas (la de demo local y la real). Síntomas: "Invalid API key" al crear o renombrar usuarios e "Invalid Compact JWS" al subir archivos. Si vuelven a salir, revisar la forma de la llave (3 segmentos, `role: service_role`, `ref` igual al del URL) sin imprimirla.
- Los catálogos (`document_types`, `wa_templates`) vivían solo en `seed.sql`: la pestaña Expediente salía vacía en la base real. Ya son migración (0017).
- Los archivos manuales tienen que poder correrse dos veces: el SQL Editor no lleva historial.

## Decisiones vigentes

- Sin magic link: los tres roles entran con correo y contraseña; las cuentas las crea un admin.
- Una sola organización (Prime) con muchos clientes; multi-tenant real queda fuera del MVP.
- Claude lee y extrae; el código decide. Ningún descarte automático sale de la IA.
- Edad como alerta, no bloqueo, hasta que Prime diga lo contrario.
- El cliente ve a los candidatos desde la etapa Psicométrico; si Prime quiere que los vea antes, es una regla en la base, no pantallas.
- Contratado → Descartado es "se fue" (cuenta para la garantía); "Cancelar contratación" es otra cosa y limpia la contratación.
