# Siguientes pasos · Prime HR Innovation

Escrito el 18 de noviembre de 2026, después de agendar en producción la primera entrevista con Outlook. La invitación llegó por correo. **Actualizado el 23 nov:** recordatorio de entrevista por WhatsApp programado (plan §12.21) y Pandapé fuera del alcance. Complementa a `tomorrow.md` y `tasks.md` §6 a §9.

## Prioridad (24 nov, del usuario)

1. Agendar entrevista y ver el enlace de Teams; el evento queda en el calendario de Outlook del reclutador que agenda.
2. Si el evento se mueve o se cancela en Outlook, que la app se entere y avise. **No programado:** hace falta suscripción de Graph al calendario de cada reclutador (`/api/webhooks/microsoft`, renovación cada ~3 días en `recurring.ts`), actualizar `interviews` y avisar con `app.notify_application()`.
3. Conectar el Outlook de cada usuario: cuenta onmicrosoft con licencia, reenvío a cPanel, entrar una vez a outlook.office.com y Mi cuenta → Conectar Outlook; el admin lo asigna a sus vacantes.
4. **Correo de entrevista agendada** (27 nov, plan §12.26, sin probar): sistemas agrega `Mail.Send` (delegado) con consentimiento de admin en la misma app de Entra ID → `OUTLOOK_MAIL_SEND=1` en Vercel → desplegar → agendar una entrevista con Outlook conectado y revisar la bandeja de quien agendó.
5. ~~Fireflies~~ **Transcripción de Teams** (24 nov, plan §12.24, sin probar): sistemas agrega `OnlineMeetings.ReadWrite` y `OnlineMeetingTranscript.Read.All` con consentimiento de admin → `TEAMS_TRANSCRIPTS=1` en Vercel → desplegar → agendar con `sistemas@`, entrar, hablar 2 min, salir y en la ficha "Traer transcripción de Teams". Revisar en el centro de Teams que la directiva de reuniones permita grabar y transcribir. Siguiente: análisis de la entrevista con IA.
6. **Reportes a clientes por Outlook en lugar de Resend** (27 nov, decidido, sin programar). El semanal ya está programado (plan §12.23) pero no sale porque Resend no está configurado.
   - **Sin licencia nueva:** sistemas crea el buzón compartido `reportes@primehrinnovation.com.mx`, que es gratis hasta 50 GB.
   - **Permiso:** en la misma app de Entra ID, `Mail.Send` **de aplicación** con consentimiento de admin, **restringido solo a `reportes@`** (RBAC for Applications o ApplicationAccessPolicy), para que la app no pueda mandar como nadie más. Así no depende de que alguien tenga su Outlook conectado.
   - **Código (mío):** cambiar `src/lib/email/send.ts` de Resend a Graph (`/users/reportes@…/sendMail`, token de aplicación, PDF adjunto). Corregir el texto de la ficha del cliente: hoy dice "Viernes a las 17:00", pero todo sale a las 8:00 por el cron de Vercel.
   - **Prime:** capturar los destinatarios de cada cliente en Clientes → cliente → Editar → correos de reportes.
   - **Alternativa sin crear buzón:** mandar desde `sistemas@`. El cliente vería ese correo como remitente.
7. **Probar lo del 27 nov:**
   - Sugeridos: Perfiles → vacante → "Correlacionar candidatos de otra vacante".
   - WhatsApp `confirmacion_entrevista_utility` en el momento de agendar.
   - Agendar una entrevista de prueba con Nancy. Si sale el aviso de que su calendario no tiene Teams, sistemas revisa su licencia.
   - Cerrar las 2 entrevistas pasadas sin enlace (17 y 25 nov) como Realizada o Cancelada.
8. **Correr `supabase/manual/20_reportes_por_fecha.sql`** en el SQL Editor (reportes por fecha, plan §12.27). Checklist: 5 ok. Sin esto, la página funciona sin fechas y falla al elegirlas.
9. ✅ **Cambiar logos** (27 nov): login, menú lateral, barra del celular, correos, PDF semanal y pestaña del navegador.

## 1. Terminar de probar la entrevista

Con la misma entrevista que se agendó:

- [ ] El evento trae el enlace de Teams y el candidato entra desde el navegador, sin cuenta y sin sala de espera.
- [ ] No hay eventos duplicados en el calendario (el 12 nov Graph respondía 503).
- [ ] Reagendar desde la ficha: el evento cambia en Outlook y al candidato le llega la actualización.
- [ ] Cancelar desde la ficha: el evento se cancela y al candidato le llega el aviso.
- [ ] Más de una hora después, agendar otra: la conexión con Outlook se renueva sola.
- [ ] Fireflies: hoy se invita a `fred@fireflies.ai` porque falta `FIREFLIES_INVITEE`.

Recorrido completo: `pendientes_revision.md`, sección de Outlook.

## 2. Conexiones pendientes (dependen de Prime o del usuario)

| Conexión | Qué falta |
|---|---|
| Cuentas de Microsoft 365 | Crear `entrevistas@` y una cuenta con licencia por reclutador; cada uno hace **Mi cuenta → Conectar Outlook**. Hoy solo está conectada `sistemas@`. Falta confirmar a Xavier, Edwin y Ulises. |
| Fireflies | Cuenta con `entrevistas@`, su API key, y `FIREFLIES_INVITEE` en Vercel. Sin eso la transcripción no llega a la ficha. |
| WhatsApp (Whaapy) | Probar que un mensaje de un candidato llegue a la ficha (y revisar Configuración → Logs). **Rotar la API key**, que se pegó en el chat el 13 nov. |
| ~~Resend~~ | **Se reemplaza por Outlook (27 nov)** para los reportes: ver prioridad 6. Queda pendiente el SMTP de Supabase (invitaciones y "Olvidé mi contraseña"): hoy usa el correo de prueba de Supabase, que tiene un límite muy bajo por hora. Hay que decidir con qué SMTP. Un buzón compartido no sirve para eso porque no tiene contraseña; tendría que ser una cuenta con licencia y SMTP AUTH habilitado. |
| ~~Pandapé~~ | **Descartado el 23 nov**: no se integra. Los candidatos entran a mano o por carga masiva de CV. |
| Psicotest | Ver §5 de este archivo. |

## 3. Lo que falta programar, en orden

1. ✅ **Correos automáticos** (23 nov, plan §12.23, sin probar con correos reales): a las 8:00 con lo del día anterior; el semanal con PDF el día de cada cliente. **Falta de Prime:** destinatarios de cada cliente (Clientes → cliente → contacto y correos de reportes).
2. **Calibrar la IA del CV:** alerta "Sin fechas de inicio y fin" en el prompt de `cv_score`, subir `PROMPT_VERSION` y recalificar.
3. **"Olvidé mi contraseña" en el portal del cliente.** Hoy solo lo tienen los admins.
4. **Fireflies:** webhook `/api/webhooks/fireflies`, tarea `fireflies_fetch_transcript` y análisis de la entrevista con IA (`interview_analysis`). Necesita la API key.
5. **WhatsApp:**
   - ✅ Primer contacto con aviso de privacidad, enlace del psicométrico, recordatorios (psicométrico 12 y 48 h, documentos 24 y 48 h), solicitud de documentos y aviso de descarte (23 nov, plan §12.22, sin probar). **Falta:** dar de alta en Whaapy las 2 plantillas nuevas (§4).
   - ✅ `interview_confirm` (23 nov, sin probar): recordatorio a las 8:00 del día anterior con fecha, hora y enlace de Teams; si se agenda después, sale en el momento. **Probar:** agendar una entrevista para mañana a un candidato con tu teléfono y revisar que llegue el WhatsApp y que aparezca en la ficha (y en Configuración → Logs, tarea "Recordatorio de entrevista").
   - Abrir desde la ficha los archivos que manda el candidato (URL firmada + `log_audit`).
   - Aviso al reclutador cuando el candidato contesta.
   - Después: agente de prefiltro (`prefilter_reply`).
6. **Psicotest:** lectura del PDF con IA (`psych_parse`). Necesita 3 o 4 PDF reales.
7. **Documentos y resumen semanal:** `doc_check` (verificar INE, comprobantes, etc.) y `weekly_insights`.

## 4. Plantillas: dónde se ven

| Plantilla | Dónde verla | Dónde se edita | Estado |
|---|---|---|---|
| Correo diario interno | App → **Reportes → Vista previa de correos** | `src/lib/email/templates.tsx` (`DailyInternalEmail`) | Solo vista previa; todavía no se envía |
| Correo diario al cliente | App → **Reportes → Vista previa de correos** (elegir cliente) | `src/lib/email/templates.tsx` (`DailyClientEmail`) | Solo vista previa |
| Reporte semanal al cliente | App → **Reportes → Vista previa de correos** | `src/lib/email/templates.tsx` (`WeeklyClientEmail`) | Solo vista previa; falta el PDF |
| Invitación de entrevista (Outlook) | El correo que ya llegó | `src/actions/interviews.ts:59-60` (asunto y cuerpo) | Funciona |
| Plantillas de WhatsApp | Panel de Whaapy → Plantillas; en la app, ficha del candidato → WhatsApp → "Plantilla" | Se crean y aprueban en Whaapy (Meta las aprueba); la app las lee con `listTemplates()` | Funciona el envío manual; faltan las de primer contacto, confirmación de entrevista y recordatorios |
| "Olvidé mi contraseña" e invitación de usuario | Supabase → Authentication → Email Templates | Ahí mismo | Salen por el SMTP de Resend |

Aprobadas en Whaapy al 23 nov: `primer_contacto_utility`, `confirmacion_entrevista_utility`, `enlace_psicometrico_utility`, `cierre_corte_utility` y `hola`.

### Plantillas nuevas para dar de alta en Whaapy (23 nov): solo 2

Panel de Whaapy → Plantillas → Nueva. Categoría **Utilidad**, idioma **Español (MX)** (`es_MX`), con el nombre exacto. Meta las revisa (horas o un día). Mientras no estén aprobadas, ese mensaje no sale y queda en Configuración → Logs; lo demás funciona.

| Nombre | Texto | Variables |
|---|---|---|
| `primer_contacto_aviso_utility` | Hola {{1}}, te escribimos de Prime HR Innovation por tu postulación a la vacante de {{2}}. Antes de continuar, consulta nuestro aviso de privacidad: {{3}} ¿Podemos comenzar con unas preguntas breves por este medio? | nombre, vacante, enlace del aviso |
| `solicitud_documentos_utility` | Hola {{1}}, para continuar tu proceso para la vacante de {{2}} necesitamos estos documentos: {{3}}. Puedes enviarlos por este medio como foto o PDF. | nombre, vacante, lista de documentos |

Ejemplos para Meta (los pide al crear): nombre "Ana", vacante "Ejecutivo de cobranza", enlace "https://psicotest.mx/abc123", fecha "jueves 26 de noviembre", documentos "INE (frente y reverso), CURP y Comprobante de domicilio".

**Descarte:** por ahora se usa `cierre_corte_utility`, ya aprobada: *"Hola {{1}}, gracias por tu interés en la vacante de {{2}}. En esta ocasión no continuarás en el proceso, pero conservaremos tus datos para futuras oportunidades."* Si Prime prefiere otro texto, por ejemplo *"Hola {{1}}, gracias por tu interés en la vacante de {{2}}. Hemos concluido el proceso y en esta ocasión no fuiste seleccionado. Agradecemos tu tiempo y conservaremos tus datos para futuras oportunidades."*, se da de alta como `descarte_utility` y se pone `WHAAPY_TEMPLATE_DISCARD=descarte_utility` en Vercel.

El primer contacto de antes (`primer_contacto_utility`) ya no lo usa el sistema porque no lleva el aviso de privacidad. Los recordatorios reusan plantillas: el del psicométrico vuelve a mandar `enlace_psicometrico_utility` y el de documentos vuelve a mandar `solicitud_documentos_utility` con lo que sigue faltando.


## 5. Psicotest: acceso

- **No hay integración ni API.** En la app, el reclutador abre la ficha del candidato → **Psicométrico**, pega el enlace de la evaluación (`https://psicotest.mx/…`), sube el PDF de resultados y captura el veredicto (`src/components/candidate/psych-forms.tsx`).
- **La cuenta es de Prime.** Pedirles usuario y contraseña por un canal seguro (no por chat) o una cuenta de reclutador, para:
  - [ ] Ver cómo se crea una evaluación y qué enlace genera (para mandarlo después por WhatsApp).
  - [ ] Confirmar si tiene API, exportación o aviso por correo al terminar la prueba.
  - [ ] Descargar 3 o 4 PDF de resultados reales para calibrar `psych_parse`.
  - [ ] Revisar créditos disponibles y costo por evaluación.
- Pendiente legal: formato de consentimiento para datos sensibles, que va antes del enlace en WhatsApp.

## 6. Lo que Prime sigue debiendo

~~Aviso de privacidad~~ (ya está desde el 23 nov: `PRIVACY_NOTICE_URL`, página de Pandapé, va en el primer contacto por WhatsApp), acceso a Psicotest y PDF de resultados, CV reales, Excel histórico de candidatos, ~~logotipo~~ (ya está), destinatarios de los correos por cliente, correcciones de `datos_errores.md`, Grupo Huerta y Chela Chupas.
