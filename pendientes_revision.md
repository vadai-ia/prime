# Pendientes de revisión · lo que hay que probar cuando llegue cada llave

Lista viva. Cada función que se programe sin poder probarla agrega aquí su recorrido; al probarla se marca y se anota qué se ajustó. Creado el 20 oct 2026.

---

## 0. Antes de empezar (una vez)

- [ ] Crédito en console.anthropic.com (10 a 20 USD alcanzan para calibrar) y límite de gasto mensual.
- [ ] `ANTHROPIC_API_KEY=` en `.env.local` y reiniciar `npm run dev`.
- [ ] `MOCK_DATA` vacío en `.env.local` (en modo demo los botones no guardan).
- [ ] Entrar como **admin** (o como reclutador asignado a la vacante de prueba).
- [ ] Tener abierto Supabase → SQL Editor con esta consulta, para revisar después de cada paso:

```sql
select kind, status, model, cost_usd, latency_ms, error, created_at
from ai_runs order by created_at desc limit 20;
```

Si la primera llamada falla con error de forma de petición, esquema o `fallbacks`, el problema está en `src/lib/ai/run.ts`, no en el prompt. Copiar el `error` de `ai_runs` y corregir ahí primero.

---

## 1. Generar la evaluación de la vacante (`profile_generation`) · probado el 24 oct, falta ajustar

**Necesita:** API key y la vacante de Telasist con el descriptivo completo (requisitos, actividades, condiciones con sueldo y horario, competencias).

- [x] Vacante → pestaña **Evaluación IA** → **Generar con IA**. Debe tardar de 20 a 60 s y mostrar "Evaluación generada (vN)". *21 oct: 28 s, vacante Full Stack Engineer de prueba.*
- [x] Salen de 4 a 6 criterios del CV, con pesos que suman 100 y una guía por criterio. *24 oct, Ejecutivo de Cobranza: 6 criterios (cobranza 35, negociación 20, Excel/CRM 15, campo 10, escolaridad 10, estabilidad 10), guía completa/parcial en cada uno.*
- [x] Ningún criterio habla de edad, sexo, estado civil ni apariencia. *24 oct.*
- [x] La edad aparece como alerta, nunca como bloqueo (`age_is_blocking = false`). *24 oct. Salió "23 a 43"; el levantamiento de prueba dice 23 a 45: revisar si se capturó así o si la IA lo cambió.*
- [x] El umbral es razonable para el puesto (ni 20 ni 95). *24 oct: 65.*
- [x] Las preguntas del prefiltro (4 a 7) se entienden por WhatsApp y cada una tiene su regla. *24 oct: 7 preguntas. Para §3: "¿Qué CRM has usado?" da por hecho que usó uno (mejor "¿Has usado algún CRM…?"); sueldo máximo $11,000 como bloqueo cuando el puesto paga hasta $15,000 con comisiones (la IA misma lo anotó); no hay regla de residencia aunque el levantamiento pide Aguascalientes o conurbados.*
- [x] La lista de "datos que faltaban" coincide con lo que de verdad no dice el descriptivo. *24 oct: traslado máximo, colonia de la oficina, licencia o vehículo para campo, tiempo de comida; todo cierto.*
- [ ] Regenerar pide confirmar y sube la versión.
- [ ] **Editar pesos y umbral**: no guarda si no suman 100; guarda si suman 100 y sube la versión.
- [x] En `ai_runs`: `kind = profile_generation`, `status` ok, costo entre 0.10 y 0.20 USD. *21 oct: 0.074 USD (904 in / 2,849 out), por debajo de lo estimado.*

**Anotar:** qué criterio sobró o faltó, si los pesos tienen sentido para Prime, qué pregunta suena rara.

---

## 2. Score del CV (`cv_score`) · probado el 24 oct con CV generados, faltan CV reales

**Necesita:** API key, la vacante del paso 1 ya con evaluación, y **2 o 3 CV reales en PDF**: uno bueno, uno regular y uno que no cumpla (sirven escaneados).

- [x] **Agregar candidato** con el CV bueno en esa vacante. Al llegar a la ficha, esperar unos segundos y recargar: aparece el score con evidencia por criterio.
- [x] Repetir con el regular y con el malo. *24 oct, Ejecutivo de Cobranza con CV generados por IA: bueno 100, medio 44, malo 14 (umbral 65).*
- [ ] El bueno queda **arriba** del umbral; el malo **abajo** y cae en "Requiere tu atención" (no se descarta solo). *24 oct: el orden y el umbral salen bien. El medio quedó en 44, no "cerca del umbral": el puntaje es defendible (8 meses de cobranza, Excel básico, sin CRM ni campo). "Requiere tu atención" solo cuenta el CV bajo umbral en la etapa Revisión de CV (`lib/attention.ts`): falta mover medio y malo a esa etapa y verlo en el tablero.*
- [ ] La evidencia es texto que de verdad está en el CV (abrir el PDF y buscarlo).
- [x] Las alertas ("requisito no demostrado", "hueco laboral") tienen sentido. *24 oct: sí, incluido el hueco de 7 meses del medio y los 18 meses del malo. Para §3: un CV sin fechas sale como "CV ilegible o incompleto" en uno y "Fechas inconsistentes" en otro; falta una alerta propia ("Sin fechas de inicio y fin"). La edad (52) y la residencia (León) no salen: el prompt ignora edad y domicilio a propósito; la edad se revisa en el prefiltro.*
- [ ] Con un CV escaneado (imagen), también lo lee.
- [ ] En un candidato existente con CV: **Calificar CV** funciona.
- [ ] Cambiar un peso en la vacante → la ficha avisa que los pesos cambiaron y ofrece **Recalificar**.
- [ ] Como reclutador **no asignado** a la vacante: no puede calificar (RLS).
- [x] En `ai_runs`: `kind = cv_score`, costo cerca de 0.06 USD por CV. *21 oct: 0.057 USD, 19 s. Score 56/75 en un CV real; falta probar con un CV fuerte y uno débil.*

**Comparar con el criterio del reclutador:** pedirle a alguien de Prime que ordene los 3 CV a mano y ver si la IA coincide.

---

## 3. Ajuste de prompts (después de 1 y 2)

- [ ] Anotar cada error de la IA (criterio mal, evidencia inventada, score inflado).
- [ ] Ajustar `src/lib/ai/prompts/profile-generation.ts` y `cv-score.ts` y subir `PROMPT_VERSION`.
- [ ] Volver a correr los mismos CV y comparar con la versión anterior.
- [ ] Si el costo sale muy arriba de lo estimado, revisar `effort` por tarea antes de cambiar de modelo.

---

## 4. Lectura del psicométrico (`psych_parse`) · por programar

**Necesita:** API key y **3 o 4 PDF reales de Psicotest** (de puestos distintos si se puede).

Se llena cuando esté programado. Lo esperado:

- [ ] Subir el PDF en la pestaña Psicométrico → se llenan las escalas solas.
- [ ] Los valores coinciden con el PDF (revisar escala por escala).
- [ ] El veredicto y el % de ajuste contra los mínimos de la vacante son correctos (eso lo calcula el código, no la IA).
- [ ] Un PDF que no es de Psicotest da un error claro, no escalas inventadas.
- [ ] Costo cerca de 0.16 USD por reporte.

---

## 5. Outlook y Teams (cada reclutador conecta el suyo) · programado el 20 oct, sin probar

**Ya se puede probar sin Microsoft (hoy):**

- [x] Pegar `supabase/manual/08_microsoft_teams.sql` en el SQL Editor (20 oct).
- [ ] Las entrevistas viejas ya dicen **Teams** en la ficha y en Entrevistas (ninguna dice Meet ni Zoom). Su enlace no cambió.
- [ ] Agendar una entrevista sin Outlook conectado: pide pegar el enlace de Teams y ofrece ir a Mi cuenta para conectar.
- [ ] Menú → tu nombre abajo → **Mi cuenta**: dice "Sin conectar" y que falta configurar la app de Microsoft.
- [ ] Configuración → Integraciones: aparece "Outlook y Teams" como pendiente (ya no Google).

**Necesita:** que el admin de Microsoft 365 de Prime registre la app (pasos en `tasks.md` §6) y nos pase tenant, client id y secreto. Después:

- [ ] En `.env.local`: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` y `ENCRYPTION_KEY` (`openssl rand -base64 32`). Reiniciar `npm run dev`.
- [ ] Mi cuenta → **Conectar Outlook** → entrar con el correo de Prime → regresa con "Outlook conectado" y el correo de la cuenta.
- [ ] Si sale "Se necesita aprobación del administrador": falta el consentimiento del admin (paso 4 de `tasks.md` §6).
- [ ] Con Outlook conectado, el formulario ya no pide enlace. Agendar → aparece en el Outlook del reclutador con enlace de Teams, y la ficha muestra el enlace.
- [ ] El candidato (con correo) recibe la invitación desde el correo del reclutador. Revisar que el asunto y el texto no muestren nada interno.
- [ ] Entrevista Prime con otro entrevistador: él también recibe la invitación.
- [ ] **Reagendar** → el evento se mueve en Outlook y el candidato recibe la actualización.
- [ ] **Cancelar** → el evento desaparece del calendario y el candidato recibe la cancelación.
- [ ] Reagendar una entrevista cancelada → se crea un evento nuevo con enlace nuevo.
- [ ] Un admin reagenda la entrevista de un reclutador → se mueve en el calendario del reclutador (no en el del admin).
- [ ] Borrar el evento a mano desde Outlook y luego cancelar en la app → se cancela sin error.
- [ ] **Desconectar** en Mi cuenta y agendar → vuelve a pedir el enlace (agenda manual).
- [ ] Esperar más de una hora y agendar otra vez → funciona (el token se refresca solo).
- [ ] Candidato sin correo: la entrevista se crea, pero hoy nadie le manda el enlace (llega con WhatsApp, `interview_confirm`).

**Fireflies** (siempre va invitado):

- [ ] El evento lleva a `fred@fireflies.ai` como invitado.
- [ ] El reclutador que organiza está dado de alta en la cuenta de Fireflies de Prime (si no, el bot no entra).
- [ ] El bot entra a la reunión sin quedarse en la sala de espera.
- [ ] Llega el webhook de Fireflies y aparece la transcripción (por programar).
- [ ] Probar la transcripción nativa de Teams para decidir si se queda Fireflies.

---

## 6. Lista negra · programada el 20 oct; se prueba hoy, sin llaves

- [x] Pegar `supabase/manual/09_lista_negra.sql` en el SQL Editor: 5 "ok" (20 oct).
- [ ] Como **admin**, en la ficha de un candidato de prueba: **Agregar a lista negra** → elegir motivo y nota. Sale el aviso rojo con motivo, quién y cuándo.
- [ ] Sus postulaciones abiertas quedan **Descartadas** con "Descartado por administración"; si tenía una contratación, sigue igual.
- [ ] Con motivo "Otro" y sin nota, no deja guardar.
- [ ] Candidatos → **Lista negra**: aparece con teléfono, correo, motivo y quién lo agregó.
- [ ] Como **reclutador**: no ve el botón "Lista negra" en Candidatos, ni el aviso en la ficha; si abre `/candidatos/lista-negra` lo regresa a su inicio.
- [ ] Como reclutador, **Nuevo candidato** con el teléfono de esa persona → "No se puede registrar a esta persona. Consulta con tu administrador." (sin motivo).
- [ ] Igual con otro teléfono pero el mismo correo.
- [ ] Como admin, el mismo intento dice que está en la lista negra.
- [ ] **Quitar** desde la lista (pide confirmar) o desde la ficha (con nota) → ya se puede registrar otra vez. Sus postulaciones descartadas no se reabren.
- [ ] "Ver también las que se quitaron" muestra el historial con quién la quitó y por qué.

---

## 7. Cola de tareas y cron · programada el 20 oct; se prueba hoy, sin llaves

**Preparar:**

- [ ] Pegar `supabase/manual/10_cola_de_tareas.sql` en el SQL Editor: checklist con 5 "ok". Correrlo dos veces no falla.
- [ ] En `.env.local`: `CRON_SECRET=` con cualquier texto largo. Reiniciar `npm run dev`.

**Probar en local (con `npm run dev` corriendo, en otra terminal):**

- [ ] `npm run queue:tick` → "encoladas 1 · corridas 1 · fallidas 0" la primera vez del día después de las 8:00 (los avisos de permanencia). La segunda vez: "encoladas 0 · corridas 0".
- [ ] Configuración → **Tareas automáticas**: aparece "La cola corre una vez al día…" y los contadores; "Tareas automáticas (cron)" sale como configurada en Integraciones.
- [ ] Un contratado con ingreso de hace más de 30 días: al correr el tick sale el aviso "Seguimiento de 30 días: ¿sigue …?" en la campana del reclutador y del admin, y no se repite.
- [ ] Abrir `/api/cron/tick` en el navegador sin el secreto → "No autorizado".

**Con la API key de Anthropic:**

- [ ] Agregar candidato con CV → la tarea "Score del CV" corre sola en segundos (no hace falta el tick) y la ficha muestra el score.
- [ ] Agregar candidato con CV en una vacante **sin pesos** → la tarea queda **Fallida** sin reintentar, con el error claro, y el admin recibe el aviso en la campana.
- [ ] **Reintentar** desde Configuración (después de poner los pesos) → corre en el siguiente tick.

**En Vercel (cuando se despliegue):**

- [ ] `CRON_SECRET` en las variables del proyecto (plan Hobby: cron diario).
- [ ] En Vercel → Settings → Cron Jobs aparece `/api/cron/tick` diario (0 14 * * *) y sus ejecuciones responden 200.
- [ ] Si Configuración avisa que "el cron no está llegando", revisar el secreto y los logs del cron.

---

## 8. WhatsApp · esperando a Meta

- [ ] Revisar en Whaapy si Meta aprobó los seis templates (enviados el 19 oct 2026).
- [ ] Si rechazó alguno, anotar el motivo y corregir el texto.
- [ ] Cuando Prime dé el número definitivo: volver a enviarlos.

---

## 9. Permanencia, inactivos, exportar, logs y avisos · programado el 21 oct; se prueba ya, sin llaves

**Preparar:**

- [x] Pegar `supabase/manual/11_permanencia_inactivos_avisos.sql` en el SQL Editor: checklist con 5 "ok". *21 oct: aplicado, 5 ok.*
- [ ] Reiniciar `npm run dev` (se instaló `exceljs`: correr `npm install` si se bajó el código en otra máquina).

**Permanencia (como reclutador o admin):**

- [ ] Mover un candidato de prueba a **Contratado** → en su ficha aparece el bloque Permanencia con 30, 90 y 180 días.
- [ ] Candidatos → **Permanencia**: pestañas Por capturar, Próximos 30 días y Capturados.
- [ ] **Capturar** → Sigue con nota → pasa a Capturados con quién y cuándo.
- [ ] **Se fue** sin fecha no deja guardar; con fecha y motivo cierra también los cortes siguientes.
- [ ] Con cortes vencidos, el **Tablero** muestra el aviso "Hay N cortes de permanencia por capturar".
- [ ] Un reclutador solo ve los cortes de sus candidatos.

**Inactivos y exportar (solo admin):**

- [ ] Candidatos → **Inactivos**: salen los descartados sin otra postulación abierta; cambiar el periodo (Todos, 1, 3, 6 meses, 1 año) y buscar por nombre o teléfono.
- [ ] Un reclutador no ve los botones Inactivos ni Exportar, y si abre `/candidatos/inactivos` lo regresa al tablero.
- [ ] **Exportar a Excel** en Candidatos (con y sin filtros), en Inactivos y en Permanencia → baja un `.xlsx` que abre bien en Excel.
- [ ] Como reclutador, abrir `/candidatos/exportar` → "Solo un administrador puede exportar".
- [ ] Cada exportación aparece en Configuración → **Logs técnicos** → Accesos y exportaciones, con el número de filas.

**Logs técnicos (solo admin):**

- [ ] Configuración → **Logs técnicos**: el gasto de IA cuadra con la consulta de `ai_runs` (0.074 + 0.057 USD de las pruebas del 21 oct).
- [ ] Pestañas IA, Tareas automáticas, Webhooks y Accesos; "Solo errores" filtra.
- [ ] El enlace "Candidato" o "Vacante" de cada llamada abre la ficha correcta.

**Avisos (campana):**

- [ ] Como admin, agregar un candidato en una vacante con reclutadores → al reclutador que le toca le llega "Te asignaron a …". Al admin no.
- [ ] Como reclutador, agregarlo uno mismo → no se avisa a sí mismo.
- [ ] Agendar una entrevista → les llega a los admins y al reclutador, menos a quien la agendó.
- [ ] Subir un documento en el Expediente → aviso "Documento recibido".
- [ ] Como reclutador, intentar registrar a alguien de la lista negra → al admin le llega "Intentaron registrar a … (lista negra)" con quién y en qué vacante. Repetirlo en la misma hora no repite el aviso.

**Outlook y celular:**

- [ ] Configuración → usuarios: columna Outlook con "Conectado" y el correo, o "Sin conectar".
- [ ] En el celular (o el navegador angosto): barra verde arriba con el menú, la campana y Cerrar sesión.

---

## 10. Interfaz del 24 oct · se prueba ya, sin llaves

- [ ] **Tema**: el selector (sol, luna, monitor) cambia todo al momento; al recargar se queda. En oscuro, Tablero, Reportes y Configuración también salen oscuras (antes regresaban a claro; se agregó `ThemeSync`).
- [ ] Las gráficas de Reportes y del Tablero se leen en los dos temas (tooltip, ejes, barras).
- [x] **Menú lateral** se pliega y se expande, y lo recuerda al recargar; cuenta, tema y Cerrar sesión debajo de Configuración. *24 oct: funciona.*
- [ ] **Levantamiento por pasos**: elegir cliente llena nombre, ciudad y contacto; cambiar de paso no pierde lo capturado; guardar sin nombre del puesto lleva al paso 2.
- [ ] **Editar vacante** por pasos: guarda los cambios hechos en cualquier paso.
- [ ] **Login** en celular: encabezado negro corto, sin desplazamiento horizontal.
- [ ] Los correos de Reportes → Vista previa salen con la paleta nueva.
- [ ] Configuración → **Prompts de IA**: salen los tres prompts con su versión y el uso de las pruebas del 24 oct.

---

## 11. Carga masiva de CV · programada el 24 oct; se prueba ya (necesita la API key)

**Preparar:**

- [x] Pegar `supabase/manual/12_lectura_de_cv.sql` en el SQL Editor: checklist con 1 "ok". *24 oct: aplicado, ok.*

**Probar:**

- [ ] Candidatos → **Carga masiva**: elegir la vacante y el canal, soltar 3 a 5 PDF (uno escaneado, y uno que no sea CV).
- [ ] Cada fila pasa por Subiendo → Leyendo con IA → Listo, tres a la vez, en unos 10 a 20 s cada una.
- [ ] Nombre, teléfono, correo, municipio y escolaridad salen bien. La edad solo aparece si el CV la dice; si no, vacía (no 15).
- [ ] El que no es CV dice "Este PDF no parece un CV". Una fila sin teléfono no deja darse de alta hasta capturarlo.
- [ ] Un teléfono que ya existe muestra "Ya registrado (N postulaciones)".
- [ ] **Dar de alta**: cada fila queda "Dado de alta · ver ficha"; los candidatos salen en etapa Nuevo, repartidos por turno entre los reclutadores de la vacante, y en unos segundos con su score de CV.
- [ ] Alguien de la lista negra: la fila dice que no se puede registrar (al reclutador sin el motivo) y al admin le llega el aviso.
- [ ] Logs técnicos y Prompts de IA: las lecturas salen como "Lectura de CV" con su costo.

## 12. Edad del CV y edición de la vacante · programado el 26 oct; se prueba ya (la lectura necesita la API key)

**Preparar:**

- [x] Pegar `supabase/manual/13_editar_vacante.sql` en el SQL Editor **antes** de abrir la app con el código nuevo (el score del CV y la edición ya leen `cv_version`): checklist con 3 "ok". *26 oct: aplicado, 3 ok.*
- [ ] Corregir la edad de 15 del candidato de prueba. No hay pantalla para editar los datos del candidato; en el SQL Editor: `update public.candidates set age_reported = null where age_reported < 18;`

**Edad y lectura con Claude:**

- [ ] Candidatos → Agregar candidato → subir un CV: dice "Leyendo…" unos segundos y llena los campos con la etiqueta "del CV".
- [ ] Un CV escaneado (foto en PDF) también se llena.
- [ ] Un CV sin edad deja Edad vacía; con la rueda del mouse o las flechas encima, el campo no cambia.
- [ ] Escribir 15 en Edad y guardar: "La edad debe ser de 18 a 80 años".
- [ ] Un CV que dice "17 años" no llena la edad y avisa que está fuera de 18 a 80.
- [ ] Configuración → Logs técnicos → IA: la lectura sale como "Lectura de CV" con "Leyó nombre, teléfono…; edad N" y, ya dado de alta, "Candidato" con enlace a la ficha.

**Edición de la vacante:**

- [ ] Vacante → Editar: el paso 7 trae competencias funcionales y de liderazgo con su nivel; el paso 8, relaciones, proceso, canales y texto. Guardar y ver todo en el descriptivo.
- [ ] Evaluación IA → Editar reglas: quitar el sueldo máximo o desmarcar "descarta" y ver "Alerta" en la tarjeta.
- [ ] Editar preguntas: cambiar "¿Qué CRM has usado?" por "¿Has usado algún CRM? ¿Cuál?", subir y bajar, quitar una y agregar otra.
- [ ] Editar mínimos: cambiar un mínimo, poner un bloqueante mayor que el mínimo (debe rechazarlo) y uno válido.
- [ ] Después de editar preguntas o reglas, la ficha de Mariana **no** dice "Recalifica"; después de cambiar pesos, sí.
- [ ] Logs técnicos → Accesos y cambios: cada guardado sale como "Editó una vacante" con la sección y la versión.

## 13. Carga de datos de Prime · 26 oct; clientes cargados, faltan usuarios, vacantes y asignaciones

El Excel "Lista de Rol y Vacante" está en `excel/` (en `.gitignore`: trae correos y teléfonos). Leerlo solo cuando el usuario lo pida. Lo que Prime tiene que corregir o contestar está en `datos_errores.md`.

**Hecho:**

- [x] Migración 0027 y `supabase/manual/14_razon_social_cliente.sql`: razón social y nombre comercial del cliente. *26 oct: aplicado, 2 ok.*
- [x] Clientes cargados por SQL el 26 oct: 8 nuevos (BURGUER BAR JOINT, SCORPION, ORANGE, DEL FRUTO, GRAFICOS LA CENTRAL, PRIME HR, MC2 ARQUITECTOS, BIG DATA). Textos en mayúsculas como vienen, "N/A" vacío, ciudad sacada del domicilio y el correo no válido de Big Data vacío. Diegol Inc se queda.
- [x] Telasist: se quedó el de prueba (mismo id) con los datos de la lista: nombre TELASIST y lo demás vacío. Sus vacantes y candidatos de prueba siguen ahí: pausarlos al cargar las reales.
- [x] PRIME HR: portal prendido como los demás. *26 oct.*
- [ ] Alta y edición de cliente muestran Razón social y Nombre comercial; la ficha del cliente los enseña (el nombre comercial solo si es distinto del nombre).

**Decidido:**

- Grupo Huerta: 3 clientes, uno por razón social ("GRUPO HUERTA - SHIZUOKA MOTORS", "- ESMERALDA MOTORCYCLE", "- DIVOL TRUCK & BUSES"), cargados el 26 oct. Sus 11 vacantes esperan a que Prime diga de cuál es cada una (tabla en `datos_errores.md` §2).
- Los usuarios (admins y reclutadores) los crea el usuario desde Configuración; la carga no crea usuarios.

**Falta, en orden:**

- [x] Crear los usuarios (el usuario, desde Configuración → Crear usuario). *26 oct.*
- [x] Vacantes cargadas por SQL el 26 oct: 22, activas, con zona y posiciones ("Por requisición del cliente" de Telasist y Scorpion va con 1), títulos como vienen, sin unidad de negocio y sin evaluación de IA. La de prueba "PRUEBA Ejecutivo de cobranza" (Telasist) sigue activa.
- [ ] **Preguntar a Prime** (va en `datos_errores.md` §2):
  - **Grupo Huerta:** los 3 clientes ya están; falta saber de cuál es cada una de las 11 vacantes.
  - **Chela Chupas (Capitán de meseros, Nancy) no está cargado:** no aparece en la lista de clientes. Faltan sus datos.
- [ ] Llenar el descriptivo y generar la evaluación de IA de cada vacante, para que los CV se califiquen.
- [ ] Pausar o cerrar "PRUEBA Ejecutivo de cobranza" cuando ya no se use.
- [x] Asignar reclutadores: desde Configuración → Usuarios → Ver → Elegir vacantes. *27 oct: el usuario asignó a todos.*
- [ ] **Pandapé: pedir la API del ATS (reclutamiento).** Prime se lo pide a su Customer Success de Pandapé Enterprise: Client ID y Client Secret, sandbox si hay, la documentación (Swagger) de la versión que **lee los postulantes de cada vacante** con contacto, CV y portal de origen, si hay webhook de nuevo postulante, límite de llamadas y si tiene costo extra. **No es `api.hcm.pandape.com`**: esa es Pandapé HCM (antes HolmesHR), solo checadas y horarios. La exportación del menú solo trae vacantes (530 en un año, 53,703 postulantes) y Word, no candidatos. Pandapé multipublica a Indeed, OCC, Computrabajo y LinkedIn: una sola entrada cubre casi todo. Si no hay API: leer candidatos@ con Graph o importar a mano. Detalle en `requerimientos_estado.md` §8.
- [ ] Revisar: cada vacante bajo su cliente con zona y posiciones; cada reclutador ve solo las suyas (Configuración → Ver → Vacantes asignadas).
- [x] `excel/` en `.gitignore`. *26 oct.*

## 14. Contraseñas · programado el 26 oct; se prueba ya, sin llaves (el correo de recuperación usa el envío de Supabase)

**Login con contraseña equivocada:**

- [ ] Correo que no existe: "No hay una cuenta con ese correo."
- [ ] Correo de reclutador: "Contraseña incorrecta. Pide a un administrador que te pase o te reinicie tu contraseña." Sin botón de recuperación.
- [ ] Correo de admin: "Contraseña incorrecta." y el botón **Olvidé mi contraseña**. Al darle, dice que se mandó el enlace; el correo llega (revisar spam), abre `/cuenta/password`, se guarda la nueva y entra.
- [ ] Usuario desactivado: "Tu cuenta está desactivada."
- [x] Redirect URLs en Supabase (local y producción). *27 oct: puestas por el usuario.*
- [ ] Si el correo no llega: en Supabase → Authentication → URL Configuration, `http://localhost:3000/auth/callback` (y la URL de producción) deben estar en Redirect URLs. El envío de Supabase sin SMTP propio manda pocos correos por hora.

**Configuración (rediseño del 26 oct):**

- [ ] Tres pestañas: Usuarios, Integraciones y Tareas automáticas (con el número de fallidas).
- [ ] **Crear usuario** es un botón arriba a la derecha que abre un modal; trae una contraseña temporal ya generada (botón "Otra") y al crear la muestra para copiarla.
- [ ] En la tabla, reclutadores y clientes tienen **Ver**; los admins no (tu fila dice "Tu cuenta").
- [ ] Filas de color por rol (admin azul tenue, reclutador verde, cliente naranja) con franja a la izquierda. Arriba, la leyenda con el número de cada rol: al dar clic filtra y otro clic quita el filtro ("Todos" también). Buscador por nombre o correo.
- [ ] Ver → Datos: editar nombre; correo, empresa (cliente), alta, última vez y Outlook.
- [ ] Ver → Contraseña: explica que no se puede ver (está cifrada); **Restablecer contraseña** pone una temporal y la muestra. El reclutador entra con ella y la cambia en Mi cuenta.
- [ ] Ver → Rol: reclutador ↔ cliente (pide empresa) o reclutador → admin. Al dejar de ser reclutador avisa que sale de sus N vacantes y se reparten sus candidatos; después de pasar a admin ya no tiene botón Ver.
- [ ] Ver → Vacantes asignadas (reclutador activo) con enlace a cada vacante. **Elegir vacantes** abre un checklist de todas las vacantes no cerradas agrupadas por cliente, con buscador; al desmarcar avisa que sus candidatos se reparten. Guardar y ver el cambio también en Perfiles → vacante → Reclutadores.
- [ ] Ver → Acceso: desactivar y activar.

## 15. Periodo en el Tablero · programado el 27 oct; se prueba ya, sin llaves

- [ ] Al entrar, el selector dice "Últimos 30 días" con las fechas al lado y la URL queda limpia (`/tablero`).
- [ ] Cada atajo aplica con un clic, cierra y recalcula: Postulaciones, Entrevistas realizadas y Contratados, con "↑ / ↓ N% vs. los N días previos".
- [ ] Rango propio: clic en el día inicial, la banda sigue al cursor, clic en el final, el pie dice "3 – 15 oct 2026 · 13 días" y **Aplicar** se habilita. Elegir el final antes que el inicial también funciona.
- [ ] Los días futuros salen apagados y "Mes siguiente" se apaga en el mes actual. Hoy lleva un punto.
- [ ] Teclado: flechas, Inicio/Fin de semana, RePág/AvPág de mes, Enter elige, Esc cierra y regresa el foco al botón.
- [ ] Clic fuera o Cancelar cierra sin cambiar nada.
- [ ] Tendencia: por día con 7 o 30 días, por semana con 90, por mes con "Este año"; el tooltip lo dice bien.
- [ ] Indicadores, Conversión y "contratados" de Carga por reclutador cambian con el periodo; En prefiltro, Psicométricos, Expedientes, Requiere tu atención, Estancados, Agenda y Vacantes activas no.
- [ ] Admin: elegir un reclutador conserva el periodo, y cambiar el periodo conserva el reclutador. Los enlaces de Carga por reclutador también conservan el periodo.
- [ ] Como reclutador: el selector aparece, sin el filtro de reclutador, y los números son solo de sus candidatos.
- [ ] Celular: el selector abre como hoja desde abajo con los atajos en fila y un solo mes; sin desplazamiento horizontal.
- [ ] Tema oscuro: banda, día elegido y botones se leen bien.
- [ ] Una URL rota (`?desde=2026-02-30`, fechas al revés o futuras) regresa a los últimos 30 días sin error.

## 17. El reclutador ve toda su vacante · programado el 27 oct; se prueba ya, sin llaves

**Preparar:**

- [x] Pegar `supabase/manual/16_reclutador_ve_su_vacante.sql` en el SQL Editor **antes** de desplegar el código nuevo: checklist con 5 "ok". Correrlo dos veces no falla. *27 oct: aplicado.*

**Probar:**

- [ ] Dos reclutadores en la misma vacante: los dos ven a **todos** sus candidatos (Candidatos, Tablero, ficha, entrevistas, documentos).
- [ ] Un reclutador de otra vacante no los ve ni abre su ficha.
- [ ] La ficha ya no tiene "Reclutador asignado". La pestaña Reclutadores de la vacante ya no habla de repartir.
- [ ] Subir CVs: no se asignan a nadie; a cada reclutador de la vacante le llega "Nuevo candidato: …".
- [ ] Quitar a un reclutador de la vacante: deja de verla; los demás siguen viendo todo.
- [ ] Tablero como admin → filtro por reclutador: muestra lo de sus vacantes. "Carga por reclutador" cuenta por vacante. "Vacantes sin reclutador" muestra lo de las vacantes que nadie trabaja.

## 16. Editar los datos del candidato · programado el 27 oct; se prueba ya, sin llaves

**Preparar:**

- [x] Pegar `supabase/manual/15_editar_candidato.sql` en el SQL Editor **antes** de guardar una edición: checklist con 1 "ok". Correrlo dos veces no falla. *27 oct: aplicado.*

**Probar:**

- [ ] Ficha del candidato → **Editar datos**: abre con todo lo que ya tiene (teléfono como "+52 449 …").
- [ ] Corregir la edad de 15 del candidato de prueba a vacío o a un valor de 18 a 80 y guardar: el modal se cierra y la ficha lo muestra (ya no hace falta el `update` por SQL de §12).
- [ ] Edad 15 o 90: "La edad debe ser de 18 a 80 años". CURP de 17 caracteres, RFC raro o NSS de 10 dígitos: cada uno con su mensaje.
- [ ] CURP y RFC escritos en minúsculas o con espacios se guardan en mayúsculas y juntos.
- [ ] Cambiar el teléfono por el de otro candidato que ya existe: "Ese teléfono ya es de otra persona registrada…".
- [ ] Cambiar el teléfono o el correo por el de alguien en la lista negra: como reclutador, "No se puede usar ese teléfono o correo…" sin motivo; como admin, dice que está en la lista negra; al admin le llega el aviso.
- [ ] Guardar sin cambiar nada cierra el modal y no deja registro.
- [ ] Configuración → Logs técnicos → Accesos y cambios: "Editó datos de un candidato" con enlace a la ficha y los campos que cambiaron (sin los valores).
- [ ] Como reclutador, en un candidato de su vacante: puede editar. Un candidato de una vacante que no trabaja ni siquiera se abre (§17).
- [ ] Si el candidato tiene dos postulaciones, el cambio se ve en las dos fichas.
