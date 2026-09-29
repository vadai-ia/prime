# Servicios, llaves y tareas · Sistema de reclutamiento Prime HR Innovation

Complemento operativo de `plan.md`. Responde tres preguntas: qué servicio externo hace qué, qué llave necesita, y qué tarea del sistema lo llama. Actualizado el 16 de septiembre de 2026.

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
- **Para qué lo usamos:** toda la IA del sistema. Generar el descriptivo de puesto, puntuar el CV, interpretar las respuestas de WhatsApp, analizar entrevistas, leer el psicométrico, verificar documentos y producir los insights semanales. Lee PDF e imágenes directo, así que no hay OCR aparte.
- **Qué necesita:** una API key de console.anthropic.com con límite mensual de gasto.
- **Variables:** `ANTHROPIC_API_KEY`.
- **Costo:** por consumo, entre 30 y 50 USD al mes con el volumen de Telasist.
- **Quién contrata:** Prime, o VADAI y se refactura.

### Whaapy (WhatsApp)

- **Qué es:** plataforma de WhatsApp Business API, producto de VADAI.
- **Para qué lo usamos:** es el transporte del agente "Vale". Envía texto, templates y botones; recibe mensajes y media por webhook; pausa la IA nativa cuando contesta un humano.
- **Qué necesita:** el número de Prime dado de alta, API key `wha_…`, secret del webhook, y la IA nativa de Whaapy apagada en ese número para que no contesten dos agentes.
- **Variables:** `WHAAPY_API_KEY`, `WHAAPY_WEBHOOK_SECRET`, `WHAAPY_PHONE_E164`.
- **Costo:** plan de Whaapy más la tarifa de Meta por conversación de 24 horas.
- **Quién contrata:** Prime, a través de Whaapy.

### Meta (WhatsApp Business)

- **Qué es:** el dueño del canal WhatsApp.
- **Para qué lo usamos:** aprueba los templates con los que el agente escribe primero al candidato. Fuera de la ventana de 24 horas solo se puede mandar template.
- **Qué necesita:** seis templates enviados a aprobación desde Whaapy: primer contacto, confirmación de entrevista, enlace de psicométrico, recordatorio, solicitud de documentos y cierre cortés. La aprobación tarda días, por eso se mandan en la semana 1.
- **Variables:** ninguna, vive dentro de Whaapy.
- **Costo:** incluido en la tarifa por conversación.
- **Quién contrata:** Prime vía Whaapy.

### Fireflies

- **Qué es:** grabación y transcripción de videollamadas.
- **Para qué lo usamos:** entra a la entrevista en Meet (se invita a `fred@fireflies.ai` al evento), transcribe en español y avisa por webhook. El sistema descarga la transcripción y se la pasa a Claude.
- **Qué necesita:** cuenta de Prime con plan que incluya API, API key, y el webhook apuntando a la app.
- **Variables:** `FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET`.
- **Costo:** plan Business, unos 19 USD por usuario al mes.
- **Quién contrata:** Prime.

### Google Calendar y Meet

- **Qué es:** agenda y videollamada.
- **Para qué lo usamos:** crear el evento de la entrevista con enlace Meet, invitar al candidato y a Fireflies, reagendar y cancelar.
- **Qué necesita:** proyecto en Google Cloud con Calendar API habilitada, pantalla de consentimiento y credenciales OAuth. Cada reclutador conecta su calendario una sola vez desde su perfil. Los tokens se guardan cifrados en `user_integrations`.
- **Variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ENCRYPTION_KEY`.
- **Costo:** sin costo, con las cuentas de Google Workspace de Prime.
- **Quién contrata:** Prime.

### Resend (correo)

- **Qué es:** envío de correo transaccional.
- **Para qué lo usamos:** los tres correos automáticos (resumen diario interno, candidatos que avanzaron, reporte semanal con PDF) y el SMTP de Supabase Auth para invitaciones y recuperación de contraseña.
- **Qué necesita:** dominio de Prime verificado (SPF, DKIM, DMARC), API key y remitente.
- **Variables:** `RESEND_API_KEY`, `RESEND_FROM`.
- **Costo:** gratis hasta 3,000 correos al mes; Pro 20 USD al mes.
- **Quién contrata:** Prime.

### Psicotest

- **Qué es:** el proveedor de la evaluación psicométrica.
- **Para qué lo usamos:** no tiene API. El reclutador crea la evaluación en el panel de Psicotest y pega el enlace en el sistema; el PDF de resultados se sube a mano y Claude lo lee.
- **Qué necesita:** la cuenta que Prime ya tiene.
- **Variables:** ninguna.
- **Costo:** lo que Prime ya paga.

### Pandape, Facebook y LinkedIn

- **Qué son:** las bolsas donde Prime publica las vacantes.
- **Para qué los usamos:** no exponen API de postulantes. La entrada al sistema es carga individual o masiva desde la app (CV, teléfono y canal). En fase 2, un buzón de correo que reciba las notificaciones de Pandape con el CV adjunto.
- **Variables:** ninguna.
- **Costo:** lo que Prime ya paga.

### Variables internas, sin servicio detrás

- `NEXT_PUBLIC_APP_URL`: dominio de la app.
- `CRON_SECRET`: protege las rutas de cron.
- `APP_TIMEZONE`: `America/Mexico_City`.
- `MOCK_DATA`: solo desarrollo; con `1` las vistas muestran datos de demo.

---

## 2. Tareas de IA (una API key, siete usos)

Cada uso es una función con entrada y salida tipadas (esquema zod), un prompt versionado en `src/lib/ai/prompts/` y un registro en la tabla `ai_runs` con tokens, costo y latencia. Modelo: `claude-opus-5`. La regla de diseño en todas: **Claude lee y extrae; el código decide.** El umbral, las reglas y avanzar o descartar son código nuestro con tests.

### Generar el perfil (`profile_generation`)

- **Cuándo corre:** el reclutador termina el levantamiento y pulsa "Generar perfil".
- **Qué recibe:** las secciones I a VI del levantamiento (`job_intakes.form`).
- **Qué devuelve:** el descriptivo de puesto completo, los pesos del CV (suman 100), el umbral, las preguntas de prefiltro con su regla, los mínimos psicométricos y las escalas bloqueantes.
- **Dónde se guarda:** `job_profiles` y `job_profile_ai_configs`, con versión +1.
- **Costo:** 0.10 a 0.20 USD, una vez por vacante.

### Score de CV (`cv_score`)

- **Cuándo corre:** al cargar un candidato y cuando cambia la configuración de IA de la vacante.
- **Qué recibe:** el PDF del CV como bloque de documento, más los pesos y requisitos del perfil.
- **Qué devuelve:** por cada peso, los puntos, la evidencia citada del CV y una nota; un resumen; banderas como "requisito no demostrado" o "hueco laboral".
- **Dónde se guarda:** `applications.cv_score`, `cv_score_breakdown`, `cv_ai_rationale`, `cv_score_version`. El código suma los parciales y compara con el umbral; abajo del umbral no se descarta solo, cae en "Requiere tu atención".
- **Costo:** 0.07 USD por CV.

### Respuesta del prefiltro (`prefilter_reply`)

- **Cuándo corre:** con cada mensaje entrante del candidato durante el prefiltro.
- **Qué recibe:** la pregunta vigente, la respuesta libre y la regla.
- **Qué devuelve:** el valor interpretado (18 meses, $10,500, sí o no) y el siguiente mensaje. La regla la evalúa código: bloqueante que falla es descarte cortés; alerta que falla, como la edad, es excepción para el reclutador.
- **Dónde se guarda:** `prefilter_answers` (una fila por pregunta), `wa_conversations.flow_state`, `wa_messages`.
- **Costo:** 0.17 USD por conversación de 7 a 10 turnos.

### Análisis de entrevista (`interview_analysis`)

- **Cuándo corre:** al recibir la transcripción de Fireflies.
- **Qué recibe:** la transcripción con marcas de tiempo, más los requisitos y competencias del perfil.
- **Qué devuelve:** un hallazgo por requisito: cumple o no, evidencia, cita textual y minuto; un resumen; score de 0 a 100.
- **Dónde se guarda:** `interviews.findings`, `summary`, `score`.
- **Costo:** 0.15 USD por entrevista de 30 minutos.

### Lectura del psicométrico (`psych_parse`)

- **Cuándo corre:** al subir el PDF de Psicotest.
- **Qué recibe:** el PDF del reporte.
- **Qué devuelve:** las escalas y sus valores en JSON (CI, Coleibor, Cibain, Inceval, Cacter, Ciesman).
- **Dónde se guarda:** `psychometric_tests.parsed`. El código compara contra los mínimos del perfil y calcula `fit_rows`, `fit_pct` y `verdict`.
- **Costo:** 0.20 USD por reporte.

### Verificación de documentos (`doc_check`)

- **Cuándo corre:** con cada foto o PDF que llega por WhatsApp o se sube a mano.
- **Qué recibe:** la imagen o el PDF y el nombre del candidato.
- **Qué devuelve:** qué documento es, si es legible, si el nombre coincide, CURP, RFC, NSS o domicilio extraídos, y problemas encontrados.
- **Dónde se guarda:** `candidate_documents.ai_check`. El reclutador valida o rechaza; si rechaza, el agente vuelve a pedir la foto.
- **Costo:** 0.015 USD por documento.

### Insights semanales (`weekly_insights`)

- **Cuándo corre:** lunes a las 7:00.
- **Qué recibe:** los agregados de las vistas `v_bi_*`: embudo, canal, tiempos por etapa y motivos de descarte.
- **Qué devuelve:** áreas de mejora por cliente y globales, con métrica y severidad.
- **Dónde se guarda:** `ai_insights`.
- **Costo:** 0.20 USD por semana.

### Palancas de costo

- `effort` bajo o medio para WhatsApp y documentos; alto para perfil, entrevista e insights.
- Caché de prompt: el perfil se manda una vez por vacante y se reutiliza en cada llamada.
- `fallbacks` activado para que un rechazo del modelo no tumbe el flujo.

---

## 3. Tareas de la cola (`scheduled_tasks.type`)

La cola vive en Postgres. `enqueue_task()` encola con clave de deduplicación. El cron `/api/cron/tick` corre cada minuto, toma hasta N tareas con `claim_scheduled_tasks()` y cierra cada una con `finish_scheduled_task()`, que reintenta con espera de 2^intentos minutos hasta `max_attempts`.

- **`wa_first_contact`.** La encola el alta de candidato. Manda el template de primer contacto con el aviso de privacidad y abre `wa_conversations` en flujo `prefilter`. Toca Whaapy.
- **`wa_send`.** La encola cualquier módulo. Manda un texto, template o botones a una conversación; si la ventana de 24 horas cerró, cambia a template. Toca Whaapy.
- **`wa_reminder`.** La encolan psicométrico y expediente. Recordatorio si no hay respuesta en 12 horas (psicométrico) o 24 horas (documentos); segundo recordatorio a las 48 horas. Toca Whaapy.
- **`cv_score`.** La encola el alta de candidato o un cambio en la configuración de IA. Corre la tarea de IA del mismo nombre. Toca Anthropic y Storage.
- **`interview_confirm`.** La encola el agendado de la entrevista. Un día antes manda el template de confirmación con fecha, hora y enlace. Toca Whaapy.
- **`fireflies_fetch_transcript`.** La encola el webhook de Fireflies. Descarga la transcripción por GraphQL, la guarda en `interview_transcripts` y encola `interview_analyze`. Toca Fireflies.
- **`interview_analyze`.** La encola la anterior. Corre la tarea de IA `interview_analysis`. Toca Anthropic.
- **`psych_parse`.** La encola la subida del PDF de Psicotest. Corre la tarea de IA y calcula el veredicto. Toca Anthropic y Storage.
- **`doc_check`.** La encola el webhook de Whaapy cuando llega media, o la subida manual. Descarga la media a `wa-media`, corre la tarea de IA, mueve el archivo a `documents` y crea la fila en `candidate_documents`. Toca Whaapy, Anthropic y Storage.
- **`report_daily_internal`.** La encola el cron `schedule-reports` a las 18:00. Resumen diario para Prime: vacantes activas, pendientes del reclutador, agenda de mañana. Toca Resend.
- **`report_daily_client`.** La encola el cron a la hora configurada de cada cliente. Candidatos que avanzaron hoy, solo etapa igual o posterior a psicométrico. Toca Resend.
- **`report_weekly_client`.** La encola el cron según `weekly_report_dow`. Reporte semanal en HTML y PDF: embudo, canal, perfil contratado y siguientes pasos. Toca Resend y el bucket `reports`.
- **`weekly_insights`.** La encola el cron los lunes a las 7:00. Corre la tarea de IA del mismo nombre. Toca Anthropic.

Dos flujos no van por la cola porque corren al momento:

- **Generar perfil.** Es una Server Action con streaming: el reclutador ve el descriptivo generarse en pantalla.
- **Responder en WhatsApp.** El webhook de Whaapy contesta directo usando `after()`, con una espera de 6 a 8 segundos por si el candidato manda varios mensajes seguidos.

---

## 4. Webhooks entrantes y crons

- **`POST /api/webhooks/whaapy`.** Lo llama Whaapy con los eventos `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`, `conversation.created` y `conversation.handoff`. Se valida la firma HMAC-SHA256 del header `X-Webhook-Signature` con `WHAAPY_WEBHOOK_SECRET`; `X-Webhook-ID` sirve para no procesar dos veces el mismo evento.
- **`POST /api/webhooks/fireflies`.** Lo llama Fireflies cuando termina una transcripción, con el `meetingId`. Se valida con `FIREFLIES_WEBHOOK_SECRET`.
- **`GET /api/cron/tick`.** Lo llama Vercel Cron cada minuto. Ejecuta las tareas pendientes de la cola. Protegido con `CRON_SECRET`.
- **`GET /api/cron/schedule-reports`.** Lo llama Vercel Cron cada hora. Encola los correos diarios y semanales según la configuración de cada cliente, en hora de `America/Mexico_City`. Protegido con `CRON_SECRET`.
- **`GET /auth/callback`.** Lo llaman los enlaces de correo de Supabase Auth: invitación y recuperación de contraseña, con un token de un solo uso.

Regla para todos los webhooks: el handler no tiene lógica de negocio. Valida la firma, guarda el evento en `webhook_events` y encola. Todo lo que escriben webhooks y crons usa el service role.

---

## 5. Qué está listo y qué falta

Listo:

- Supabase: esquema, RLS, vistas, buckets y auth con tres roles, aplicado en el proyecto de Prime. Falta pegar la migración 0013 (`supabase/manual/03_seguimiento_identidad_cargas_notificaciones.sql`): seguimiento post-contratación, identidad del candidato, cargas masivas y notificaciones.
- Todas las vistas de la app (Prime y portal), con datos de demo mientras `MOCK_DATA=1`.
- Alta de clientes y levantamiento guardado como borrador.
- Portal con Vo.Bo.: la decisión ya escribe en la base vía RPC.

Siguiente paso:

- Anthropic: generar perfil y score de CV. Requiere `ANTHROPIC_API_KEY` y dos o tres CV reales para calibrar.

Por fase:

- Fase 2: alta de candidatos con CV (individual y masiva); Whaapy con webhook, envío y templates aprobados por Meta. Mandar los templates a aprobación cuanto antes, tardan días.
- Fase 3: Google Calendar y Meet, Fireflies, psicométrico y expediente. Hacer el spike de medio día antes de programar.
- Fase 4: Resend con los tres correos, el PDF semanal y el SMTP de Auth. Verificar el dominio desde ahora.

Cuentas por abrir o confirmar con Prime: Anthropic (o VADAI), Fireflies con API, proyecto de Google Cloud, dominio en Resend y número de WhatsApp en Whaapy.
