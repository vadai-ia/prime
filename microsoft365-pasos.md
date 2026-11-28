# Microsoft 365 para Prime HR · pasos completos

*12 nov 2026. Guía para la reunión con sistemas de Prime. Reemplaza los pasos 0 a 4 y 8 de `junta.md`; el correo con Resend ya quedó.*

**Quién lo hace:** el encargado de sistemas de Prime, entrando con **`sistemas@primehrinnovation.onmicrosoft.com`**. Nosotros lo guiamos. Tiempo: 45 a 60 minutos.

**Qué no se toca:** el correo de cPanel (Neolo), sus MX ni su DNS. Microsoft 365 queda aparte, solo con cuentas `@primehrinnovation.onmicrosoft.com`.

---

## Todas las cuentas

| Cuenta | Licencia Empresa Básico | Quién la usa | Para qué |
|---|---|---|---|
| `sistemas@primehrinnovation.onmicrosoft.com` | **No** | Encargado de sistemas | Cuenta maestra (Administrador global): crea cuentas, licencias, Teams y la app en Entra ID. No agenda entrevistas ni se conecta en la app |
| `entrevistas@primehrinnovation.onmicrosoft.com` | **Sí** | Fireflies | Se invita a todas las entrevistas; Fireflies ve su calendario y entra solo a grabar |
| `gabriela@primehrinnovation.onmicrosoft.com` | **Sí** | Gabriela | Su calendario y sus entrevistas de Teams |
| `eduardo@primehrinnovation.onmicrosoft.com` | **Sí** | Eduardo | Igual |
| `mauricio@primehrinnovation.onmicrosoft.com` | **Sí** | Mauricio | Igual |
| `denisse@primehrinnovation.onmicrosoft.com` | **Sí** | Patricia Denisse | Igual |
| `diego@primehrinnovation.onmicrosoft.com` | **Sí** | Diego | Igual |
| `nancy@primehrinnovation.onmicrosoft.com` | **Sí** | Nancy | Igual |

**Total: 7 licencias.** Los nombres de usuario de los reclutadores son propuesta: usar **el mismo usuario que tienen en cPanel** (si en cPanel es `glopez@`, aquí `glopez@`). Confirmar en la reunión la lista final de quién agenda entrevistas; quien no agenda no necesita cuenta ni licencia. Xavier, Edwin y Ulises: confirmar si agendan entrevistas.

**Correos que siguen en cPanel y no se tocan:**

| Cuenta | Para qué |
|---|---|
| `contacto@primehrinnovation.com.mx` | Remitente de los correos del sistema (Resend) y dueña de la cuenta de Resend |
| `recursoshumanos@primehrinnovation.com.mx` | Si existe, puede ser el remitente en lugar de `contacto@` |
| El correo de cada reclutador | Su correo de todos los días; ahí se reenvían las respuestas de los candidatos |

## ¿Qué buzón se usa para qué?

| Qué | Desde / hacia qué buzón |
|---|---|
| Invitación de entrevista al candidato (con enlace de Teams) | Sale del buzón **`nombre@…onmicrosoft.com`** del reclutador que agenda |
| Respuesta del candidato a la invitación | Llega al buzón **onmicrosoft** del reclutador y se **reenvía** a su correo de cPanel (paso 4) |
| Reagendar y cancelar | Igual: desde el buzón onmicrosoft del reclutador |
| Fireflies | Lee el calendario de **`entrevistas@…onmicrosoft.com`** |
| Reportes, invitación a la app, "Olvidé mi contraseña" | Resend, desde `contacto@primehrinnovation.com.mx` (ya hecho) |
| Correo de todos los días | cPanel, igual que hoy |

El reclutador **no necesita abrir** el buzón onmicrosoft en el día a día: lo importante le llega reenviado a cPanel. Solo lo usa para entrar a Teams y, si quiere, ver su calendario en outlook.office.com.

---

## Paso 1 · Revisar la cuenta maestra y las licencias · admin.microsoft.com

| ✓ | Qué | Debe quedar |
|---|---|---|
| ☐ | Entrar con `sistemas@primehrinnovation.onmicrosoft.com` | Con autenticación en dos pasos |
| ☐ | Usuarios → Usuarios activos → `sistemas@` → Roles | **Administrador global**. Sin esto no se puede hacer el paso 6 |
| ☐ | Facturación → Licencias | **Microsoft 365 Empresa Básico**, 7 licencias. No una versión "sin Teams" ni Teams Essentials |
| ☐ | Licencia de `sistemas@` | Si tiene una, quitársela: es para otra cuenta |
| ☐ | Si el asistente pide conectar el dominio, migrar correo o cambiar DNS | **Saltarlo** |

## Paso 2 · Crear `entrevistas@` · Usuarios → Usuarios activos → Agregar un usuario

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre para mostrar | `Entrevistas Prime HR` |
| ☐ | Nombre de usuario | `entrevistas` @ `primehrinnovation.onmicrosoft.com` |
| ☐ | Contraseña | La define sistemas y la guarda (se usa en el paso 7) |
| ☐ | Licencia | **Microsoft 365 Empresa Básico** |
| ☐ | Tipo | **Usuario normal**, no buzón compartido (Fireflies inicia sesión con ella) |
| ☐ | Comprobar | Entrar a outlook.office.com con `entrevistas@`: se ven buzón y calendario |

## Paso 3 · Crear una cuenta por reclutador · mismo menú, una vez por persona

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre para mostrar | `Nombre Apellido · Prime HR` (el candidato lo ve en la invitación) |
| ☐ | Nombre de usuario | Su usuario de cPanel @ `primehrinnovation.onmicrosoft.com` |
| ☐ | Licencia | **Microsoft 365 Empresa Básico** |
| ☐ | Contraseña temporal | Entregársela a cada persona; al entrar la cambia |

| ✓ | Reclutador | Usuario onmicrosoft creado | Su correo de cPanel (para el reenvío) |
|---|---|---|---|
| ☐ | Gabriela | | |
| ☐ | Eduardo | | |
| ☐ | Mauricio | | |
| ☐ | Patricia Denisse | | |
| ☐ | Diego | | |
| ☐ | Nancy | | |
| ☐ | | | |

## Paso 4 · Reenviar las respuestas al correo de cPanel

| ✓ | Dónde | Qué hacer |
|---|---|---|
| ☐ | security.microsoft.com → Directivas y reglas → Directivas contra amenazas → Directivas contra correo no deseado → **Directiva de filtro de correo no deseado de salida (predeterminada)** | Reglas de reenvío automático: **Activado: el reenvío está habilitado**. Viene bloqueado hacia fuera |
| ☐ | admin.microsoft.com → Usuarios activos → cada reclutador → **Correo** → Reenvío de correo | Su dirección de cPanel y activar **Mantener una copia de los correos reenviados** |

## Paso 5 · Teams · admin.teams.microsoft.com

Hacerlo temprano: los cambios tardan algunas horas en aplicarse. No se registra nada aparte para Teams: el sistema crea el evento con "reunión de Teams" y Microsoft pone el enlace.

| ✓ | Menú | Opción | Valor |
|---|---|---|---|
| ☐ | Reuniones → Directivas de reunión → **Global (predeterminada)** | Los usuarios anónimos pueden unirse a una reunión | **Activado** |
| ☐ | Misma directiva | Quién puede omitir la sala de espera | **Todos** (si no, el reclutador admite al candidato y al bot) |
| ☐ | Misma directiva | Transcripción | **Activado** |
| ☐ | Reuniones → **Configuración de reuniones** | Los usuarios anónimos pueden unirse a una reunión | **Activado** |

## Paso 6 · Registrar la app · portal.azure.com → Microsoft Entra ID → Registros de aplicaciones

No hace falta suscripción de pago de Azure.

**6.1 Nuevo registro**

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre | `Prime HR Reclutamiento` |
| ☐ | Tipos de cuenta admitidos | **Solo cuentas de este directorio organizativo** (un solo inquilino) |
| ☐ | URI de redirección · plataforma **Web** | `https://app.primehrinnovation.com.mx/api/integrations/microsoft/callback` |
| ☐ | Registrar | — |
| ☐ | Menú **Autenticación** → Agregar URI (Web) | `http://localhost:3000/api/integrations/microsoft/callback` |
| ☐ | En Autenticación, lo demás | Sin cambios: sin URL de cierre de sesión, sin casillas de tokens. Las URI exactas, sin `/` al final |

**6.2 Permisos** · Menú **Permisos de API** → Agregar un permiso → **Microsoft Graph** → **Permisos delegados**

| ✓ | Permiso | Para qué |
|---|---|---|
| ☐ | `openid` | Iniciar sesión |
| ☐ | `email` | Saber qué cuenta conectó cada reclutador |
| ☐ | `offline_access` | Que la conexión no caduque cada hora |
| ☐ | `User.Read` | Leer el nombre del reclutador (suele venir ya agregado) |
| ☐ | `Calendars.ReadWrite` | Crear, mover y cancelar la entrevista con enlace de Teams |
| ☐ | `OnlineMeetings.ReadWrite` | Activar la grabación y transcripción automáticas de cada entrevista (24 nov) |
| ☐ | `OnlineMeetingTranscript.Read.All` | Leer la transcripción de Teams y ponerla en la ficha del candidato (24 nov: reemplaza a Fireflies) |
| ☐ | **Conceder consentimiento de administrador para Prime** → Sí | Todos con **palomita verde**. Sin esto a cada reclutador le sale "Se necesita aprobación del administrador" |

**6.3 Secreto y datos** · Menú **Certificados y secretos** → **Nuevo secreto de cliente**

| ✓ | Qué | Ojo |
|---|---|---|
| ☐ | Descripción `Sistema reclutamiento`, expira **24 meses** | — |
| ☐ | Copiar el **Valor** | **No** el "Id. de secreto". Solo se ve una vez; si se pierde, se crea otro |
| ☐ | Anotar la **fecha de vencimiento** | Ese día Outlook deja de funcionar para todos; recordatorio un mes antes |
| ☐ | Menú **Información general** → copiar **Id. de directorio (inquilino)** | — |
| ☐ | Menú **Información general** → copiar **Id. de aplicación (cliente)** | — |

**6.4 Correo al reclutador cuando agenda (27 nov)** · Permisos de API → Agregar un permiso → Microsoft Graph → **Permisos delegados**

| ✓ | Qué | Para qué |
|---|---|---|
| ☐ | `Mail.Send` (delegado) | Que al agendar le llegue a quien agendó la confirmación, desde su propio Outlook |
| ☐ | **Conceder consentimiento de administrador** otra vez | Con palomita verde |
| ☐ | Nosotros: `OUTLOOK_MAIL_SEND=1` en Vercel y redesplegar | Antes del consentimiento no se prende: pedir el permiso sin él rompería la conexión de todos |

## Paso 6b · Reportes automáticos desde `reportes@` (27 nov)

Los reportes a clientes (diario y semanal con PDF) y el resumen interno salen de un **buzón compartido**, no del Outlook de una persona. Un buzón compartido **no lleva licencia** (gratis hasta 50 GB). La app manda con permiso **de aplicación**, pero **restringido solo a ese buzón**: no puede mandar como nadie más.

**6b.1 Crear el buzón** · admin.microsoft.com → **Equipos y grupos → Buzones compartidos → Agregar un buzón compartido**

| ✓ | Campo | Valor |
|---|---|---|
| ☐ | Nombre | `Prime HR · Reportes` (es lo que verá el cliente como remitente) |
| ☐ | Correo | `reportes@primehrinnovation.com.mx` |
| ☐ | Miembros (opcional) | Quien de Prime quiera ver en **Enviados** la copia de cada reporte |

Esperar unos minutos a que el buzón quede listo.

**6b.2 Dar el permiso solo sobre ese buzón** · PowerShell de Exchange Online (RBAC for Applications). **No** agregar `Mail.Send` *de aplicación* en Entra ID: eso daría permiso sobre **todos** los buzones. Aquí se da solo sobre `reportes@`.

Se necesitan dos datos de Entra ID → **Aplicaciones empresariales** → `Prime HR Reclutamiento`: el **Id. de aplicación** (el mismo client id del paso 6.3) y el **Id. de objeto** de esa pantalla (el de *Aplicaciones empresariales*, no el de *Registros de aplicaciones*).

```powershell
Install-Module ExchangeOnlineManagement   # solo la primera vez
Connect-ExchangeOnline                     # con la cuenta de admin

$appId    = "<Id. de aplicación (cliente)>"
$objectId = "<Id. de objeto en Aplicaciones empresariales>"

New-ServicePrincipal -AppId $appId -ObjectId $objectId -DisplayName "Prime HR Reclutamiento"
New-ManagementScope -Name "Solo reportes" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'reportes@primehrinnovation.com.mx'"
New-ManagementRoleAssignment -App $appId -Role "Application Mail.Send" -CustomResourceScope "Solo reportes"

# Comprobar: reportes@ debe decir InScope = True; cualquier otro buzón, False.
Test-ServicePrincipalAuthorization -Identity $appId -Resource reportes@primehrinnovation.com.mx
Test-ServicePrincipalAuthorization -Identity $appId -Resource sistemas@primehrinnovation.com.mx
```

El permiso puede tardar hasta 1 hora en aplicarse.

**6b.3 Nosotros, en Vercel** (Production) y redesplegar:

| Variable | Valor |
|---|---|
| `REPORTS_MAILBOX` | `reportes@primehrinnovation.com.mx` |
| `MICROSOFT_TENANT_ID` | El **Id. de directorio (inquilino)** del paso 6.3. Con `organizations` no funciona el permiso de aplicación |

**6b.4 Probar:** en la app, **Configuración → Integraciones → Correos automáticos (Outlook) → "Mandarme un correo de prueba"**. Si dice que no tiene permiso, falta el paso 6b.2 o todavía no se aplica.

## Paso 7 · Fireflies · fireflies.ai

| ✓ | Qué | Valor |
|---|---|---|
| ☐ | Sign up → **Sign in with Microsoft** | Con `entrevistas@primehrinnovation.onmicrosoft.com`; aceptar el acceso al calendario. Si pide aprobación de administrador, la da `sistemas@` |
| ☐ | Settings → Auto-join | **Todas las reuniones** (esa cuenta solo recibe entrevistas) |
| ☐ | Idioma de transcripción | **Español** |
| ☐ | Plan | **Gratis** para la prueba |

Preguntar a Fireflies antes de pagar (respuestas por escrito):

| ✓ | Pregunta | Respuesta |
|---|---|---|
| ☐ | ¿Qué plan incluye API y webhooks? | |
| ☐ | ¿Una cuenta graba varias reuniones de Teams al mismo tiempo? ¿En qué plan? | |
| ☐ | ¿Cuántas horas de grabación y almacenamiento por plan? | |
| ☐ | Precio con un solo usuario | |

## Paso 8 · Datos que nos manda sistemas

Por gestor de contraseñas compartido o dictados en la llamada. **No** por WhatsApp ni correo.

| ✓ | Dato | Paso | Variable |
|---|---|---|---|
| ☐ | Id. de directorio (inquilino) | 6.3 | `MICROSOFT_TENANT_ID` |
| ☐ | Id. de aplicación (cliente) | 6.3 | `MICROSOFT_CLIENT_ID` |
| ☐ | Valor del secreto | 6.3 | `MICROSOFT_CLIENT_SECRET` |
| ☐ | Fecha de vencimiento del secreto | 6.3 | Recordatorio en `tasks.md` |
| ☐ | Lista de cuentas de reclutador creadas | 3 | Para avisarle a cada uno |
| ☐ | Contraseñas de `sistemas@` y `entrevistas@` | 1 y 2 | **Se quedan con Prime** |

---

## Paso 9 · Nosotros, después de la reunión

| ✓ | Qué |
|---|---|
| ☐ | Commit y despliegue del cambio de `src/lib/integrations/microsoft-graph.ts` (`FIREFLIES_INVITEE`) |
| ☐ | Vercel → Settings → Environment Variables: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| ☐ | `ENCRYPTION_KEY` generada con `openssl rand -base64 32` (si cambia, todos reconectan Outlook) |
| ☐ | `FIREFLIES_INVITEE` = `entrevistas@primehrinnovation.onmicrosoft.com` |
| ☐ | Volver a desplegar |

**Prueba** (un reclutador conectado y un candidato con un correo nuestro):

| ✓ | Qué | Debe pasar |
|---|---|---|
| ☐ | Conectar Outlook en Mi cuenta con la cuenta onmicrosoft | "Outlook conectado" |
| ☐ | Agendar desde la ficha | Evento en su calendario con enlace de Teams |
| ☐ | Correo del candidato | Llega la invitación desde la cuenta onmicrosoft; revisar spam |
| ☐ | Entrar desde el navegador sin cuenta | Entra directo |
| ☐ | Esperar al bot | Entra Fireflies; la transcripción aparece en Fireflies |
| ☐ | Responder la invitación | Llega al buzón onmicrosoft y se reenvía a cPanel |
| ☐ | Reagendar y cancelar | El candidato recibe la actualización y la cancelación |
| ☐ | Dos reclutadores a la misma hora | ¿Fireflies entra a las dos? (en plan gratis puede fallar por el límite) |

## Paso 10 · Cada reclutador, una sola vez (cuando le avisemos)

| ✓ | Qué |
|---|---|
| ☐ | Entrar a outlook.office.com con su cuenta onmicrosoft y la contraseña temporal; cambiarla |
| ☐ | app.primehrinnovation.com.mx con su usuario de siempre → **Mi cuenta** → **Conectar Outlook** |
| ☐ | En la ventana de Microsoft: su cuenta `@primehrinnovation.onmicrosoft.com` ("Usar otra cuenta" si sale otra). El correo de cPanel **no** funciona aquí |

| Dónde | Con qué cuenta |
|---|---|
| App de Prime | La de siempre |
| Teams, Outlook web y Conectar Outlook | `nombre@primehrinnovation.onmicrosoft.com` |
| Correo de todos los días | Su correo de cPanel |
