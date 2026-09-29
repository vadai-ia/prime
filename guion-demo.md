# Guion de la demo · Prime HR

Escrito el 29 de septiembre de 2026. Duración: 25 a 30 minutos. Todo corre con datos reales de Telasist en la base hospedada (`MOCK_DATA` vacío).

---

## 1. Antes de la junta

- **Probar en navegador lo que nunca se ha probado:** portal del cliente y Vo.Bo. (pasos 15 y 16 del recorrido), arrastre del kanban y "Cancelar contratación". Si algo falla, que sea hoy.
- **Tres sesiones abiertas a la vez** (cuentas en `cuentas.md`):
  - Navegador normal: **admin**.
  - Ventana de incógnito: **reclutador**.
  - Otro navegador: **cliente**.
- **Datos preparados:**
  - Dos o tres candidatos en etapas distintas.
  - Uno a medio camino, para avanzarlo en vivo.
  - Dos candidatos en **entrevista con cliente**: uno para "Dar Vo.Bo." y otro para "No continuar".
- **La campana empieza vacía.** La única notificación que genera el sistema hoy es la decisión del cliente, así que se llena durante la demo (ver paso 8).

---

## 2. Qué mostrar, en orden

### 1. Tablero (admin) · 3 min

**Qué enseñar:** las 6 tarjetas, la tendencia de 8 semanas, "Requiere tu atención", las vacantes activas con cubiertas x de y, la agenda de hoy, los indicadores de 90 días y la carga por reclutador. Enseña también el filtro por reclutador.

> "Esto es lo que ves al llegar en la mañana: qué está atorado, qué entrevistas hay hoy y cómo va cada reclutador."

### 2. Cliente y vacante · 3 min

**Qué enseñar:** la ficha de Telasist, una vacante, el levantamiento con el aviso de datos faltantes (sueldo, horario, zona, edad, experiencia, escolaridad) y la tarjeta Publicación, que muestra de qué canal llegó cada postulante.

Después entra a **Reclutadores** dentro de la vacante.

> "Solo un admin crea vacantes y decide qué reclutadores trabajan cada una. Todo cambio queda registrado."

### 3. Alta de un candidato en vivo · 2 min

**Qué enseñar:** captura un candidato con su CV.

> "No elegí reclutador: el sistema lo asigna por turno entre los reclutadores de la vacante. Si un reclutador se va, sus candidatos se reparten solos."

### 4. Ficha del candidato · 5 min

Es el corazón del producto. Recorre las pestañas:

- **CV** y datos del candidato.
- **Entrevista:** agendar, reagendar, confirmar, no se presentó, realizada con notas.
- **Psicométrico:** enlace, PDF y veredicto.
- **Expediente:** subir, ver, validar y rechazar documentos.
- **Historial** de la persona por teléfono, con postulaciones anteriores.

> "Hoy esto se captura a mano. Cuando conectemos la IA, el calendario y WhatsApp, se llena solo en esta misma pantalla, sin pantallas nuevas."

### 5. Kanban · 1 min

**Qué enseñar:** arrastra un candidato a la siguiente etapa y regrésalo.

### 6. Vista del reclutador · 3 min

Es el momento más fuerte de la demo. En la ventana del reclutador:

- Solo ve las vacantes que le asignaron y sus propios candidatos.
- No ve los candidatos de otro reclutador, aunque sea la misma vacante.
- No puede exportar ni ver la lista negra o a los candidatos inactivos.

> "Esto no está escondido en la pantalla: lo hace cumplir la base de datos. Aunque alguien intente sacar la información por otro lado, la base no se la entrega."

### 7. Portal del cliente · 4 min

En la ventana del cliente:

- Las tarjetas por vacante: cubiertas, en proceso, listos para ti y entrevistas agendadas.
- El sello LFPDPPP.
- La lista de candidatos. El cliente los ve a partir del psicométrico, no antes.
- El reporte semanal.

> "El cliente ve el avance sin llamarles ni pedir Excel."

### 8. Vo.Bo. y notificación · 3 min

1. **Reclutador:** mueve a un candidato a entrevista con cliente, o usa uno de los que ya preparaste.
2. **Cliente:** abre al candidato. En la tarjeta "Tu decisión" escribe un comentario y da clic en **Dar Vo.Bo.**
3. **Reclutador:** recarga la página. La campana marca 1. Al abrir la notificación ("Telasist dio Vo.Bo. a …") te lleva a la ficha, ya en **Contratado**.
4. **Admin:** recarga. Le llegó el mismo aviso.
5. Opcional: repite con el segundo candidato y **No continuar**. Queda descartado con el motivo "rechazado por el cliente".

> "La decisión del cliente queda registrada con fecha, persona y comentario. Solo avisa al reclutador de ese candidato y a los admins."

Las notificaciones no llegan en tiempo real: hay que recargar la página. Si la demo se enreda, en el kanban está "Cancelar contratación" para regresar al candidato.

### 9. Reportes · 2 min

**Qué enseñar:** Reportes → **Vista previa de correos**. Son los tres correos (resumen interno diario, envío diario al cliente y semanal) armados con datos reales. Enseña también la gráfica de semanas: volumen contra resultado.

> "Estos correos ya están armados. Falta conectar el servicio de envío para que salgan solos."

---

## 3. Qué hace falta

Preséntalo en tres grupos, para que se entienda que lo pendiente depende sobre todo de accesos y archivos de Prime.

### A. Construido, falta conectar la integración

Hoy se captura a mano en la misma pantalla donde después entra la integración.

| Integración | Qué va a hacer | Qué necesitamos |
| --- | --- | --- |
| **IA (Claude)** | Generar el perfil y la evaluación desde el levantamiento, calificar el CV, leer el PDF de Psicotest, analizar la entrevista, redactar el texto para Pandape, Facebook y LinkedIn | Cuenta de Anthropic |
| **Google Calendar y Meet** | Crear la reunión al agendar, moverla y cancelarla | Google Workspace y quién crea el proyecto en Google Cloud |
| **Fireflies** | Transcribir la entrevista para que la IA la analice | Cuenta de la empresa y su API key |
| **WhatsApp (Whaapy)** | Conversación con Vale, prefiltro, envío del psicométrico con recordatorio, documentos por WhatsApp | Número nuevo y aprobación de Meta para los templates (tarda días) |
| **Correo (Resend)** | Que los tres correos salgan solos | Dominio |

> "La IA lee y sugiere; la decisión la toma el equipo. Ningún candidato se descarta solo por la IA. La edad y el sexo salen como alerta, no como filtro."

### B. Lo construimos nosotros, sin depender de nadie

- Lista negra (solo admin), con aviso al dar de alta a alguien que está en ella.
- Exportar a Excel (solo admin, cada exportación queda registrada).
- Carga masiva de CVs.
- Detección de personas duplicadas.
- PDF del reporte semanal e interno.
- Reporte semanal completo en la pantalla del portal.
- Más notificaciones: candidato asignado, entrevista agendada, documento subido. Hoy solo avisa la decisión del cliente.
- Ajustes para usarlo desde el celular.
- Cola de tareas automáticas, que es la base de todas las integraciones.

### C. Lo que necesitamos de Prime

Sal de la junta con un responsable y una fecha para cada punto.

**Accesos**

- [ ] De quién será la cuenta de Anthropic.
- [ ] ¿Usan Google Workspace? ¿Quién crea el proyecto de Google Cloud?
- [ ] Cuenta y API key de Fireflies.
- [ ] Número de WhatsApp nuevo.
- [ ] Dominio, para publicar el sistema y enviar correos.

**Archivos de muestra**

- [ ] Excel histórico de clientes, vacantes y candidatos. Es lo que llena Inteligencia interna con historia.
- [ ] Excel de levantamiento y formato D.P.
- [ ] Dos o tres CVs reales y tres o cuatro PDFs de Psicotest.
- [ ] Guion de entrevista.
- [ ] Formato de la hoja de confirmación.
- [ ] Muestras de Black Trust y del socioeconómico.

**Decisiones**

- [ ] Texto del aviso de privacidad y cuánto tiempo se guardan los datos de los descartados.
- [ ] Quién captura la permanencia a 30, 90 y 180 días: el reclutador o el cliente.
- [ ] Después de cuánto tiempo un candidato pasa a inactivo.
- [ ] Confirmar tres reglas que ya dejamos así:
  - Solo los reclutadores reciben candidatos por turno; un admin no.
  - Al quitar a un reclutador, sus candidatos se reparten solos.
  - El reclutador no ve quién más trabaja su vacante.

---

## 4. Preguntas probables

- **"¿Y la inteligencia con historia que venía en la propuesta?"** Se llena cuando importemos su Excel histórico. Por eso lo necesitamos pronto.
- **"¿El cliente puede ver candidatos antes del psicométrico?"** Hoy no. Si lo quieren, es un cambio de regla, no de pantallas.
- **"¿Un reclutador puede asignarse candidatos?"** No. Solo un admin asigna o reasigna; si el reclutador captura a alguien a mano, ese candidato es suyo.
- **"¿Cuándo sale la IA?"** En cuanto tengamos la cuenta de Anthropic. Es lo primero de la lista.
