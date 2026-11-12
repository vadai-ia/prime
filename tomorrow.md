# Próxima sesión · Prime HR Innovation

Escrito el 29 de octubre de 2026; actualizado el **12 de noviembre**. **Léelo primero.** Después: **`microsoft365-pasos.md`** (guía para la reunión con sistemas de Prime, 12 nov), `junta.md` (junta del 30 oct), **`variables.md`** (variables de Vercel y SMTP de Supabase), `pendientes_revision.md` (qué probar: §11 a §19 son lo más reciente), `tasks.md` (hecho, falta y qué pedir a Prime), `plan.md` §12.14 a §12.18, `requerimientos_estado.md`, `datos_errores.md` y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario. Último commit `a4ad44d features`. Sin commit: `junta.md`, `microsoft365-pasos.md`, `FIREFLIES_INVITEE` en `src/lib/integrations/microsoft-graph.ts`, `tasks.md` y este archivo.

## 12 nov: Microsoft 365 contratado, falta conectarlo

- **Correo (Resend) hecho**, según el usuario. Confirmar que `RESEND_API_KEY` y `RESEND_FROM` están en Vercel y que el SMTP de Supabase manda "Olvidé mi contraseña".
- **Prime contrató Microsoft 365 Empresa Básico.** La cuenta maestra es **`sistemas@primehrinnovation.onmicrosoft.com`** (no `admin@`; ya se cambió en `junta.md`). Es solo de administración: sin licencia, no agenda ni se conecta en la app.
- **Outlook y Teams todavía no están conectados.** Falta lo de `microsoft365-pasos.md`, que hace sistemas con `sistemas@`:
  1. Confirmar que `sistemas@` es **Administrador global** y que hay 7 licencias.
  2. Crear `entrevistas@` y una cuenta `@primehrinnovation.onmicrosoft.com` por reclutador, con licencia. Propuesta: Gabriela, Eduardo, Mauricio, Patricia Denisse, Diego y Nancy, con el mismo usuario que tienen en cPanel. Falta confirmar Xavier, Edwin y Ulises.
  3. Reenvío de cada buzón onmicrosoft a su correo de cPanel (Defender, directiva de salida, más el reenvío por usuario).
  4. Teams: anónimos, omitir la sala de espera para todos, transcripción.
  5. Entra ID: registrar la app (Web, un solo inquilino) con las URI de redirección `https://app.primehrinnovation.com.mx/api/integrations/microsoft/callback` y `http://localhost:3000/api/integrations/microsoft/callback`. Permisos delegados `openid email offline_access User.Read Calendars.ReadWrite` (y opcional `OnlineMeetingTranscript.Read.All`), consentimiento de admin y secreto a 24 meses.
  6. Fireflies con `entrevistas@`.
  7. Que nos manden el inquilino, el cliente, el valor del secreto y su vencimiento.
- **Decidido el 12 nov: primero las claves, las licencias después.** Sistemas hace solo el paso 6 (Entra ID) con `sistemas@` y nos manda los datos; probamos "Conectar Outlook" con `sistemas@`. Sin licencia, conectar funciona (el callback solo lee `/me`), pero **agendar falla** porque `/me/events` necesita buzón de Exchange. Para probar agendar y Teams hace falta 1 licencia (a `sistemas@` temporal o a `entrevistas@`).
- **12 nov: app registrada en Entra ID** ("Prime HR Reclutamiento", Web, un inquilino, las 2 URI, 5 permisos delegados con consentimiento de admin). El secreto **vence alrededor del 12 nov 2028**: recordatorio en oct 2028. El usuario puso `MICROSOFT_*` en `.env` (está en `.gitignore`) y en Vercel. Falta `ENCRYPTION_KEY` y la prueba "Conectar Outlook" con `sistemas@`.
- **Qué buzón se usa:** la invitación de Teams sale del buzón onmicrosoft del reclutador; las respuestas llegan ahí y se reenvían a cPanel. El correo de todos los días sigue en cPanel. Teams no necesita registro ni permiso aparte: el evento se crea con `isOnlineMeeting` y `Calendars.ReadWrite`.
- **Al recibir los datos:** commit y despliegue de `FIREFLIES_INVITEE`; en Vercel `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `ENCRYPTION_KEY` y `FIREFLIES_INVITEE=entrevistas@primehrinnovation.onmicrosoft.com`; volver a desplegar y hacer la prueba del paso 9 de `microsoft365-pasos.md`. Sin `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` y `ENCRYPTION_KEY`, la app no habilita "Conectar Outlook" (`microsoft-graph.ts:42`).

## 30 oct: junta con Prime

Todo lo hace **el encargado de sistemas de Prime** (admin de Microsoft 365 y del DNS), guiado en la llamada con `junta.md` (pasos 0 a 8). Orden: revisar licencias → crear `entrevistas@` con licencia → ajustar Teams → registrar la app en Entra ID → Fireflies con `entrevistas@` → Resend con `entrevistas@` → pegar DNS → clave de Resend → mandarnos los datos.

Decidido el 29 oct:

- **Una sola cuenta nueva:** `entrevistas@primehrinnovation.com.mx` con licencia Business Basic. Fireflies entra con ella y es la dueña de la cuenta de Resend.
- **Resend y no el correo de Supabase:** el de Supabase solo manda invitación y reset, con límite de pocos por hora. Resend manda los reportes y, como SMTP de Supabase, también la invitación y el reset.
- **El remitente no es una cuenta nueva:** Resend verifica el dominio; se manda desde una dirección que ya exista (`recursoshumanos@` o `contacto@`). Sus registros DNS van en `send` y `resend._domainkey` y no tocan los de Microsoft 365.
- **Site URL de Supabase corregido** por el usuario (tenía `localhost`): el reset de contraseña ya lleva a producción.

## Lo que el usuario me tiene que pasar después de la junta

| Dato | De dónde (`junta.md`) | Dónde va |
|---|---|---|
| Id. de directorio (inquilino) | Paso 3.3 | Vercel `MICROSOFT_TENANT_ID` |
| Id. de aplicación (cliente) | Paso 3.3 | Vercel `MICROSOFT_CLIENT_ID` |
| Valor del secreto y su fecha de vencimiento | Paso 3.3 | Vercel `MICROSOFT_CLIENT_SECRET`; anotar el vencimiento en `tasks.md` |
| ¿Se creó `entrevistas@`? | Paso 1 | Vercel `FIREFLIES_INVITEE` |
| ¿Dominio "Verified" en Resend? Clave `re_…` | Pasos 6 y 7 | Vercel `RESEND_API_KEY` y SMTP de Supabase |
| Remitente elegido | Paso 0 | Vercel `RESEND_FROM` y SMTP de Supabase |
| Respuestas de Fireflies (API y webhook, reuniones al mismo tiempo, horas, precio) | Paso 4 | Decide si se paga y qué se programa |
| ¿Se activó el permiso opcional `OnlineMeetingTranscript.Read.All`? | Paso 3.2 | Si sí, se puede probar la transcripción de Teams |
| Destinatarios de los correos (interno, por cliente, horas, firma) | "Lo que tiene que decidir Prime" | Contactos de cada cliente en la app; necesario para programar los reportes |

Las claves las pega el usuario (no por chat): Vercel → Settings → Environment Variables, más `ENCRYPTION_KEY` generada con `openssl rand -base64 32`, y volver a desplegar. SMTP en Supabase → Authentication → SMTP Settings (`junta.md` 9.2).

## Si en la junta no se consiguió algo, qué pedir

- **No estaba el admin de M365:** que nos den su nombre y una fecha; sin él no se prueba nada de Outlook ni Teams.
- **No se creó el secreto o se perdió el valor:** se crea otro (paso 3.3); no hay que repetir lo demás.
- **Resend no verifica:** pedir captura del panel del DNS; casi siempre el nombre quedó como `send.primehrinnovation.com.mx.primehrinnovation.com.mx`.
- **Faltaron destinatarios o contactos de clientes:** pedirlos por escrito; no bloquean la prueba de Outlook.
- Además: `datos_errores.md`, API de Pandapé, aviso de privacidad y consentimientos, CV reales, PDF de Psicotest, guion de entrevista, logotipo.

## Qué va a funcionar al pegar las variables (y qué no)

| Qué | ¿Funciona solo con las variables? | Nota |
|---|---|---|
| Conectar Outlook en Mi cuenta | **Sí**, programado (20 oct) | **Nunca probado contra Microsoft real**: el primer recorrido puede sacar errores. La URI de redirección registrada debe ser exacta y el consentimiento de admin dado |
| Agendar, reagendar y cancelar con evento de Teams | **Sí**, programado | Igual: sin probar. Aviso si el Outlook del dueño se desconectó |
| Fireflies entra a la entrevista | **Sí**, sin código nuestro | Depende de la configuración de Fireflies en `entrevistas@` (auto-join) y de la sala de espera de Teams |
| La transcripción llega sola a la ficha | **No** | Falta el webhook de Fireflies (o la lectura de Teams) y `interview_analysis`. Hoy se ve solo en Fireflies |
| Invitación y "Olvidé mi contraseña" por Resend | **Sí**, sin código | Solo el SMTP de Supabase |
| Los tres reportes automáticos | **No** | Falta `sendEmail()`, las tareas `report_*`, sus horarios en `recurring.ts` y el PDF semanal. Hoy solo hay plantillas y vista previa |

## Siguiente: código sin dependencias, en este orden

1. **Correos automáticos** (se puede empezar antes de que verifique el dominio): `sendEmail()` con Resend, handlers `report_daily_internal`, `report_daily_client`, `report_weekly_client`, horarios en `recurring.ts`, PDF semanal con `@react-pdf/renderer`, registro en `reports`. Destinatarios desde la app (admins y reclutadores; contacto y hora de cada cliente).
2. **Calibrar la IA del CV:** alerta "Sin fechas de inicio y fin" en el prompt de `cv_score`, subir `PROMPT_VERSION` y recalificar.
3. **"Olvidé mi contraseña" en el portal del cliente** (hoy solo admins).
4. Con la API key de Fireflies (o la decisión de usar Teams): webhook de transcripción e `interview_analysis`.

Descartado el 29 oct: **importar vacantes desde Excel en la app**; ya se cargaron por SQL y las nuevas se crean con el levantamiento o "Subir descriptivo". Grupo Huerta y Chela Chupas se cargan por SQL cuando lleguen.

## Pendientes del usuario que siguen vigentes

1. **Probar en producción** `pendientes_revision.md` §12, §14 a §19. En §11 faltan un PDF escaneado y uno que no sea CV.
2. **Revisar CVs huérfanos:** candidatos con `cv_file_path` sin archivo en `storage.objects` (bucket `cvs`) después de vaciar el bucket.
3. **Llenar descriptivo y Evaluación IA** (Generar con IA) de cada vacante real; sin pesos, la carga masiva no califica.
4. Vercel: confirmar el cron en Settings → Cron Jobs y las variables `CRON_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=https://app.primehrinnovation.com.mx`.
5. En Supabase → Authentication → URL Configuration, que **Redirect URLs** tenga `https://app.primehrinnovation.com.mx/**` y `http://localhost:3000/**`.

**Cómo se entregan las queries:** el usuario pega en el SQL Editor de Supabase. Escribir el `.sql` en el scratchpad, re-ejecutable y con checklist o protecciones, probarlo dos veces con `boot()` de `scripts/rls-lite/harness.mjs` y darle la ruta completa. Si sale la advertencia de RLS por `supabase_migrations.schema_migrations`, es "Run without RLS". Supabase no deja borrar archivos de Storage por SQL. Leer el Excel (`excel/`) solo si el usuario lo pide. Preguntar antes de cargar o borrar datos.

## Avance estimado (29 oct): ~65 %

Operación diaria ~95 %, portal ~90 %, tablero ~85 %, IA ~40 % (cv_score, profile_generation, cv_extract e intake_extract; faltan prefilter_reply, interview_analysis, psych_parse, doc_check, weekly_insights), Outlook/Teams ~60 % sin probar, correos ~20 %, WhatsApp ~5 %, Fireflies y Pandapé 0 %. Lo que más destraba: la junta del 30 oct.

## Contexto que sigue vigente

- **Visibilidad (0029):** el reclutador ve a todos los candidatos de las vacantes que trabaja; sin reclutador por candidato. Hay que avisarle a Prime.
- **Los prompts viven en el código** (`src/lib/ai/prompts/`): se edita, se sube `PROMPT_VERSION` y se despliega.
- **El teléfono es la identidad:** un CV con un teléfono existente agrega una postulación a esa persona y solo llena sus datos vacíos.
- `applications.assigned_recruiter_id` solo guarda quién capturó; `assignApplicationRecruiter` y `components/candidate/assigned-recruiter.tsx` quedaron sin pantalla.
- Base hospedada con los archivos manuales **01 a 18** aplicados.
- **Bloqueado por Prime:** lo de `junta.md`, Fireflies con API, número de WhatsApp y Meta, aviso de privacidad y consentimiento, PDF de Psicotest, CV reales, Excel histórico, logotipo, Grupo Huerta, Chela Chupas y `datos_errores.md`.
