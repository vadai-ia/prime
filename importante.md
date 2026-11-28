# Importante · estado del proyecto y lo que falta

**Leer al empezar cada sesión** (junto con `tomorrow.md`). Escrito el 27 nov 2026; avance estimado **~88 %**. Al terminar algo, tacharlo aquí.

Lo que falta es sobre todo configuración externa (sistemas de Prime) y la IA que necesita datos reales.

## 1. Programación (Claude)

**Para cerrar lo que ya existe:**

1. ✅ **Reportes por Outlook en lugar de Resend** (plan §12.29). Programado el 27 nov, sin probar. Sale solo cuando sistemas haga el paso 6b de `microsoft365-pasos.md` (§2) y se pongan `REPORTS_MAILBOX` y `MICROSOFT_TENANT_ID` en Vercel. Se prueba con Configuración → Integraciones → "Mandarme un correo de prueba".
2. **Que la app se entere si una entrevista se mueve o se cancela en Outlook.** Suscripción de Graph al calendario de cada reclutador (`/api/webhooks/microsoft`, renovación cada ~3 días en `recurring.ts`), actualizar `interviews` y avisar con `app.notify_application()`.
3. **SMTP para invitaciones y "Olvidé mi contraseña".** Hoy Supabase usa su SMTP de prueba, con límite muy bajo. Un buzón compartido no sirve porque no tiene contraseña: hace falta una cuenta con licencia y SMTP AUTH.
4. **"Olvidé mi contraseña" en el portal del cliente.** Hoy solo lo tienen los admins.
5. **IA del CV:** alerta "Sin fechas de inicio y fin" en el prompt de `cv_score`, subir `PROMPT_VERSION` y recalificar.

**IA y WhatsApp:**

6. **Análisis de la entrevista con IA** a partir de la transcripción de Teams (`interview_analysis`).
7. **WhatsApp:**
   - Abrir desde la ficha los archivos que manda el candidato (URL firmada + `log_audit`).
   - Aviso al reclutador cuando el candidato contesta.
   - Agente de prefiltro (`prefilter_reply`). Es lo más grande que queda.
8. **Psicotest:** leer el PDF de resultados con IA (`psych_parse`). Necesita 3 o 4 PDF reales.
9. **Revisión de documentos con IA** (`doc_check`: INE, comprobantes) y **resumen semanal interno** (`weekly_insights`).

## 2. Sistemas de Prime (Microsoft 365 / Entra ID)

Todo se puede hacer en una sola sesión. Pasos detallados en `microsoft365-pasos.md`.

- [ ] Crear el **buzón compartido `reportes@primehrinnovation.com.mx`**. Es gratis: no lleva licencia hasta 50 GB.
- [ ] **Permiso de aplicación `Mail.Send` restringido solo a `reportes@`** con RBAC for Applications de Exchange (comandos en `microsoft365-pasos.md` paso 6b.2). **No** darlo como permiso de aplicación en Entra ID, porque valdría para todos los buzones. Sin esto no salen los reportes. Después, en Vercel: `REPORTS_MAILBOX=reportes@primehrinnovation.com.mx` y `MICROSOFT_TENANT_ID` con el id del inquilino.
- [ ] `Mail.Send` **delegado** con consentimiento de admin, para el correo al reclutador cuando agenda. Después, `OUTLOOK_MAIL_SEND=1` en Vercel.
- [ ] `OnlineMeetings.ReadWrite` y `OnlineMeetingTranscript.Read.All` con consentimiento de admin, para las transcripciones de Teams. Después, `TEAMS_TRANSCRIPTS=1`.
- [ ] **Una cuenta con licencia por reclutador**, y que cada uno conecte su Outlook en Mi cuenta. Falta confirmar a Xavier, Edwin y Ulises.
- [ ] Revisar que la **licencia de Nancy** incluya Teams.

## 3. El usuario

- [ ] **Probar en producción lo del 27 nov:**
  - sugeridos ("Correlacionar candidatos de otra vacante")
  - WhatsApp `confirmacion_entrevista_utility` y correo al agendar, con un teléfono propio
  - fecha de la entrevista en la tarjeta del kanban
  - distintivo de contratado y los modales de contratar y de sacar de Contratados
  - reportes por fecha y "Día de envío" en la vista previa
- [ ] **Cerrar las 2 entrevistas viejas sin enlace** (17 y 25 nov). Salen en ámbar "sin cerrar".
- [ ] Dar de alta en Whaapy: `primer_contacto_aviso_utility` y `solicitud_documentos_utility` (texto en `siguientes_pasos.md` §4).
- [ ] **Rotar la API key de Whaapy**, que se pegó en el chat el 13 nov.
- [ ] Copiar `supabase/templates/invite.html` y `recovery.html` al panel de Supabase (Authentication → Email Templates).

## 4. Prime debe

- Destinatarios de los reportes de cada cliente (Clientes → cliente → Editar → correos de reportes).
- Acceso a Psicotest y PDF de resultados reales.
- CV reales y el Excel histórico de candidatos.
- Correcciones de `datos_errores.md`, Grupo Huerta y Chela Chupas.

## Orden recomendado

1. Sistemas hace los consentimientos (§2). Con eso se prende casi todo lo que ya está programado.
2. Reportes por Outlook (§1.1). Es lo que el cliente ve cada semana.
3. Prueba de punta a punta con un candidato de prueba: alta → WhatsApp → entrevista → psicométrico → documentos → Vo.Bo. → contratado.
4. Después, la IA: análisis de entrevista, prefiltro por WhatsApp y Psicotest.

## Ya hecho el 27 nov (para no repetirlo)

Logos · sugeridos de otras vacantes (0032) · correo al reclutador al agendar · enlace de Teams que faltaba · WhatsApp al agendar · entrevistas próximas en los reportes · reportes por fecha (0033) · fecha de la entrevista en el kanban · distintivo de contratado con confirmación al entrar y salir (0034). SQL 19, 20 y 21 corridos en producción.
