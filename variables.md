# Variables de entorno en Vercel · Prime HR Innovation

Actualizado el 29 de octubre de 2026. Dónde: **Vercel → proyecto → Settings → Environment Variables**. Al agregar cada una, marcar **Production** (y Preview si se usa). Después de agregar o cambiar cualquiera, **volver a desplegar** (Deployments → ⋯ → Redeploy); si no, no se aplican.

Los valores **no** se escriben en este archivo ni se mandan por chat. Las mismas variables van en `.env` para probar en local.

## 1. Las que ya deberían estar (revisar)

| Variable | Valor | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key de Supabase | Nunca en el navegador ni con prefijo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | `https://app.primehrinnovation.com.mx` | Sin `/` al final. Se fija al compilar: si cambia, redeploy |
| `ANTHROPIC_API_KEY` | La de Claude | console.anthropic.com |
| `CRON_SECRET` | Un texto largo cualquiera | Protege `/api/cron/tick` |
| `APP_TIMEZONE` | `America/Mexico_City` | Opcional; si no está, usa esa |

`MOCK_DATA` **no** debe estar en Vercel (solo desarrollo: con `1` muestra datos de demo y no guarda nada).

## 2. Outlook y Teams · después de la junta (`junta.md` paso 8)

| Variable | Valor | De dónde sale |
|---|---|---|
| `MICROSOFT_TENANT_ID` | Id. de directorio (inquilino) | Lo manda sistemas de Prime (Entra ID → Información general) |
| `MICROSOFT_CLIENT_ID` | Id. de aplicación (cliente) | Lo manda sistemas de Prime (Entra ID → Información general) |
| `MICROSOFT_CLIENT_SECRET` | El **Valor** del secreto (no el "Id. de secreto") | Lo manda sistemas de Prime (Certificados y secretos). Anotar su fecha de vencimiento |
| `ENCRYPTION_KEY` | 32 bytes en base64 | **La generamos nosotros una vez** (abajo). No cambiarla: si cambia, todos reconectan su Outlook |
| `TEAMS_TRANSCRIPTS` | `1` | **Solo después** de que sistemas agregue `OnlineMeetings.ReadWrite` y `OnlineMeetingTranscript.Read.All` con consentimiento de admin. Activa la grabación automática y la transcripción en la ficha (plan §12.24). Si se pone antes, agendar falla |
| `FIREFLIES_INVITEE` | *(vacía)* | Desde el 24 nov la transcripción es de Teams. Solo se pone si algún día se usa Fireflies; sin ella no se invita a nadie |

Generar `ENCRYPTION_KEY` (en la terminal):

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

o, en Git Bash, `openssl rand -base64 32`.

**Qué cambia al desplegar:** en Mi cuenta desaparece "Pendiente: falta registrar la app…" y aparece el botón **Conectar Outlook**. La pantalla revisa `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` y `ENCRYPTION_KEY`; sin `MICROSOFT_TENANT_ID` el botón sale igual, pero aceptaría cuentas de trabajo de cualquier empresa. Con ella, solo las de Prime.

## 3. Resend · cuando el dominio diga "Verified" (`junta.md` pasos 6 y 7)

| Variable | Valor | Nota |
|---|---|---|
| `RESEND_API_KEY` | La clave `re_…` | La crea sistemas de Prime en Resend → API Keys |
| `RESEND_FROM` | `Prime HR Innovation <recursoshumanos@primehrinnovation.com.mx>` | O el remitente que elija Prime (`contacto@`) |

Con estas dos salen los tres reportes automáticos (programados el 23 nov, plan §12.23). La invitación y el "Olvidé mi contraseña" no las usan; esos van por el SMTP de Supabase:

| Supabase → Authentication → SMTP Settings | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Puerto | `465` |
| Usuario | `resend` |
| Contraseña | La clave `re_…` |
| Correo del remitente | El elegido (`recursoshumanos@` o `contacto@`) |
| Nombre del remitente | `Prime HR Innovation` |

## 4. Para después (todavía no)

| Variable | Para qué | Cuándo |
|---|---|---|
| `FIREFLIES_API_KEY` | Descargar la transcripción de Fireflies | Cuando se programe el webhook y se elija plan con API |
| `FIREFLIES_WEBHOOK_SECRET` | Validar el webhook de Fireflies | Igual |
| `WHAAPY_API_KEY`, `WHAAPY_WEBHOOK_SECRET`, `WHAAPY_PHONE_E164` | WhatsApp | Cuando haya número definitivo y se programe |

## 5. Supabase · URL Configuration (no es variable, pero va junto)

| Supabase → Authentication → URL Configuration | Valor |
|---|---|
| Site URL | `https://app.primehrinnovation.com.mx` (corregido el 29 oct) |
| Redirect URLs | `https://app.primehrinnovation.com.mx/**` y `http://localhost:3000/**` |

## WhatsApp automático y correos (23 nov 2026, plan §12.21 a §12.23)

Todas son **opcionales**: sin ellas se usan los valores de la derecha. Solo hacen falta si Prime cambia el nombre de una plantilla en Whaapy o el enlace del aviso.

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `PRIVACY_NOTICE_URL` | `https://catch-your-talent-sa-cv.pandape.computrabajo.com/Privacy` | Enlace del aviso de privacidad en el primer contacto |
| `WHAAPY_TEMPLATE_FIRST_CONTACT` | `primer_contacto_aviso_utility` | Primer contacto con aviso de privacidad |
| `WHAAPY_TEMPLATE_INTERVIEW` | `confirmacion_entrevista_utility` | Recordatorio de entrevista un día antes |
| `WHAAPY_TEMPLATE_PSYCH_LINK` | `enlace_psicometrico_utility` | Enlace del psicométrico |
| `WHAAPY_TEMPLATE_PSYCH_REMINDER` | `enlace_psicometrico_utility` | Recordatorios del psicométrico (12 y 48 h): se vuelve a mandar el enlace |
| `WHAAPY_TEMPLATE_DOCS_REQUEST` | `solicitud_documentos_utility` | Lista de documentos al llegar a Documentos |
| `WHAAPY_TEMPLATE_DOCS_REMINDER` | `solicitud_documentos_utility` | Recordatorios de documentos (24 y 48 h): se vuelve a mandar la lista de lo que falta |
| `WHAAPY_TEMPLATE_DISCARD` | `cierre_corte_utility` | Agradecimiento al descartar |

Los correos usan `RESEND_API_KEY` y `RESEND_FROM` (§3; al 23 nov todavía no están). Sin ellas el cron no manda correos, no falla y lo anota en Configuración → Logs.
