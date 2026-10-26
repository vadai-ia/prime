# Próxima sesión · Prime HR Innovation

Escrito el 26 de octubre de 2026. **Léelo primero.** Después: `pendientes_revision.md` (qué probar: §11 a §14 son lo más reciente), `tasks.md` (hecho, falta y qué pedir a Prime), `plan.md` §12.12 y §12.13 (detalle de lo del 26 oct), `requerimientos_estado.md` (cruce con la lista de requerimientos del 11 sep), `datos_errores.md` (lo que Prime tiene que corregir) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario. El último commit es `a0d7e20 cv masivo`; todo lo del 26 oct está sin commitear.

## Lo primero: terminar la carga de datos de Prime

Pendientes que dejó el usuario el 26 oct, en este orden:

1. **Subir los usuarios.** Los crea el usuario desde Configuración → Crear usuario; no tocarlos por SQL.
2. **Subir las vacantes.** El usuario pasa un JSON (hoja "Vacantes activas por clientes": cliente, puesto, posiciones, unidad, zona, reclutadores). Armar una query: un `insert ... select ... where not exists` por vacante, buscando el cliente por nombre (`lower(name)`), estado `active`, `openings` = 1 cuando diga "Por requisición del cliente". Si el cliente viene vacío (celda combinada en Excel), tomar el de la fila de arriba. Sin Grupo Huerta ni Chela Chupas (no está en clientes). Probarla antes en PGlite (ver abajo).
3. **Asignar reclutadores.** Con `select full_name, email, role, is_active from public.users where role in ('admin','recruiter')` armar inserts en `job_profile_assignments` por correo. El RPC `set_profile_recruiters` rechaza desde el SQL Editor porque no hay sesión de admin; el insert directo dispara los triggers de historial y round robin. La query tiene que listar antes qué nombre o vacante no encontró. En las vacantes los reclutadores vienen por nombre de pila: MAURICIO, GABRIELA, DENISSE (Patricia Denisse Rodríguez), DIEGO (Diego Bernabé), EDUARDO, NANCY.
4. Pausar o cerrar las vacantes de prueba de Telasist (Ejecutivo de Cobranza, con Mariana, Jorge y Luis) cuando entren las reales.

**Cómo se entregan las queries:** el usuario pega en el SQL Editor de Supabase. Copiar desde la terminal partió líneas y una tabla temporal falló (el editor corre los pasos por separado). Lo que funcionó: escribir el `.sql` en el scratchpad, una instrucción completa por fila, probarlo dos veces con `boot()` de `scripts/rls-lite/harness.mjs` y darle la ruta para abrirlo en VS Code. **El usuario pidió que no leamos el Excel** (`excel/`); pasa los datos en JSON. Preguntar antes de hacer.

## Hecho el 26 oct (sin probar en la app)

- **Edad del CV y edición completa de la vacante** (plan §12.12, `pendientes_revision.md` §12). Migración 0026, archivo 13 aplicado.
- **Razón social y nombre comercial del cliente** (migración 0027, `14_razon_social_cliente.sql` aplicado, 2 ok). Base hospedada con 01 a 14.
- **Clientes cargados por SQL:** BURGUER BAR JOINT, SCORPION, ORANGE, DEL FRUTO, GRAFICOS LA CENTRAL, PRIME HR, MC2 ARQUITECTOS y BIG DATA, más TELASIST (el de prueba, id `a0000000-…0001`, con los datos de prueba borrados). Diegol Inc (prueba del usuario) se queda. PRIME HR se cargó con el portal apagado; se le dio al usuario la query para prenderlo (no confirmó si la corrió).
- **`datos_errores.md`** (nuevo), para mandárselo a Prime: correos no válidos, razones sociales dudosas, datos faltantes, Chela Chupas sin cliente, "por requisición", vacantes que no coinciden entre hojas, reclutadores del cliente distintos a los de la vacante y hojas del Excel sin contestar.
- **Contraseñas** (plan §2.2): el login fallido responde según el rol del correo. Si no existe, lo dice; reclutador o cliente: "Pide a un administrador…"; admin: botón "Olvidé mi contraseña" con correo de Supabase; desactivado: lo dice. Para que funcione el enlace falta agregar `/auth/callback` en Redirect URLs de Supabase.
- **Configuración rediseñada** (plan §12.13, `pendientes_revision.md` §14): pestañas; Crear usuario en modal (ya corregido el bug del aviso que mostraba otra contraseña); tabla con color por rol, leyenda que filtra y buscador; ficha **Ver** de reclutadores y clientes con datos, restablecer contraseña, cambio de rol (nunca a otro admin ni a uno mismo), vacantes asignadas y acceso.
- **Verificado:** `typecheck`, `eslint src scripts`, `test:domain`, `db:rls-lite` (casos L y M) y `next build`.

**Pendiente de decisión del usuario:** `excel/` no está en `.gitignore` y trae correos y teléfonos. Volver a preguntar antes de que commitee.

## Después de la carga, en orden (`tasks.md` §8)

1. **Teams, Outlook y Fireflies.**
   - Antes: aviso al cancelar una entrevista con el Outlook desconectado, e invitar a la cuenta maestra (entrevistas@) en lugar de `fred@fireflies.ai` (dirección configurable).
   - El usuario pone `ENCRYPTION_KEY` (`openssl rand -base64 32`) y las tres `MICROSOFT_*` en `.env` (el archivo es `.env`). Hace falta una cuenta de trabajo de Microsoft 365.
   - Recorrido: conectar, agendar, Teams, bot, reagendar, cancelar, desconectar y refresco del token.
2. Probar la carga masiva de CV (§11).
3. Calibrar la IA: alerta "Sin fechas de inicio y fin" en `cv-score.ts`, subir `PROMPT_VERSION` y recalificar (antes 100 / 44 / 14).
4. `psych_parse` (faltan PDF de Psicotest), webhook de Fireflies e `interview_analysis`, correos (Resend o Graph), Whaapy, weekly insights y cron en Vercel.

**Chicos, sin dependencias:**
- "Olvidé mi contraseña" en el portal del cliente.
- Pantalla para editar los datos del candidato (hoy se hace por SQL).
- Importar el Excel histórico de candidatos cuando llegue.

## Contexto que sigue vigente

- **Calibración (24 oct, plan §12.11):** vacante de prueba Ejecutivo de Cobranza con 6 criterios y umbral 65. Ajustes anotados: alerta de CV sin fechas, pregunta "¿Qué CRM has usado?" y sueldo máximo como bloqueo. Los dos últimos ya se corrigen a mano desde Evaluación IA.
- **Los prompts viven en el código** (`src/lib/ai/prompts/`): para cambiar uno se edita, se sube `PROMPT_VERSION` y se despliega.
- **Bloqueado por Prime:** admin de Microsoft 365 y cuenta entrevistas@, Fireflies con API, número de WhatsApp y Meta, horarios de entrevista, texto de consentimiento, aviso de privacidad definitivo, PDF de Psicotest y contratos con clientes.
