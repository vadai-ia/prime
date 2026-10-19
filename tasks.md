# Servicios, llaves y tareas · Sistema de reclutamiento Prime HR Innovation

Complemento operativo de `plan.md`. Responde qué servicio externo hace qué, qué llave necesita, qué tarea del sistema lo llama, qué está hecho y qué falta. Actualizado el 19 de octubre de 2026.

---

## 1. Servicios externos y llaves

### Supabase

- **Qué es:** base de datos Postgres, autenticación y almacenamiento de archivos.
- **Para qué lo usamos:** todas las tablas, los roles y las políticas RLS; el login de los tres roles; los buckets privados de CV, documentos, psicométricos, media de WhatsApp y reportes.
- **Qué necesita:** proyecto creado; URL, publishable key y secret key.
- **Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Costo:** plan Pro, 25 USD al mes, por los respaldos diarios y para que no se pause por inactividad.
- **Quién contrata:** Prime.

### Vercel

- **Qué es:** hosting de la app Next.js y de los crons.
- **Para qué lo usamos:** sirve la app, ejecuta los webhooks y los dos crons.
- **Qué necesita:** proyecto ligado al repo, dominio, variables de entorno.
- **Variables:** todas las de este documento.
- **Costo:** plan Pro, 20 USD al mes. El cron cada minuto no existe en el plan gratuito.
- **Quién contrata:** Prime o VADAI.

### Anthropic (Claude)

- **Qué es:** la API de inteligencia artificial.
- **Para qué lo usamos:** toda la IA del sistema. Generar la evaluación de la vacante, puntuar el CV, interpretar las respuestas de WhatsApp, analizar entrevistas, leer el psicométrico, verificar documentos y producir los insights semanales. Lee PDF e imágenes directo, así que no hay OCR aparte.
- **Qué necesita:** una API key de console.anthropic.com con crédito y límite mensual de gasto.
- **Variables:** `ANTHROPIC_API_KEY`.
- **Costo:** por consumo, entre 25 y 40 USD al mes con el volumen de Telasist (Opus 5.5).
- **Quién contrata:** por ahora la cuenta de VADAI; después Prime, o VADAI y se refactura.

### Whaapy (WhatsApp)

- **Qué es:** plataforma de WhatsApp Business API, producto de VADAI.
- **Para qué lo usamos:** es el transporte del agente "Vale". Envía texto, templates y botones; recibe mensajes y media por webhook; pausa la IA nativa cuando contesta un humano.
- **Qué necesita:** el número dado de alta, API key `wha_…`, secret del webhook, y la IA nativa de Whaapy apagada en ese número para que no contesten dos agentes.
- **Variables:** `WHAAPY_API_KEY`, `WHAAPY_WEBHOOK_SECRET`, `WHAAPY_PHONE_E164`.
- **Costo:** plan de Whaapy más la tarifa de Meta por conversación de 24 horas.
- **Quién contrata:** Prime, a través de Whaapy.

### Meta (WhatsApp Business)

- **Qué es:** el dueño del canal WhatsApp.
- **Para qué lo usamos:** aprueba los templates con los que el agente escribe primero al candidato. Fuera de la ventana de 24 horas solo se puede mandar template.
- **Qué necesita:** los seis templates aprobados: primer contacto, confirmación de entrevista, enlace de psicométrico, recordatorio, solicitud de documentos y cierre cortés. **Enviados a revisión el 19 oct 2026.** Si el número cambia al definitivo de Prime, hay que mandarlos otra vez.
- **Variables:** ninguna, vive dentro de Whaapy.
- **Costo:** incluido en la tarifa por conversación.
- **Quién contrata:** Prime vía Whaapy.

### Microsoft 365 (Outlook y Teams)

- **Qué es:** el correo, calendario y videollamada que ya usa Prime (Outlook clásico, New Outlook y Teams). Sustituye a Google Calendar y Meet (decisión del 19 oct 2026, plan §4.4).
- **Para qué lo usamos:** crear el evento de la entrevista en el calendario de Outlook del reclutador con reunión de Teams, invitar al candidato y a Fireflies, reagendar y cancelar. Opcional: mandar los correos automáticos desde un buzón de Prime.
- **Qué necesita:** que el correo de Prime esté en Microsoft 365 (Exchange Online) y una app registrada en Microsoft Entra ID por su admin. Detalle en §6.
- **Variables:** `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.
- **Costo:** sin costo extra con las licencias de Microsoft 365 que Prime ya paga.
- **Quién contrata:** Prime (ya lo tiene).

### Fireflies

- **Qué es:** grabación y transcripción de videollamadas.
- **Para qué lo usamos:** entra a la reunión de **Teams** como un participante más (se invita a `fred@fireflies.ai` al evento de Outlook), transcribe en español y avisa por webhook. El sistema descarga la transcripción y se la pasa a Claude. Funciona igual con Teams que con Meet.
- **Qué necesita:** cuenta con plan que incluya API, API key, el webhook apuntando a la app, y que la sala de espera de Teams deje entrar al bot (§6).
- **Variables:** `FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET`.
- **Costo:** plan Business, unos 19 USD por usuario al mes. Se puede ahorrar si la transcripción nativa de Teams sirve (§6).
- **Quién contrata:** Prime.

### Resend (correo)

- **Qué es:** envío de correo transaccional.
- **Para qué lo usamos:** los tres correos automáticos (resumen diario interno, candidatos que avanzaron, reporte semanal con PDF) y el SMTP de Supabase Auth para invitaciones y recuperación de contraseña.
- **Qué necesita:** dominio verificado (SPF, DKIM, DMARC), API key y remitente.
- **Variables:** `RESEND_API_KEY`, `RESEND_FROM`.
- **Costo:** gratis hasta 3,000 correos al mes; Pro 20 USD al mes.
- **Alternativa:** mandar los correos desde un buzón de Prime con Microsoft Graph (`Mail.Send`), sin configurar DNS. Por decidir con Prime.

### Psicotest

- **Qué es:** el proveedor de la evaluación psicométrica.
- **Para qué lo usamos:** no tiene API. El reclutador crea la evaluación en el panel de Psicotest y pega el enlace en el sistema; el PDF de resultados se sube a mano y Claude lo lee.
- **Qué necesita:** la cuenta que Prime ya tiene.

### Pandape, Facebook y LinkedIn

- **Qué son:** las bolsas donde Prime publica las vacantes.
- **Para qué los usamos:** no exponen API de postulantes. La entrada al sistema es carga individual o masiva desde la app (CV, teléfono y canal). En fase 2, un buzón de correo que reciba las notificaciones de Pandape con el CV adjunto.

### Variables internas, sin servicio detrás

- `NEXT_PUBLIC_APP_URL`: dominio de la app.
- `CRON_SECRET`: protege las rutas de cron.
- `ENCRYPTION_KEY`: cifra tokens en `user_integrations` (solo si se usa la conexión por reclutador).
- `APP_TIMEZONE`: `America/Mexico_City`.
- `MOCK_DATA`: solo desarrollo; con `1` las vistas muestran datos de demo y no se puede guardar nada.

---

## 2. Tareas de IA (una API key, siete usos)

Cada uso pasa por `runAi()` (`src/lib/ai/run.ts`): esquema zod de salida, prompt versionado en `src/lib/ai/prompts/`, `fallbacks: "default"` por si Claude rechaza, y un registro en `ai_runs` con tokens, costo y latencia. Modelo: `claude-opus-5-5`. La regla de diseño en todas: **Claude lee y extrae; el código decide.** El umbral, las reglas y avanzar o descartar son código nuestro con tests (`src/lib/domain/scoring.ts`).

### Generar la evaluación de la vacante (`profile_generation`) · programado

- **Cuándo corre:** botón "Generar con IA" en la pestaña Evaluación IA de la vacante.
- **Qué recibe:** el descriptivo de la vacante (requisitos, actividades, condiciones, competencias).
- **Qué devuelve:** de 4 a 6 criterios del CV con peso y guía, el umbral, las reglas y preguntas del prefiltro, los mínimos psicométricos y la lista de datos que faltaban.
- **Dónde se guarda:** `job_profile_ai_configs`, con versión +1. Todavía no reescribe el descriptivo.
- **Costo:** 0.10 a 0.20 USD, una vez por vacante.

### Score de CV (`cv_score`) · programado

- **Cuándo corre:** al dar de alta un candidato con CV (en segundo plano) y con "Calificar CV" o "Recalificar" en la ficha.
- **Qué recibe:** el PDF del CV como documento, más los criterios, pesos y guías de la vacante.
- **Qué devuelve:** por criterio, los puntos, la evidencia citada del CV y una nota; un resumen; alertas como "requisito no demostrado" o "hueco laboral".
- **Dónde se guarda:** `applications.cv_score`, `cv_score_breakdown`, `cv_ai_rationale`, `cv_score_version`, `cv_scored_at` y las alertas en `ai_note`. El código suma los parciales; abajo del umbral no se descarta solo, cae en "Requiere tu atención".
- **Costo:** unos 0.06 USD por CV.

### Respuesta del prefiltro (`prefilter_reply`) · pendiente

- **Cuándo corre:** con cada mensaje entrante del candidato durante el prefiltro.
- **Qué recibe:** la pregunta vigente, la respuesta libre y la regla.
- **Qué devuelve:** el valor interpretado (18 meses, $10,500, sí o no) y el siguiente mensaje. La regla la evalúa código: bloqueante que falla es descarte cortés; alerta que falla, como la edad, es excepción para el reclutador.
- **Dónde se guarda:** `prefilter_answers`, `wa_conversations.flow_state`, `wa_messages`.
- **Costo:** 0.15 USD por conversación de 7 a 10 turnos.

### Análisis de entrevista (`interview_analysis`) · pendiente

- **Cuándo corre:** al recibir la transcripción (Fireflies o Teams).
- **Qué recibe:** la transcripción con marcas de tiempo, más los requisitos y competencias del perfil.
- **Qué devuelve:** un hallazgo por requisito: cumple o no, evidencia, cita textual y minuto; un resumen; score de 0 a 100.
- **Dónde se guarda:** `interviews.findings`, `summary`, `score`.
- **Costo:** 0.12 USD por entrevista de 30 minutos.

### Lectura del psicométrico (`psych_parse`) · siguiente

- **Cuándo corre:** al subir el PDF de Psicotest.
- **Qué recibe:** el PDF del reporte.
- **Qué devuelve:** las escalas y sus valores en JSON.
- **Dónde se guarda:** `psychometric_tests.parsed`. El código compara contra los mínimos del perfil y calcula `fit_rows`, `fit_pct` y `verdict`.
- **Costo:** 0.16 USD por reporte.

### Verificación de documentos (`doc_check`) · pendiente

- **Cuándo corre:** con cada foto o PDF que llega por WhatsApp o se sube a mano.
- **Qué devuelve:** qué documento es, si es legible, si el nombre coincide, CURP, RFC, NSS o domicilio extraídos, y problemas encontrados.
- **Dónde se guarda:** `candidate_documents.ai_check`. El reclutador valida o rechaza.
- **Costo:** 0.015 USD por documento.

### Insights semanales (`weekly_insights`) · pendiente

- **Cuándo corre:** lunes a las 7:00.
- **Qué recibe:** los agregados de las vistas `v_bi_*`.
- **Qué devuelve:** áreas de mejora por cliente y globales, con métrica y severidad.
- **Dónde se guarda:** `ai_insights`.
- **Costo:** 0.16 USD por semana.

---

## 3. Tareas de la cola (`scheduled_tasks.type`) · pendiente

La cola vive en Postgres y ya existe en la base (`enqueue_task`, `claim_scheduled_tasks`, `finish_scheduled_task`); falta el ejecutor `/api/cron/tick`. Cada tarea reintenta con espera de 2^intentos minutos hasta `max_attempts`.

- **`wa_first_contact`.** Template de primer contacto con el aviso de privacidad; abre `wa_conversations` en flujo `prefilter`. Toca Whaapy.
- **`wa_send`.** Manda un texto, template o botones; si la ventana de 24 horas cerró, cambia a template. Toca Whaapy.
- **`wa_reminder`.** Recordatorio a las 12 horas (psicométrico) o 24 horas (documentos); segundo a las 48 horas. Toca Whaapy.
- **`cv_score`.** Hoy corre con `after()` al dar de alta; con la cola, el alta la encola con la misma función. Toca Anthropic y Storage.
- **`interview_confirm`.** Un día antes manda el template de confirmación con fecha, hora y enlace de Teams. Toca Whaapy.
- **`fireflies_fetch_transcript`.** Descarga la transcripción, la guarda en `interview_transcripts` y encola `interview_analyze`. Toca Fireflies (o Graph, si se usa la transcripción de Teams).
- **`interview_analyze`.** Corre la tarea de IA `interview_analysis`. Toca Anthropic.
- **`psych_parse`.** Corre la tarea de IA y calcula el veredicto. Toca Anthropic y Storage.
- **`doc_check`.** Descarga la media a `wa-media`, corre la tarea de IA, mueve el archivo a `documents` y crea la fila en `candidate_documents`. Toca Whaapy, Anthropic y Storage.
- **`report_daily_internal`, `report_daily_client`, `report_weekly_client`.** Los tres correos. Toca Resend (o Graph).
- **`weekly_insights`.** Corre la tarea de IA del mismo nombre. Toca Anthropic.

Lo que no va por la cola porque corre al momento: generar la evaluación de la vacante (Server Action; el reclutador espera el resultado) y responder en WhatsApp (el webhook contesta con `after()`, con 6 a 8 segundos de espera por si el candidato manda varios mensajes seguidos).

---

## 4. Webhooks entrantes y crons · pendiente

- **`POST /api/webhooks/whaapy`.** Eventos de mensajes y conversación. Firma HMAC-SHA256 en `X-Webhook-Signature`; `X-Webhook-ID` para no procesar dos veces.
- **`POST /api/webhooks/fireflies`.** Transcripción terminada, con el `meetingId`. Se valida con `FIREFLIES_WEBHOOK_SECRET`.
- **`GET /api/cron/tick`.** Vercel Cron cada minuto. Ejecuta la cola. Protegido con `CRON_SECRET`.
- **`GET /api/cron/schedule-reports`.** Vercel Cron cada hora. Encola los correos según la configuración de cada cliente.
- **`GET /auth/callback`.** Ya existe: invitación y recuperación de contraseña de Supabase Auth.

Regla para todos los webhooks: el handler no tiene lógica de negocio. Valida la firma, guarda el evento en `webhook_events` y encola. Todo lo que escriben webhooks y crons usa el service role.

---

## 5. Qué está hecho

**Base y app (hasta el 23 sep 2026):**

- [x] Supabase hospedado en la migración 0018 (archivos manuales 01 a 07 aplicados): esquema, RLS con visibilidad por reclutador, round robin, vistas, buckets y auth con tres roles.
- [x] Todas las vistas de Prime y del portal con datos reales de Telasist.
- [x] Captura manual completa: clientes y vacantes (alta y edición), levantamiento, alta de candidatos con CV, kanban arrastrable, regresar de etapa, cancelar contratación, entrevistas, psicométrico, expediente, historial de la persona por teléfono.
- [x] Portal del cliente con Vo.Bo. por RPC y aviso a Prime.
- [x] Vista previa de los tres correos automáticos (Reportes → Vista previa de correos).

**IA (19 oct 2026, plan §12.5), sin probar contra la API:**

- [x] SDK `@anthropic-ai/sdk` instalado.
- [x] Wrapper `runAi()`: salida estructurada con zod, caché del prompt, `fallbacks`, registro en `ai_runs`, errores con mensaje para la pantalla.
- [x] Reglas puras en `src/lib/domain/scoring.ts` con 9 pruebas (`npm run test:domain`).
- [x] "Generar con IA" en la pestaña Evaluación IA de la vacante.
- [x] Edición a mano de pesos del CV y umbral (solo guarda si suman 100).
- [x] Score del CV al dar de alta y con "Calificar CV" / "Recalificar" en la ficha, con evidencia por criterio, alertas y aviso cuando los pesos cambiaron.

**Otros (19 oct 2026):**

- [x] Los seis templates de WhatsApp enviados a revisión de Meta.
- [x] Decisión: entrevistas por Teams con Outlook; ya no Google Meet (plan §4.4 y §12.6).

---

## 6. Outlook y Teams: lo que falta

Fireflies sí funciona con Teams: se invita `fred@fireflies.ai` al evento de Outlook y el bot entra a la reunión de Teams como un participante más, igual que en Meet. También existe la opción de conectar el calendario de Outlook del reclutador a Fireflies para que entre solo a todas sus reuniones, pero invitarlo desde el sistema es más controlado (solo entra a entrevistas).

### Lo que tiene que hacer el admin de Microsoft 365 de Prime

1. Confirmar que el correo está en **Microsoft 365 / Exchange Online** (en Outlook: Archivo → Configuración de la cuenta debe decir "Microsoft Exchange" o "Microsoft 365") y qué licencia tienen (Business Basic, Standard o Premium).
2. En **portal.azure.com → Microsoft Entra ID → Registros de aplicaciones → Nuevo registro**: nombre "Prime HR Reclutamiento", "Solo cuentas de este directorio organizativo".
3. En **Certificados y secretos**, crear un secreto de cliente y anotar su fecha de vencimiento.
4. En **Permisos de API → Microsoft Graph → Permisos de aplicación**, agregar `Calendars.ReadWrite`. Si se decide: `Mail.Send` (correos automáticos) y `OnlineMeetingTranscript.Read.All` (transcripción de Teams). Después, **Conceder consentimiento de administrador**.
5. Crear un grupo de seguridad con correo "Reclutadores Prime" con los buzones de los reclutadores, y acotar la app a ese grupo con RBAC for Applications de Exchange (o `New-ApplicationAccessPolicy` en PowerShell de Exchange Online). Así la app no puede tocar otros calendarios de la empresa.
6. En el **centro de administración de Teams → Reuniones → Directivas**: permitir que usuarios anónimos se unan a reuniones y que los externos entren sin sala de espera (o que el reclutador los admita). Afecta al candidato y al bot de Fireflies.
7. Mandarnos por un canal seguro: **Id. de directorio (tenant)**, **Id. de aplicación (client)** y el **secreto**.

### Lo que hacemos nosotros

- [ ] Migración: `teams` en `meeting_platform` (valor por defecto al agendar), `microsoft` en `integration_provider` y `webhook_source`, con su archivo manual re-ejecutable y su verificación en `db:rls-lite`.
- [ ] Formulario de entrevista: Teams como plataforma por defecto; quitar Meet de las opciones.
- [ ] `src/lib/integrations/microsoft-graph.ts`: token con client credentials, crear, mover y cancelar el evento con reunión de Teams.
- [ ] Conectar los tres puntos `INTEGRACIÓN` de `src/actions/interviews.ts`. Si el candidato no tiene correo, el enlace de Teams se le manda por WhatsApp.
- [ ] Spike de medio día: evento con Teams desde Graph → Fireflies entra → webhook → transcripción. Probar también la transcripción nativa de Teams para decidir si se queda Fireflies.
- [ ] Webhook de Fireflies y tarea `interview_analysis`.
- [ ] Actualizar `plan.md` con lo que salga del spike.

---

## 7. Para probar la IA (además de la API key)

**Configuración:**

- [ ] Crédito en console.anthropic.com (10 a 20 USD alcanzan para calibrar) y límite de gasto mensual.
- [ ] `ANTHROPIC_API_KEY` en `.env.local` y reiniciar `npm run dev`. En Vercel, la misma variable y volver a desplegar.
- [ ] `MOCK_DATA` vacío: en modo demo los botones no guardan.
- [ ] No hay SQL que pegar: esta parte no tiene migración.

**Datos:**

- [ ] Una vacante con el descriptivo completo: requisitos, actividades, condiciones (sueldo y horario) y competencias. La IA solo propone con lo que el descriptivo dice; lo que falta lo lista.
- [ ] Dos o tres CV reales en PDF para esa vacante: uno bueno, uno regular y uno que no cumpla. Sirven escaneados.
- [ ] Entrar como admin, o como reclutador asignado a esa vacante.

**Recorrido:**

1. Vacante → Evaluación IA → **Generar con IA**. Tarda de 20 a 60 segundos. Revisar criterios, pesos, umbral, preguntas y la lista de datos faltantes.
2. Ajustar a mano lo que no convenza en **Editar pesos y umbral**.
3. **Agregar candidato** con CV en esa vacante. Al llegar a la ficha, esperar unos segundos y recargar: debe aparecer el score con evidencia por criterio.
4. En un candidato existente con CV: **Calificar CV**. Cambiar un peso en la vacante y comprobar que la ficha avisa y ofrece **Recalificar**.
5. Revisar costos y errores en Supabase → SQL Editor: `select kind, status, cost_usd, latency_ms, error, created_at from ai_runs order by created_at desc limit 20;`
6. Anotar dónde se equivocó la IA y ajustar los prompts (`src/lib/ai/prompts/`), subiendo `PROMPT_VERSION`.

**Qué revisar en el resultado:**

- Que los criterios del CV salgan del puesto y no incluyan edad, sexo ni estado civil.
- Que la evidencia sea texto que de verdad está en el CV.
- Que un CV que no cumple quede abajo del umbral y uno bueno arriba.
- Que el costo por CV ronde 0.06 USD.

---

## 8. Lo que falta, en orden

1. **Probar y calibrar la IA** (§7).
2. **`psych_parse`**: leer el PDF de Psicotest ya subido y llenar escalas y veredicto. Necesita 3 o 4 PDF reales.
3. **Cola de tareas y crons** (`/api/cron/tick`, `schedule-reports`). Base de todo lo automático.
4. **Correos**: los tres correos automáticos, por Resend o por un buzón de Prime con Graph; PDF del reporte semanal; SMTP de Auth.
5. **Outlook y Teams + Fireflies** (§6) y `interview_analysis`.
6. **Whaapy**: entrada por WhatsApp, prefiltro con `prefilter_reply`, psicométrico y documentos por WhatsApp, `doc_check`.
7. **Weekly insights** y la pestaña de inteligencia interna con historia.

Sin dependencias externas, para meter entre bloques: lista negra e inactivos (solo admin), exportar a Excel con `log_audit('export')`, carga masiva de CVs, detección de duplicados, importación del Excel histórico, pantalla de permanencia a 30, 90 y 180 días, más notificaciones (candidato asignado, entrevista agendada, documento subido), `last_seen_at`, ajustes para celular.

Configuración que no bloquea: Vercel (proyecto, dominio, variables), Supabase Auth (Site URL, redirect URLs, templates, SMTP), colores reales en `src/app/globals.css`.

---

## 9. Qué pedir a Prime

**Accesos:**

- [ ] Quién es el admin de Microsoft 365 y que haga los pasos de §6.
- [ ] Cuenta y API key de Fireflies (o esperar al spike de Teams).
- [ ] Número de WhatsApp definitivo.
- [ ] Dominio para publicar el sistema.

**Decisiones:**

- [ ] Opción A (permiso de la empresa) o B (cada reclutador conecta su Outlook). Recomendada: A.
- [ ] Fireflies o transcripción de Teams (después del spike).
- [ ] Correos automáticos por Resend o desde un buzón de Prime.
- [ ] Texto del aviso de privacidad y plazo de conservación de datos de descartados.
- [ ] Quién captura la permanencia a 30, 90 y 180 días.
- [ ] Después de cuánto tiempo un candidato pasa a inactivo.
- [ ] Confirmar: solo los reclutadores reciben candidatos por turno; al quitar a un reclutador sus candidatos se reparten solos; el reclutador no ve quién más trabaja su vacante.

**Archivos:**

- [ ] Dos o tres CV reales y tres o cuatro PDF de Psicotest.
- [ ] Excel histórico de clientes, vacantes y candidatos.
- [ ] Excel de levantamiento, formato D.P., guion de entrevista y formato de la hoja de confirmación.
- [ ] Muestras de Black Trust y del socioeconómico.
