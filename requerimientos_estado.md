# Requerimientos del cliente · estado al 26 de octubre de 2026

Cruce de la lista "Requerimientos del lado del cliente para la configuración" (VADAI → Prime, 11 sep 2026; contrato VAD-CTR-2026-CYT01, propuesta VAD-COT-2026-PRM01) contra lo que el sistema hace hoy. Las notas a mano del documento original van en *cursiva*. Detalle técnico en `tasks.md` y `plan.md`.

**Claves**

| | Significa |
|---|---|
| ✅ | Hecho en el sistema, o ya entregado |
| 🟡 | Pendiente nuestro (VADAI), sin depender de nadie |
| 🟠 | Pendiente de Prime o de un tercero (dato, cuenta, archivo o decisión) |
| 🔵 | Cambió respecto al documento original: hay que corregirlo antes de reenviarlo |
| ⛔ | Fuera del alcance contratado (se cotiza aparte) |
| ❓ | Duda abierta |
| ❌ | No aplica |

## Resumen

- **Lo que más bloquea:** el admin de Microsoft 365 (Teams, Outlook y Fireflies), el correo remitente con su DNS (reportes), la exportación de clientes, vacantes y candidatos, los PDF de Psicotest y los horarios de entrevista.
- **Lo que el documento promete y no existe todavía:** importar el Excel de clientes y vacantes, generar reglas a partir del D.P. en Word, agendar la entrevista desde WhatsApp, configurar qué ve cada cliente, hora de envío por cliente, hoja de confirmación generada, expediente en ZIP, borrado por retención, etapas y motivos de descarte editables, alertas de Inceval, Cibain y Ciesman.
- **A corregir en el documento:** §6 (ya no es Meet ni Zoom, es Teams), §5 (Fireflies), §7 (SearchLook en lugar de BlackTrust), §3 (plantillas ya enviadas a Meta), §10 (nombres de las etapas y "editables").
- **Riesgo legal:** §14, *"Solo contamos con propuesta comercial"* con los clientes; y el aviso de privacidad tiene que estar antes de prender el agente de WhatsApp.

---

## 1. Responsables y accesos generales

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Responsable del proyecto y suplente | Por confirmar nombre, correo y WhatsApp. |
| 🟠 | Usuarios del sistema (Excel con rol y vacantes) | Lista recibida el 26 oct: 3 administradores y 7 reclutadores (uno es "Posible ingreso 2"). Faltan correcciones antes de crear accesos (ver abajo y `datos_errores.md`). El sistema ya está listo (✅): un admin crea la cuenta desde Configuración → Crear usuario, restablece contraseñas y cambia el rol de reclutadores y clientes en **Ver**, y asigna vacantes en Perfiles → Reclutadores. El correo de Xavier viene bien en la hoja "Subdominio del sistema"; "Edwin" aparece como admin en las hojas Correo y Buzón pero no está en la lista. |

**Lista de usuarios recibida (26 oct).** Los correos completos están en la lista de Prime; aquí solo va lo que falta corregir.

| No. | Nombre | Rol | Vacantes | Qué falta |
|---|---|---|---|---|
| 1 | Blanca Delia Delgado Salazar | Administrador | — | Listo |
| 2 | Yohualli Xavier Rebolledo Cornejo | Administrador | — | Al correo le falta la "@" (¿xrebolledo@…?) |
| 3 | Ulises Morales Irala | Administrador | — | Listo |
| 4 | Eduardo Perea Arce | Reclutador | 10 | Falta el cliente de cada vacante |
| 5 | Gabriela Flores Reynoso | Reclutador | 6 | Falta el cliente de cada vacante |
| 6 | Mauricio Sánchez Méndez | Reclutador | 3 | Falta el cliente de cada vacante |
| 7 | Patricia Denisse Rodríguez Carrillo | Reclutador | 8 | **Falta el correo** (solo dice el dominio). "Técnico Electromecánico" aparece dos veces: ¿son dos clientes distintos? |
| 8 | Nancy Morales | Reclutador | 9 | Falta el cliente de cada vacante |
| 9 | Diego Bernabé | Reclutador | 4 | Falta el cliente de cada vacante |
| 10 | Posible ingreso 2 | Reclutador | — | Falta nombre y correo; se da de alta cuando entre |

Lo que hay que pedir sobre la lista:

1. **El cliente de cada vacante.** En el sistema cada vacante pertenece a un cliente, y la lista solo trae el puesto. "Ejecutivo de Ventas" la tienen 5 reclutadores y "Ejecutivo de Retención" 5: ¿es la misma vacante de un cliente, repartida entre ellos, o son vacantes de clientes distintos? Si es la misma, los candidatos se reparten por turno entre esos reclutadores (round robin).
2. **Qué significa "GH"** en "Ejecutivo de Ventas - GH": ¿es un cliente?
3. **Vacantes internas de Prime** ("Reclutamiento Interno", "Analista de IMSS Interno"): se da de alta a Prime como cliente para cargarlas.
4. **Nombres a unificar:** "Gerente de Unidad" aparece con doble espacio; "Monterey" (Monterrey), "Auxliar contable", "Cita de Servicos". Confirmar si "Auxiliar contable" y "Auxiliar de Contabilidad" son el mismo puesto.
5. **Los ~30 correos que llegaron antes:** con esta lista solo 9 personas usan el sistema. Los demás no necesitan acceso, salvo que Prime diga otra cosa.
| 🟠 | Canal de trabajo | Por confirmar. |
| 🟠 | Firma del contrato y primer pago (50 %) | Por confirmar. |

## 2. Identidad, dominio y correo

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Logotipo e identidad | ✅ Colores de marca aplicados el 24 oct (tema claro y oscuro). 🟠 El Excel del 26 oct trae el logo como imagen pegada; falta el archivo en SVG o PNG: el login y el menú usan una "P" provisional. |
| 🟠 | Subdominio del sistema y acceso al DNS | Decidido el 26 oct: `app.primehrinnovation.com.mx`. Falta el acceso al DNS para apuntarlo a Vercel. |
| 🟠 | Correo remitente de reportes y registros SPF, DKIM y DMARC | *Subdominio… / proveedor de correo.* Remitente decidido el 26 oct: `recursoshumanos@primehrinnovation.com.mx`. ❓ Falta decidir: Resend (pide los registros DNS) o un buzón de Prime en Microsoft 365 con Graph (sin DNS, pero pide un permiso de aplicación al admin de M365). 🟡 Nuestro: la capa de envío y los tres correos (§12). |
| ⛔ | Buzón de entrada de candidatos (candidatos@) | Buzón confirmado el 26 oct: `candidatos@primehrinnovation.com.mx`. Fase 2. El sistema no lee correos todavía; hoy la entrada es carga individual o masiva de CV (✅). |
| 🟠 | Aviso de privacidad para candidatos | El 26 oct mandaron un borrador publicado en una página de prueba (`chatgpt.site`) y piden ver un machote; el definitivo tiene que vivir en el dominio de Prime y lo revisa su abogado. Tiene que cubrir WhatsApp, evaluación automatizada, grabación y transcripción, psicométricos (datos sensibles), antecedentes y envío a clientes. **Necesario antes de prender el agente de WhatsApp.** VADAI puede proponer un borrador. |

## 3. WhatsApp Business API y Meta (Whaapy)

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Meta Business Manager | Por confirmar si ya existe con acceso para VADAI. |
| 🟠 | Verificación de la empresa en Meta | Por confirmar. Sin ella el número queda limitado en volumen. |
| 🟠 | Página de Facebook vinculada | Por confirmar. |
| 🟠 | Número telefónico dedicado | Falta el número definitivo. Si cambia, las plantillas se vuelven a mandar a Meta. |
| 🟠 | Nombre para mostrar | Por confirmar. |
| 🟠 | Perfil del negocio | Por confirmar. |
| 🟠 | Método de pago para conversaciones | Por confirmar. |
| 🟠 | Cuenta en Whaapy | *Roberto.* Falta el correo del administrador. |
| 🔵 | Plantillas de mensaje | ✅ Las seis se mandaron a revisión de Meta el 19 oct (primer contacto, confirmación de entrevista, psicométrico, recordatorio, documentos, cierre cortés). Corregir el documento: confirmar que Prime vio los textos. |
| 🟠 | Consentimiento (opt-in) en cada vacante | *Reclutamiento / Legal.* Falta el texto aprobado. 🟡 Nuestro: el campo "Texto de la vacante" ya se edita desde el sistema (26 oct), se le puede agregar el pie. |
| 🟡 | Agente "Vale" (prefiltro por WhatsApp) | Todo el flujo está por programar: entrada por webhook, prefiltro con IA, psicométrico y documentos por WhatsApp. Depende de Meta y Whaapy. |

## 4. Clientes y perfiles de puesto (carga inicial)

| | Requerimiento | Estado |
|---|---|---|
| 🟡 | Lista de clientes | *Erick.* Recibida el 26 oct y cargada por SQL: 9 clientes con razón social y nombre comercial (migración 0027). Grupo Huerta queda para después. Correcciones pedidas en `datos_errores.md`. 🟡 La importación desde Excel en la app sigue pendiente. |
| 🟠 🟡 | Vacantes activas por cliente | *Erick · ACTUALIZAR.* Recibida el 26 oct (hoja "Vacantes activas por clientes"); se carga por SQL junto con la asignación de reclutadores. No coincide con las vacantes de la hoja de usuarios (ver `datos_errores.md` §3). ✅ El levantamiento y la edición de vacantes por pasos ya existen. 🟡 Falta la importación desde Excel. |
| 🟠 🟡 | Descriptivos de puesto (D.P. en Word) | *PASAR LOS NUEVOS.* ✅ Con el descriptivo capturado, "Generar con IA" propone pesos, umbral, reglas, preguntas y mínimos. 🟡 Hoy la IA lee lo capturado en el levantamiento, no el Word: falta "subir el D.P. y que Claude llene el levantamiento" (mejor en PDF, que Claude lee directo). |
| 🟠 | Levantamientos existentes (Excel) | Falta el archivo. |
| ✅ | Ajustes a las reglas propuestas, todo editable | Desde el 26 oct se editan a mano pesos, umbral, reglas y preguntas del prefiltro, mínimos psicométricos y si el sueldo bloquea o solo avisa. Cada cambio queda en Logs técnicos. |

## 5. Fireflies (grabación y transcripción)

| | Requerimiento | Estado |
|---|---|---|
| 🔵 🟠 | Cuenta de Fireflies | *Dirección · Cotizar.* Ver "Fireflies con 30 usuarios" abajo: se propone **una sola cuenta maestra** (entrevistas@), no una por persona. Falta confirmar qué plan trae API y webhook. |
| 🟠 | Clave de API | Falta. Se usa cuando la app baje la transcripción sola; para la primera prueba no hace falta. |
| 🔵 | Idioma y reglas de grabación | Español sí. La regla "solo reuniones con 'Entrevista' en el título" ya la cumple el sistema: los eventos se llaman "Entrevista · puesto · candidato" o "Entrevista con la empresa · …". |
| 🔵 | Conexión con el calendario | Ya no es Google ni Zoom: es el Outlook de la cuenta maestra (o de cada reclutador). Ver abajo. |
| 🟠 | Consentimiento de grabación | *Legal / Reclutamiento.* Falta el texto. 🟡 Nuestro: agregarlo a la invitación del evento. |
| 🟡 | Webhook y análisis de la entrevista con IA | Por programar, después de la prueba con Teams. Falta el guion de entrevista Prime (§10). |

**Fireflies con 30 usuarios: cuenta maestra, no una por persona.** Un asiento Business por persona serían unos 570 USD al mes (30 × 19 USD), y la mayoría de esos correos no entrevista. Lo que se propone:

1. Un solo usuario de Fireflies con un buzón de Prime dedicado, por ejemplo **entrevistas@primehrinnovation.com.mx**. Tiene que ser una cuenta de Microsoft 365 con licencia (no un buzón compartido), porque Fireflies se conecta a su calendario de Outlook.
2. En Fireflies, esa cuenta se configura para entrar sola a las reuniones a las que la invitan y transcribir en español.
3. El sistema invita a **entrevistas@** a cada entrevista (hoy invita a `fred@fireflies.ai`; es un cambio chico). Fireflies ve la invitación en ese calendario, manda al bot a la reunión de Teams y todas las transcripciones quedan en una sola cuenta, con una sola API key y un solo webhook.
4. Los reclutadores no necesitan cuenta de Fireflies. Solo conectan su Outlook en el sistema (Mi cuenta → Conectar Outlook), y solo los que agendan entrevistas.

Hay que confirmarlo en la prueba: que el bot entre a una reunión organizada por otra persona cuando invitan a la cuenta maestra, y qué plan incluye API y webhook. La alternativa sin Fireflies es la transcripción nativa de Teams.

Con la lista de usuarios del 26 oct son 7 reclutadores: un asiento por persona serían unos 133 USD al mes (7 × 19 USD) contra unos 19 USD de la cuenta maestra, más la licencia de Microsoft 365 del correo dedicado (unos 7 USD).

**Qué pedirle a Prime (concreto):**

- 🟠 Que el **administrador de Microsoft 365** cree un usuario nuevo, solo para entrevistas: **entrevistas@primehrinnovation.com.mx**, con licencia **Business Basic** o superior (con buzón de Exchange y Teams).
  - **No** usar la cuenta del administrador global: controla todo el correo de Prime y no debe conectarse a servicios externos.
  - **No** usar el correo de un reclutador: Fireflies entraría a todas sus juntas, y si la persona se va se pierden la conexión y las transcripciones.
  - **No** un buzón compartido: no puede iniciar sesión en Fireflies.
- 🟠 Con ese mismo usuario, abrir la cuenta de **Fireflies** con "Iniciar sesión con Microsoft", para que conecte su calendario de Outlook. El correo de Fireflies y el del calendario deben ser el mismo.
- 🟠 Contratar en esa cuenta el plan de Fireflies que incluya **API y webhook** (VADAI confirma cuál antes de pagar).
- 🟠 Configurar en Fireflies: **español**, entrar a **todas las reuniones del calendario** (solo recibe entrevistas) y, como seguro, solo las que lleven **"Entrevista"** en el título.
- 🟠 Mandar la **API key** por un canal seguro.
- Los reclutadores **no** necesitan cuenta de Fireflies; solo conectan su Outlook en el sistema (Mi cuenta → Conectar Outlook).
- Este usuario no tiene que ver con el registro de la app en Entra ID (§6), que es otro trámite del mismo administrador.

## 6. Videollamadas: Teams con Outlook (antes "Google Workspace o Zoom")

🔵 **Toda la sección cambió.** El 19 oct se decidió Teams con Outlook (Prime ya usa Microsoft 365); Meet y Zoom quedaron fuera.

| | Requerimiento | Estado |
|---|---|---|
| ✅ | Decisión de la herramienta | Teams con Outlook (19 oct). Cada reclutador conecta su Outlook (20 oct). |
| 🟠 | Admin de Microsoft 365 | Falta. Registrar la app en Entra ID, permisos `Calendars.ReadWrite`, consentimiento de administrador, sala de espera de Teams, y mandar tenant, client id y secreto (`tasks.md` §6). **Es lo que más bloquea.** |
| ✅ | Programación del lado del sistema | Conectar y desconectar Outlook en Mi cuenta; crear, mover y cancelar el evento con Teams; invitar al candidato y a Fireflies. Escrito el 20 oct, sin probar. |
| 🟡 | Prueba completa | Cuando lleguen las llaves (o con una cuenta de Microsoft 365 de prueba). |
| 🟡 | Aviso al cancelar con Outlook desconectado | Pendiente chico antes de la prueba. |
| 🟠 🟡 | Horarios de entrevista para agendar desde WhatsApp | *Erick.* 🟠 Faltan las ventanas por reclutador y la duración estándar. 🟡 El agendado por el candidato desde WhatsApp no existe todavía: hoy el reclutador agenda en la ficha. |

## 7. Psicotest y verificación de antecedentes

### Psicotest

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Cuenta y créditos | Por confirmar (la cuenta ya existe). |
| ✅ | Cómo llegan los reportes | Psicotest no tiene API. El reclutador pega el enlace de la evaluación y sube el PDF en la ficha. |
| 🟠 | Reportes de ejemplo (3 a 5 PDF) | Faltan. Sin ellos no se calibra la lectura automática. |
| ✅ 🟡 | Mínimos por competencia | ✅ La IA propone mínimos por escala y uno bloqueante; desde el 26 oct se editan a mano. 🟡 Faltan la lectura del PDF con IA (`psych_parse`) y las alertas de Inceval, Cibain y Ciesman. |
| 🟠 | Consentimiento para datos sensibles | *Legal.* Falta el formato. 🟡 Se integra al flujo de WhatsApp antes del enlace. |

### Verificación de antecedentes

🔵 *INFORMAR QUE SE USARÁ SEARCHLOOK* en lugar de BlackTrust. Sigue fuera del alcance como integración: el reporte entra al expediente como un documento más.

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Cuenta de SearchLook | Por confirmar. |
| 🟠 | Estudios por tipo de puesto y etapa | Falta. |
| 🟠 | Carta de autorización | Falta el formato. Se agrega al catálogo de documentos del expediente. |
| 🟠 | Cómo llegan los reportes y uno de ejemplo | Falta. |
| ⛔ | Solicitar el estudio desde el sistema | Se cotiza aparte si lo quieren. |

## 8. Bolsas de trabajo y canales de origen

| | Requerimiento | Estado |
|---|---|---|
| ✅ | Canal de origen de cada postulante | Se captura en el alta individual y en la carga masiva (Pandape, Facebook, LinkedIn, Bolsa Prime, Referido, Otro). |
| 🟡 | Pandape (reenvío al buzón candidatos@) | 26 oct: Prime ya dio acceso a Pandape y el buzón `candidatos@primehrinnovation.com.mx` (las credenciales van por canal seguro, nunca al repo). Falta revisar en Pandape qué ofrece: correo por postulante con CV adjunto, exportación a Excel o CSV, o alguna integración. Con eso se decide la entrada: leer candidatos@ (con Graph, la misma app de Microsoft) o importar el Excel de Pandape. |
| 🟠 | Facebook y LinkedIn | Falta describir cómo llegan hoy. Conectar Lead Ads sería trabajo nuevo. |
| ❌ | Bolsa propia de Prime | *N/A.* |
| 🟡 | Otros canales y volumen por canal | Recibido el 26 oct (últimos 30 días): Indeed 2,851, OCC 2,336, Computrabajo 1,223, Facebook 851 a 1,300 y LinkedIn 2 a 13 postulados. 🟡 Falta agregar Indeed, OCC y Computrabajo al catálogo de canales (`source_channel`, migración). Con ~7,000 postulados al mes, la carga a mano no alcanza: hace falta una entrada automática (buzón o importación). |
| 🟠 | Texto estándar de publicación | Falta aprobarlo. ✅ El texto de la vacante ya se edita en la vacante (paso 8). |

## 9. Contactos de clientes para reportes y portal

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Contactos por cliente | *Erick.* Falta. ✅ El cliente ya tiene contacto, y el portal con usuario y Vo.Bo. de contratación existe. 🟡 Falta la hora de envío por cliente (va con los correos). |
| 🟠 | Autorización de los clientes | Falta. |
| 🟠 🟡 | Qué ve cada cliente | 🟠 Falta la decisión. 🟡 Hoy es fijo: el cliente ve a sus candidatos desde la etapa Psicométrico. Hacerlo configurable por cliente es trabajo nuevo. |

## 10. Formatos y proceso

| | Requerimiento | Estado |
|---|---|---|
| ✅ 🟠 | Formato de levantamiento | ✅ El levantamiento por pasos (secciones I a VII) ya está en el sistema. 🟠 Falta el Excel actual para cotejar las variantes. |
| ✅ 🟠 | Formato de descriptivo de puesto | ✅ Competencias funcionales y de liderazgo con nivel (26 oct). 🟠 Falta el Word con el catálogo de niveles (Esencial, Avanzado, Experto). |
| 🟠 | Guion de entrevista Prime | *Erick.* Falta. Lo necesita el análisis de entrevistas. |
| 🔵 🟡 | Etapas y motivos de descarte | *Proceso · REALIZARLO.* Las etapas del sistema son Nuevo, Prefiltro, CV, Entrevista Prime, Psicométrico, Expediente, Entrevista cliente y Contratado (más Descartado). El documento dice que "quedan editables": **hoy no lo son**, son listas fijas en la base. Decidir si se programa o se corrige el documento. 🟠 Falta la lista de motivos de descarte de Prime. |

## 11. Expediente del candidato

| | Requerimiento | Estado |
|---|---|---|
| ✅ 🟠 | Lista de documentos | ✅ El catálogo de documentos y la captura del expediente existen. 🟠 Falta confirmar la lista y cuáles son obligatorios por cliente. |
| 🟠 🟡 | Hoja de confirmación | 🟠 Falta el formato actual. 🟡 Hoy la ficha registra si está generada y firmada, pero no la genera. |
| 🟠 🟡 | Política de retención | 🟠 Falta el plazo (Legal / Dirección). 🟡 La columna existe; falta el proceso que borra o anonimiza al vencer. |
| 🟡 | Entrega al cliente | *Se manda por correo en carpeta zip.* El ZIP del expediente no existe todavía. |

## 12. Reportes y comunicaciones

| | Requerimiento | Estado |
|---|---|---|
| ✅ 🟡 🟠 | Resumen diario interno | ✅ Plantilla y vista previa. 🟡 Falta enviarlo (propuesta: 18:00). 🟠 Faltan los destinatarios. |
| ✅ 🟡 🟠 | Correo diario a clientes | ✅ Plantilla con el criterio "ya pasaron entrevista Prime" (desde Psicométrico). 🟡 Falta enviarlo. 🟠 Faltan hora y copias. |
| ✅ 🟡 🟠 | Reporte semanal a clientes | ✅ Plantilla y vista previa. 🟡 Faltan el envío (propuesta: viernes 9:00) y el PDF. 🟠 Faltan los reportes que mandan hoy. |
| 🟠 | Firma y tono | Falta. |
| 🟡 🟠 | Inteligencia interna | *Xavy / Uli.* 🟡 Faltan los insights semanales con IA. 🟠 Falta quién lo recibe. |

## 13. Base de datos histórica

⛔ Fuera del alcance: se evalúa y se cotiza con la exportación en mano.

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Dónde vive hoy la información | *Carpetas individuales.* No hay base central: subirá el costo de limpieza. |
| 🟠 | Exportación de candidatos | *ERICK · agregar nuevas columnas: identificar cuál falta · contratados y nuevos candidatos.* Falta el archivo. |
| 🟠 | Exportación de clientes y vacantes | Falta. |
| 🟠 | Documentos históricos | *Erick que pida el expediente de los contratados.* Falta. |
| 🟠 | Contrataciones y permanencia (12 meses) | *Dani recepción y reclutadores.* Falta. ✅ El seguimiento de permanencia a 30, 90 y 180 días ya existe para los contratados nuevos. |
| 🟠 | Qué se migra y qué no | *Contadora Blanca.* Falta la decisión. |

## 14. Seguridad y cumplimiento

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Consentimientos de candidatos | *Legal.* Falta. Antes de prender el agente. |
| 🟠 ⚠️ | Contratos con clientes | *Solo contamos con propuesta comercial.* **Riesgo:** sin contrato que lo permita, compartir datos de candidatos por portal y correo expone a Prime. Resolverlo antes de abrir el portal a Telasist. |
| ✅ 🟠 | Accesos y bajas | *Blanca / Xavy.* ✅ Solo un admin da altas y bajas; al desactivar a alguien sus candidatos se reparten solos. 🟠 Falta confirmar quién autoriza. |
| ✅ 🟠 | Respaldos y continuidad | ✅ Supabase Pro con respaldo diario. 🟠 *Xavy / Uli:* falta el correo para avisos. |
| ✅ | Seguridad del sistema (ya hecho, no lo pedía el documento) | Permisos en la base: cada reclutador solo ve sus vacantes y sus candidatos; exportar, inactivos y lista negra solo admin; archivos privados; registro de quién abre CV, documentos y psicométricos, y de cada exportación y edición de vacante. |

## 15. Capacitación y salida a productivo

| | Requerimiento | Estado |
|---|---|---|
| 🟠 | Participantes | *Interno: hacer lista.* Falta. |
| 🟠 | Vacante piloto de Telasist | Falta la vacante real. ✅ La prueba interna con Ejecutivo de Cobranza (Telasist) ya corrió: evaluación con IA y 3 CV calificados. |
| 🟠 | Criterio de salida a productivo | Por confirmar: el sistema disponible con Telasist operando. |

---

## Pendientes nuestros que salen de este cruce

Sin dependencia externa, en el orden propuesto:

1. Prueba de Teams, Outlook y Fireflies, con el cambio a cuenta maestra de Fireflies (entrevistas@).
2. Correos automáticos con su capa de envío (proveedor por decidir) y el PDF semanal.
3. Importar desde Excel clientes, vacantes y candidatos.
4. Subir el D.P. (PDF o Word) y que Claude llene el levantamiento.
5. Hoja de confirmación generada y expediente en ZIP para el cliente.
6. Qué ve cada cliente en el portal, configurable.
7. Retención: borrar o anonimizar al vencer el plazo.
8. Decidir si las etapas y los motivos de descarte se vuelven editables o se corrige el documento.
9. Agendar la entrevista desde WhatsApp con los horarios del reclutador (va con el agente "Vale").
