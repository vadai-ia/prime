# Próxima sesión · Prime HR Innovation

Escrito el 26 de octubre de 2026. **Léelo primero.** Después: `pendientes_revision.md` (qué probar: §11 a §14 son lo más reciente), `tasks.md` (hecho, falta y qué pedir a Prime), `plan.md` §12.12 y §12.13 (detalle de lo del 26 oct), `requerimientos_estado.md` (cruce con la lista de requerimientos del 11 sep), `datos_errores.md` (lo que Prime tiene que corregir) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario.

## Actualización del 27 oct (léela antes que lo de abajo)

- **App en Vercel con dominio** (`app.primehrinnovation.com.mx`). Archivo manual 15 aplicado: la base hospedada va del 01 al 15.
- **Nuevo, sin desplegar ni probar: el reclutador ve toda su vacante** (plan §12.16, migración 0029). Sin reclutador por candidato ni round robin. Archivo 16 **aplicado el 27 oct** (5 ok; base hospedada 01 a 16); falta desplegar y probar `pendientes_revision.md` §17. `CLAUDE.md` ya tiene la regla nueva.
- También del 27 oct: botón **Cargar CVs** en la vacante, enlace a vacante y cliente en la ficha, "Sin vacante" en levantamientos huérfanos, aviso claro en la carga masiva cuando la persona ya existía (se conservan sus datos; el usuario decidió dejarlo así), texto de Prompts corregido (la IA lee el descriptivo, no el levantamiento).
- **Limpieza hecha por SQL:** vacante "PRUEBA Ejecutivo de cobranza" (Telasist) y su levantamiento borrados; los 3 candidatos de prueba (Mariana, Jorge, Luis) borrados con su rastro; el usuario vació el bucket `cvs` (incluida `uploads`). Falta saber si algún candidato real quedó con el CV roto (consulta en la conversación del 27 oct: `cv_file_path` sin objeto en `storage.objects`).
- El usuario creó "PRUEBA Ejecutivo de cobranza y atención a banca" para probar la carga masiva (probada: la IA lee bien la edad).

## Lo primero: pendientes del usuario

1. ~~**Asignar reclutadores a sus vacantes**~~ **Hecho el 27 oct** (el usuario asignó a todos) (lo hace el usuario en Configuración → Usuarios → Ver → Elegir vacantes; la columna "Vacantes" de la tabla marca en ámbar a quien no tiene ninguna). Eduardo ya está. Faltan:
   - **Gabriela (12):** TELASIST las 2 · SCORPION los 4 operadores · ORANGE Operador de impresión, Chofer de reparto y Auxiliar admin de ventas · DEL FRUTO Chofer de reparto · PRIME HR Chofer mensajero · BIG DATA Técnico especialista electromecánico.
   - **Nancy (5):** ORANGE Operador de impresión, Diseñador industrial y CNC · MC2 Arquitectos y Residente de obras.
   - **Diego Bernabé (3):** TELASIST las 2 · DEL FRUTO Chofer de camioneta.
   - **Patricia Denisse (3):** TELASIST las 2 · BIG DATA Técnico especialista. Si no tiene usuario todavía (no venía su correo), esperan.
   - **Mauricio (2):** TELASIST las 2.
   - Revisar que Eduardo también tenga las 2 de Telasist.
2. **Mandar `datos_errores.md` a Prime.** Incluye la tabla de las 11 vacantes de Grupo Huerta para que digan de qué empresa es cada una.
3. ~~**Supabase → Authentication → URL Configuration → Redirect URLs:**~~ **Hecho el 27 oct.** agregar `http://localhost:3000/auth/callback` y `https://app.primehrinnovation.com.mx/auth/callback`. Sin eso no funciona "Olvidé mi contraseña".
4. **Pandapé: que Prime pida la API del ATS** a su Customer Success (Client ID y Secret, sandbox, Swagger de la versión que lee postulantes con CV y portal de origen, webhook, límites, costo). `api.hcm.pandape.com` **no sirve**: es Pandapé HCM (antes HolmesHR), solo checadas. La exportación del menú trae vacantes, no candidatos. Pandapé multipublica a Indeed, OCC y Computrabajo, así que con su API se cubre casi toda la entrada (~4,500 postulantes al mes). Sin API: leer candidatos@ con Graph. Detalle en `requerimientos_estado.md` §8.
5. Pausar "PRUEBA Ejecutivo de cobranza" (Telasist) cuando ya no se use. Llenar descriptivo y evaluación de IA de cada vacante.

**Cómo se entregan las queries:** el usuario pega en el SQL Editor de Supabase. Escribir el `.sql` en el scratchpad, una instrucción completa por fila (`insert ... select ... where not exists`), probarlo dos veces con `boot()` de `scripts/rls-lite/harness.mjs` y darle la ruta para abrirlo con `! code "<ruta>"`. Leer el Excel (`excel/`, en `.gitignore`) solo si el usuario lo pide. Preguntar antes de cargar datos. Los usuarios los crea él desde Configuración.

## Hecho el 26 oct (sin probar en la app)

- **Edad del CV y edición completa de la vacante** (plan §12.12). Migración 0026, archivo 13 aplicado.
- **Razón social y nombre comercial del cliente** (migración 0027, archivo 14 aplicado). Base hospedada con 01 a 14.
- **Carga de datos por SQL, aplicada:** clientes BURGUER BAR JOINT, SCORPION, ORANGE, DEL FRUTO, GRAFICOS LA CENTRAL, PRIME HR (portal activo), MC2 ARQUITECTOS, BIG DATA y TELASIST (limpio); **Grupo Huerta como 3 clientes** ("GRUPO HUERTA - SHIZUOKA MOTORS", "- ESMERALDA MOTORCYCLE", "- DIVOL TRUCK & BUSES"). **22 vacantes** activas. Faltan las 11 de Grupo Huerta (esperan a Prime) y Chela Chupas (no está en clientes). Diegol Inc (prueba del usuario) se queda.
- **Usuarios:** los creó el usuario.
- **Contraseñas** (plan §2.2): login fallido responde según el rol; admin con "Olvidé mi contraseña".
- **Configuración rediseñada** (plan §12.13, `pendientes_revision.md` §14): pestañas, Crear usuario en modal, tabla con color por rol, filtro y buscador, columna **Vacantes**, ficha Ver con datos, contraseña, rol, Elegir vacantes y acceso.
- **Dominio confirmado:** `app.primehrinnovation.com.mx`. Pandapé y buzón `candidatos@primehrinnovation.com.mx` con acceso (credenciales por canal seguro, nunca al repo).
- **Verificado:** `typecheck`, `eslint`, `test:domain`, `db:rls-lite` y `next build` (la columna Vacantes solo typecheck y eslint).

## Para producción (estimado del 26 oct)

Fase 1 en 2 a 3 semanas: despliegue en Vercel con el dominio, Outlook y Teams, entrada automática de candidatos (candidatos@ o Pandapé, más los canales Indeed, OCC y Computrabajo en el catálogo), correos, calibrar la IA y psicométricos. Fase 2 en 2 a 4 semanas más: Fireflies, WhatsApp y weekly insights. Lo que más bloquea: el admin de Microsoft 365 de Prime. Lo legal (aviso de privacidad y consentimiento) bloquea recibir candidatos reales.

**Pendiente de respuesta del usuario:** ¿agregar Indeed, OCC y Computrabajo al enum `source_channel`? (migración chica con su archivo manual).

## Después, en orden (`tasks.md` §8)

1. **Teams, Outlook y Fireflies.** Antes: aviso al cancelar una entrevista con el Outlook desconectado, e invitar a la cuenta maestra (entrevistas@) en lugar de `fred@fireflies.ai`. El usuario pone `ENCRYPTION_KEY` y las tres `MICROSOFT_*` en `.env`.
2. Probar la carga masiva de CV (§11).
3. Calibrar la IA: alerta "Sin fechas de inicio y fin" en `cv-score.ts`, subir `PROMPT_VERSION` y recalificar.
4. `psych_parse`, webhook de Fireflies e `interview_analysis`, correos (Resend o Graph), Whaapy, weekly insights y cron en Vercel.

**Chicos:** "Olvidé mi contraseña" en el portal del cliente; importar el Excel histórico cuando llegue. (Editar los datos del candidato: hecho el 27 oct, plan §12.15; falta pegar el archivo 15.)

## Contexto que sigue vigente

- **Los prompts viven en el código** (`src/lib/ai/prompts/`): se edita, se sube `PROMPT_VERSION` y se despliega.
- **Bloqueado por Prime:** admin de Microsoft 365 y cuenta entrevistas@, Fireflies con API, número de WhatsApp y Meta, horarios de entrevista, texto de consentimiento, aviso de privacidad definitivo, PDF de Psicotest, contratos con clientes y las respuestas de `datos_errores.md`.
