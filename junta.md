# Junta con Prime · 30 de octubre de 2026

Temas: **Microsoft 365 (Outlook y Teams)**, **Fireflies** y **correos con Resend**. Detalle técnico en `tasks.md` §6 y `plan.md` §4.4 y §4.5.

**Decidido en la junta:** Prime no tiene Microsoft 365. Sus correos están en **cPanel, con Neolo**, y ahí se quedan. Se contrata **Microsoft 365 Empresa Básico** con cuentas `@primehrinnovation.onmicrosoft.com`, sin conectar el dominio ni cambiar los MX.

**Quién lo hace:** los pasos 0 a 8 los hace **el encargado de sistemas de Prime**. Nosotros lo guiamos en la llamada. Al final nos manda los datos del paso 8 y nosotros los pegamos (paso 9). Tiempo estimado: 45 a 60 minutos.

## Resumen

| Paso | Qué | Quién | Dónde | Tiempo |
|---|---|---|---|---|
| 0 | **Contratar Empresa Básico** y elegir remitente | Sistemas de Prime | microsoft.com | 10 min |
| 1 | **Crear `entrevistas@` y los 6 reclutadores** con licencia | Sistemas de Prime | admin.microsoft.com | 15 min |
| 2 | Ajustar Teams (anónimos y sala de espera) | Sistemas de Prime | admin.teams.microsoft.com | 5 min |
| 3 | Registrar el sistema en Entra ID | Sistemas de Prime | portal.azure.com | 15 min |
| 4 | **Crear la cuenta de Fireflies** con `entrevistas@` | Sistemas de Prime | fireflies.ai | 10 min |
| 5 | **Crear la cuenta de Resend** con `contacto@` | Sistemas de Prime | resend.com | 5 min |
| 6 | **Pegar los registros DNS** de Resend | Sistemas de Prime | cPanel → Zone Editor | 10 min |
| 7 | Crear la clave de Resend | Sistemas de Prime | resend.com | 2 min |
| 8 | Mandarnos los datos por canal seguro | Sistemas de Prime | — | — |
| 9 | Código, claves en Vercel, SMTP en Supabase y prueba | VADAI | Vercel, Supabase | 1 a 2 h |
| 10 | Conectar Outlook (una sola vez) | Cada reclutador | app.primehrinnovation.com.mx | 1 min |

## Para entender antes

| Concepto | Qué es | Panel |
|---|---|---|
| **cPanel (Neolo)** | Donde siguen sus correos actuales y el DNS del dominio. No se conecta con Microsoft | cPanel del hosting |
| **Microsoft 365 Empresa Básico** | La suscripción nueva: cuentas, licencias, buzón, calendario y Teams. Es Business Basic en español | admin.microsoft.com |
| **Outlook** | Correo y calendario de la cuenta de Microsoft | outlook.office.com |
| **Teams** | Videollamadas, con su propio panel de administración | admin.teams.microsoft.com |
| **Entra ID** | Donde se registra nuestro sistema para crear eventos en el calendario de cada reclutador | portal.azure.com |
| **Fireflies** | Graba y transcribe las entrevistas; se le invita a la reunión como un participante más | fireflies.ai |
| **Resend** | Manda los correos del sistema (reportes, invitaciones, recuperar contraseña) a nombre de `@primehrinnovation.com.mx` | resend.com |

## Qué cuentas se crean

| Cuenta | ¿Nueva? | ¿Licencia de Microsoft? | Para qué |
|---|---|---|---|
| `sistemas@primehrinnovation.onmicrosoft.com` | Sí, al contratar | **No** | La cuenta maestra: administra usuarios, licencias, Teams y Entra ID |
| `entrevistas@primehrinnovation.onmicrosoft.com` | Sí | **Sí, 1** | Fireflies entra con ella a todas las entrevistas |
| `nombre@primehrinnovation.onmicrosoft.com`, una por reclutador | Sí, 6 | **Sí, 6** | Su calendario, sus eventos de Teams y las invitaciones a candidatos |
| Remitente (`recursoshumanos@` o `contacto@primehrinnovation.com.mx`) | **No**, una que ya exista en cPanel | No | De ahí salen los correos del sistema y ahí llegan las respuestas. Resend verifica el **dominio**, no el buzón |
| Cuenta de Fireflies | Sí, con `entrevistas@` | No suma licencia. Plan gratis para la prueba | Grabar y transcribir |
| Cuenta de Resend | Sí, con `contacto@primehrinnovation.com.mx` | No. Gratis hasta 3,000 correos al mes | Mandar los correos |

**Total: 7 licencias de Empresa Básico.** Si alguno de los 6 no agenda entrevistas, no necesita licencia. Los correos de cPanel no reciben licencia, no se tocan y no se borran.

**Sobre cPanel y su DNS:** los registros de Resend van en **subdominios propios** (`send` y `resend._domainkey`). No tocan los MX, así que `contacto@` y los demás correos siguen funcionando igual.

---

## Paso 0 · Contratar · microsoft.com

Página: [Microsoft 365 Empresa Básico](https://www.microsoft.com/es-mx/microsoft-365/business/microsoft-365-business-basic).

| ✓ | Qué hacer | Debe quedar |
|---|---|---|
| ☐ | Revisar el plan antes de pagar | **Microsoft 365 Empresa Básico, con Teams incluido**. No una versión "sin Teams", ni Teams Essentials (no trae buzón de Exchange y el sistema no funcionaría). Office 365 E1 también funciona, pero cuesta más sin darnos nada que usemos |
| ☐ | Cantidad | **7 licencias**, unos 49 USD al mes más impuestos (confirmar el precio al comprar) |
| ☐ | Correo de contacto | `contacto@primehrinnovation.com.mx` |
| ☐ | Crear la cuenta maestra | `sistemas@primehrinnovation.onmicrosoft.com`, a nombre de Prime y con autenticación en dos pasos. Si el nombre está ocupado, anotar el que quede y cambiarlo en toda esta guía |
| ☐ | Si el asistente pide conectar el dominio, migrar correo o cambiar DNS | **Saltarlo.** No cambiar los MX |
| ☐ | Licencia de `sistemas@` | Si Microsoft le asignó una, quitársela y dársela a quien falte |
| ☐ | Remitente de los correos | En cPanel, ¿existe `recursoshumanos@`? Si no, usar `contacto@` |

## Paso 1 · Crear las 7 cuentas · admin.microsoft.com

Entrar con `sistemas@`. Usuarios → Usuarios activos → **Agregar un usuario**, una vez por cuenta.

**1.1 `entrevistas@`**

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre para mostrar | `Entrevistas Prime HR` |
| ☐ | Nombre de usuario | `entrevistas` @ `primehrinnovation.onmicrosoft.com` |
| ☐ | Contraseña | La define sistemas y la guarda (se usa en el paso 4) |
| ☐ | Licencia | **Microsoft 365 Empresa Básico** |
| ☐ | Tipo | **Usuario normal**, no buzón compartido (Fireflies inicia sesión con ella) |
| ☐ | Comprobar | Entrar a outlook.office.com con `entrevistas@`: deben verse buzón y calendario |

**1.2 Los 6 reclutadores**

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre para mostrar | Por ejemplo `Ana López · Prime HR`: el candidato lo ve en la invitación |
| ☐ | Nombre de usuario | El mismo nombre de su correo actual, @ `primehrinnovation.onmicrosoft.com` |
| ☐ | Licencia | **Microsoft 365 Empresa Básico** |
| ☐ | Contraseña temporal | Entregársela a cada persona |

**1.3 Reenvío de las respuestas a cPanel**

| ✓ | Dónde | Qué hacer |
|---|---|---|
| ☐ | Microsoft Defender → Directivas contra correo no deseado → directiva de salida | Activar el reenvío automático; viene bloqueado hacia correos externos |
| ☐ | admin.microsoft.com → Usuarios activos → cada reclutador → Correo → Reenvío de correo | Poner su dirección de cPanel y dejar activado guardar una copia |

## Paso 2 · Ajustar Teams · admin.teams.microsoft.com

Hacerlo temprano: los cambios tardan algunas horas en aplicarse.

| ✓ | Menú | Opción | Valor |
|---|---|---|---|
| ☐ | Reuniones → Directivas de reunión → **Global** | Los usuarios anónimos pueden unirse a una reunión | **Activado** |
| ☐ | Reuniones → Directivas de reunión → **Global** | Quién puede omitir la sala de espera | **Todos** (si no, el reclutador admite al candidato y al bot) |
| ☐ | Reuniones → Directivas de reunión → **Global** | Transcripción | **Activado** (para comparar con Fireflies) |
| ☐ | Reuniones → **Configuración de reuniones** | Los usuarios anónimos pueden unirse a una reunión | **Activado** |

## Paso 3 · Registrar el sistema · portal.azure.com

Entrar con `sistemas@`. Microsoft Entra ID → **Registros de aplicaciones** → **Nuevo registro**. No hace falta una suscripción de pago de Azure.

**3.1 Registro**

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre | `Prime HR Reclutamiento` |
| ☐ | Tipos de cuenta admitidos | **Solo cuentas de este directorio organizativo** (o "Solo para un inquilino") |
| ☐ | URI de redirección (tipo **Web**) | `https://app.primehrinnovation.com.mx/api/integrations/microsoft/callback` |
| ☐ | Menú Autenticación → Agregar URI (tipo Web) | `http://localhost:3000/api/integrations/microsoft/callback` |

**3.2 Permisos** · Menú **Permisos de API** → Agregar un permiso → **Microsoft Graph** → **Permisos delegados**

| ✓ | Permiso | Para qué |
|---|---|---|
| ☐ | `openid` | Iniciar sesión |
| ☐ | `email` | Saber qué correo conectó cada reclutador |
| ☐ | `offline_access` | Que la conexión no caduque cada hora |
| ☐ | `User.Read` | Leer el nombre del reclutador |
| ☐ | `Calendars.ReadWrite` | Crear, mover y cancelar la entrevista en su calendario con enlace de Teams |
| ☐ | `OnlineMeetingTranscript.Read.All` | *Opcional:* leer la transcripción de Teams si se elige en lugar de Fireflies. Agregarlo ahora evita volver a pedirle al admin |
| ☐ | Botón **Conceder consentimiento de administrador para Prime** → Sí | Todos con palomita verde. Sin esto, a cada reclutador le sale "Se necesita aprobación del administrador" |

**3.3 Secreto y datos** · Menú **Certificados y secretos** → **Nuevo secreto de cliente**

| ✓ | Qué | Dónde | Ojo |
|---|---|---|---|
| ☐ | Descripción `Sistema reclutamiento`, expira **24 meses** | Nuevo secreto de cliente | — |
| ☐ | Copiar el **Valor** | Columna "Valor" | **No** la columna "Id. de secreto". Solo se ve una vez |
| ☐ | Anotar la fecha de vencimiento | Columna "Expira" | Recordatorio un mes antes: ese día Outlook deja de funcionar para todos |
| ☐ | Copiar **Id. de directorio (inquilino)** | Menú Información general | — |
| ☐ | Copiar **Id. de aplicación (cliente)** | Menú Información general | — |

## Paso 4 · Cuenta de Fireflies · fireflies.ai

| ✓ | Qué | Valor |
|---|---|---|
| ☐ | Sign up → **Sign in with Microsoft** | Entrar con `entrevistas@primehrinnovation.onmicrosoft.com` y aceptar el acceso al calendario. Si pide aprobación de administrador, la da `sistemas@` |
| ☐ | Settings → Auto-join | **Todas las reuniones con enlace** (esa cuenta solo recibe entrevistas) |
| ☐ | Settings → Idioma de transcripción | **Español** |
| ☐ | Plan | **Gratis** para la prueba. No pagar todavía |

**Preguntar a Fireflies antes de pagar** (chat de soporte o ventas; las respuestas, por escrito):

| ✓ | Pregunta | Respuesta |
|---|---|---|
| ☐ | ¿Qué plan incluye **API y webhooks**? | |
| ☐ | ¿Una sola cuenta puede grabar **varias reuniones de Teams al mismo tiempo**? ¿En qué plan? | |
| ☐ | ¿Cuántas horas de grabación y almacenamiento incluye cada plan? | |
| ☐ | Precio del plan que lo incluya, con un solo usuario | |

## Paso 5 · Cuenta de Resend · resend.com

| ✓ | Qué | Valor |
|---|---|---|
| ☐ | Sign up | Con `contacto@primehrinnovation.com.mx` (ya existe en cPanel y recibe correo; la cuenta queda a nombre de Prime, no de una persona) |
| ☐ | Domains → **Add domain** | `primehrinnovation.com.mx` |
| ☐ | Región | **North Virginia (us-east-1)** |
| ☐ | Dejar abierta la pantalla con los registros | Se usan en el paso 6 |

## Paso 6 · Pegar los registros DNS · cPanel → Zone Editor

Entrar a **Zone Editor** (Editor de zonas) en el cPanel de Neolo y crear **cada registro tal cual lo muestra Resend**, con su botón de copiar. Si ahí no aparece el dominio o el DNS está en otro lado, preguntar a Neolo dónde se administra. La tabla es de referencia; los valores exactos los da Resend.

| ✓ | Tipo | Nombre | Valor (de Resend) | Prioridad |
|---|---|---|---|---|
| ☐ | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| ☐ | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| ☐ | TXT | `resend._domainkey` | El valor largo que empieza con `p=` | — |
| ☐ | TXT | `_dmarc` | `v=DMARC1; p=none;` — **solo si el dominio no tiene uno ya** | — |

| Reglas | |
|---|---|
| **No borrar ni editar** registros existentes | Los MX y el SPF del correo de cPanel se quedan igual. Tampoco tocar la opción **Email Routing** |
| Si el panel agrega el dominio solo | Que el nombre quede `send`, no `send.primehrinnovation.com.mx.primehrinnovation.com.mx` |
| Al terminar | Resend → **Verify DNS records**. De minutos a unas horas, hasta que diga **Verified** |

## Paso 7 · Clave de Resend · resend.com

Cuando el dominio diga **Verified**: **API Keys** → **Create API key**. Si tarda, acordar quién nos la manda y cuándo.

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre | `Sistema reclutamiento` |
| ☐ | Permiso | **Sending access** |
| ☐ | Dominio | `primehrinnovation.com.mx` |
| ☐ | Copiar la clave | Empieza con `re_`. **Solo se ve una vez** |

## Paso 8 · Datos que nos manda sistemas

Por un gestor de contraseñas compartido o dictados en la llamada. **No** por WhatsApp ni correo normal.

| ✓ | Dato | De qué paso | Variable donde lo pegamos |
|---|---|---|---|
| ☐ | Id. de directorio (inquilino) | 3.3 | `MICROSOFT_TENANT_ID` |
| ☐ | Id. de aplicación (cliente) | 3.3 | `MICROSOFT_CLIENT_ID` |
| ☐ | Valor del secreto de cliente | 3.3 | `MICROSOFT_CLIENT_SECRET` |
| ☐ | Fecha de vencimiento del secreto | 3.3 | Recordatorio |
| ☐ | Clave de Resend (`re_…`) | 7 | `RESEND_API_KEY` y contraseña SMTP de Supabase |
| ☐ | Remitente elegido | 0 | `RESEND_FROM` y remitente SMTP de Supabase |
| ☐ | Contraseñas de `sistemas@` y `entrevistas@` | 0 y 1 | Se quedan con Prime; solo si hace falta entrar a Fireflies |

---

## Paso 9 · Nosotros, después de la junta

**9.1 Variables en Vercel** (Settings → Environment Variables, después volver a desplegar)

| ✓ | Variable | Valor |
|---|---|---|
| ☐ | `MICROSOFT_TENANT_ID` | Del paso 8 |
| ☐ | `MICROSOFT_CLIENT_ID` | Del paso 8 |
| ☐ | `MICROSOFT_CLIENT_SECRET` | Del paso 8 |
| ☐ | `ENCRYPTION_KEY` | La generamos: `openssl rand -base64 32`. Si cambia, todos reconectan Outlook |
| ☐ | `FIREFLIES_INVITEE` | `entrevistas@primehrinnovation.onmicrosoft.com`. Antes, commit y despliegue del cambio de `microsoft-graph.ts` (ver 9.4) |
| ☐ | `RESEND_API_KEY` | Del paso 8 |
| ☐ | `RESEND_FROM` | `Prime HR Innovation <remitente elegido>` |

**9.2 SMTP de Supabase** (Authentication → SMTP Settings → Enable custom SMTP). Arregla invitaciones y recuperación de contraseña; no requiere código.

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Host | `smtp.resend.com` |
| ☐ | Puerto | `465` |
| ☐ | Usuario | `resend` |
| ☐ | Contraseña | La clave de Resend |
| ☐ | Correo del remitente | El elegido en el paso 0 |
| ☐ | Nombre del remitente | `Prime HR Innovation` |
| ☐ | Probar | "Olvidé mi contraseña" con un admin |

**9.3 Prueba completa** (con un reclutador conectado y un candidato que use un correo nuestro)

| ✓ | # | Qué | Debe pasar |
|---|---|---|---|
| ☐ | 1 | Conectar Outlook en Mi cuenta con la cuenta `onmicrosoft.com` | Dice "Outlook conectado" |
| ☐ | 2 | Agendar la entrevista desde la ficha | El evento aparece en el Outlook del reclutador con enlace de Teams |
| ☐ | 3 | Revisar el correo del candidato | Le llega la invitación desde la dirección `onmicrosoft.com`; revisar que no caiga en spam |
| ☐ | 4 | Entrar desde el navegador sin cuenta | Entra directo (o el reclutador lo admite) |
| ☐ | 5 | Esperar al bot | Entra Fireflies y la transcripción aparece en Fireflies |
| ☐ | 6 | Reagendar | El evento se mueve y el candidato recibe la actualización |
| ☐ | 7 | Cancelar | El evento se cancela y el candidato recibe el aviso |
| ☐ | 8 | Desconectar y volver a conectar Outlook | Funciona igual |
| ☐ | 9 | Dos reclutadores a la misma hora | ¿El bot entra a las dos? En plan gratis, un fallo puede ser solo por el límite del plan |
| ☐ | 10 | Responder la invitación desde el correo del candidato | La respuesta llega al buzón de Microsoft y se reenvía al correo de cPanel |
| ☐ | 11 | Comparar con la transcripción de Teams | Decidir Fireflies o Teams |

**9.4 Código que falta**

| Cuándo | Qué | Para qué | Bloquea |
|---|---|---|---|
| Programado, sin commit (29 oct) | Invitado de Fireflies configurable con la variable `FIREFLIES_INVITEE`; sin ella se invita a `fred@fireflies.ai` | Con la cuenta maestra, Fireflies entra porque la entrevista cae en el calendario de `entrevistas@` | Hasta desplegarlo, la variable no hace nada |
| Ya existe | Aviso al cancelar si el Outlook de quien agendó ya no está conectado | La ficha dice "borra el evento a mano" | — |
| Después del dominio verificado | Mandar los 3 correos automáticos: `sendEmail()`, tareas `report_daily_internal`, `report_daily_client`, `report_weekly_client`, sus horarios y el PDF semanal | Hoy solo existen las plantillas y la vista previa | Los reportes; necesita también los destinatarios de Prime |
| Después de la prueba | Webhook de Fireflies (o lectura de la transcripción de Teams) y análisis de la entrevista con IA | Que la transcripción llegue sola a la ficha con hallazgos y score | Análisis de entrevistas; necesita la API key de Fireflies y el guion de entrevista |

## Paso 10 · Cada reclutador (una sola vez, cuando le avisemos)

| ✓ | Qué | Resultado |
|---|---|---|
| ☐ | app.primehrinnovation.com.mx → entrar con su usuario de siempre → **Mi cuenta** → **Conectar Outlook** | Se abre la ventana de Microsoft |
| ☐ | En la ventana de Microsoft, entrar con `nombre@primehrinnovation.onmicrosoft.com`. Si ya hay otra cuenta abierta, **"Usar otra cuenta"**. El correo de cPanel no funciona aquí | No pide aprobación (sistemas ya la dio en el paso 3) |
| — | Desde ahí, al agendar | La entrevista sale sola en su calendario con enlace de Teams, invitación al candidato y a Fireflies |

| Dónde | Con qué cuenta |
|---|---|
| App de Prime | La de siempre |
| Outlook web, Teams y Conectar Outlook | `nombre@primehrinnovation.onmicrosoft.com` |
| Correo de todos los días | Su correo de cPanel |

---

## Si después quieren usar `@primehrinnovation.com.mx` en Microsoft

No hace falta volver a contratar: se conecta el dominio a las mismas licencias, se cambian los nombres de usuario y probablemente haya que reconectar Outlook. Lo más limpio es migrar también el correo a Microsoft, con licencia por cada buzón que se mueva. Mantener el correo en cPanel con la misma dirección en Microsoft requiere editar el SPF y usar "Retransmisión interna"; si queda mal se puede perder o desviar correo, así que lo haría un técnico.

## Lo que tiene que decidir Prime para los correos

| ✓ | Correo | Qué necesitamos | Propuesta |
|---|---|---|---|
| ☐ | Resumen diario interno | Destinatarios | Diario 18:00; admins completo, cada reclutador lo suyo |
| ☐ | Candidatos que avanzaron | Contacto de cada cliente, hora y copias | Diario, hora por cliente |
| ☐ | Reporte semanal con PDF | Contacto de cada cliente y copias | Viernes 9:00 |
| ☐ | Todos | Firma y tono | — |

## Otros temas, si da tiempo

| ✓ | Tema | Detalle |
|---|---|---|
| ☐ | Cambio de visibilidad | Todos los reclutadores de una vacante ven a todos sus candidatos |
| ☐ | Correcciones de datos | `datos_errores.md`: usuarios, clientes y vacantes; Grupo Huerta y Chela Chupas |
| ☐ | API de Pandapé | Que la pidan a su Customer Success (`requerimientos_estado.md` §8) |
| ☐ | Legal | Aviso de privacidad, consentimiento de grabación y plazo de retención de datos |
| ☐ | Archivos | CV reales, 3 o 4 PDF de Psicotest, guion de entrevista, logotipo en SVG o PNG |
