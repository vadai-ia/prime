# Próxima sesión · Prime HR Innovation

Escrito el 27 de octubre de 2026. **Léelo primero.** Después: `pendientes_revision.md` (qué probar: §11 a §17 son lo más reciente), `tasks.md` (hecho, falta y qué pedir a Prime), `plan.md` §12.14 a §12.16 (detalle de lo del 27 oct), `requerimientos_estado.md` (cruce con la lista de requerimientos del 11 sep), `datos_errores.md` (lo que Prime tiene que corregir) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario. El 27 oct hizo push de todo (último commit `1027c84 Reclutadores por vacante y no por persona`).

## Estado al cierre del 27 oct

- **App en producción:** Vercel con el dominio `app.primehrinnovation.com.mx`. Base hospedada con los archivos manuales **01 a 17** aplicados (17 el 28 oct); falta el **18**.
- **Regla nueva de visibilidad** (plan §2.3 y §12.16, migración 0029, `CLAUDE.md` actualizado): el reclutador ve a **todos** los candidatos de las vacantes que trabaja. No hay reclutador por candidato ni round robin; quitar a alguien de una vacante solo le quita la vista. Los avisos de un candidato llegan a admins y a todos los reclutadores de su vacante. Lo decidió el usuario; reemplaza lo acordado con Prime el 11 sep (hay que avisarles).
- **Hecho el 27 oct:**
  - Periodo en el Tablero (§12.14) y editar los datos del candidato (§12.15).
  - Botón **Cargar CVs** en la vacante; enlace a la vacante y al cliente en la ficha del candidato.
  - Levantamiento sin vacante dice "Sin vacante" (no "Perfil generado").
  - Carga masiva: si el teléfono ya existe, la fila avisa que se conservan los datos de la ficha y solo se llenan los vacíos. **Decidido dejarlo así** (no reemplazar con el CV nuevo).
  - Configuración → Prompts: "Generar con IA" lee el **descriptivo de la vacante**, no el levantamiento. Las vacantes cargadas por SQL no tienen levantamiento y está bien.
- **Probado por el usuario en producción:** carga masiva con 3 CV (la IA leyó bien la edad). La edad distinta en la ficha era porque esas personas ya existían por teléfono.
- **Limpieza por SQL (aplicada):** vacante "PRUEBA Ejecutivo de cobranza" de Telasist borrada con sus postulaciones; su levantamiento borrado; los 3 candidatos de prueba (Mariana López Herrera, Jorge Ramírez Soto, Luis Fernández Cruz) borrados con su rastro (ai_runs, avisos, tareas). El usuario vació el bucket `cvs`, incluida `uploads`.
- **Vacante de prueba vigente:** "PRUEBA Ejecutivo de cobranza y atención a banca" (cliente "PRUEBA Financiera" si lo creó así). Usar teléfonos nuevos en cada CV de prueba.

## Lo primero: pendientes del usuario

1. **Probar en producción** `pendientes_revision.md` §12, §14, §15, §16 y **§17** (reclutador ve su vacante: dos reclutadores de la misma vacante ven lo mismo; uno de otra vacante no; aviso "Nuevo candidato" al subir un CV; filtro por reclutador del Tablero). En §11 faltan un PDF escaneado y uno que no sea CV.
2. **Revisar CVs huérfanos:** correr la consulta de candidatos con `cv_file_path` sin archivo en `storage.objects` (bucket `cvs`) para saber si al vaciar el bucket se perdió el CV de alguien real. Si sale alguien, volver a subirle el CV o borrarlo si es de prueba.
3. **Llenar descriptivo y Evaluación IA** (Generar con IA) de cada vacante real; sin pesos, la carga masiva no califica.
4. **Mandar `datos_errores.md` a Prime** (incluye Grupo Huerta y Chela Chupas) y que **pidan la API de Pandapé** (detalle en `requerimientos_estado.md` §8; `api.hcm.pandape.com` no sirve).
5. **Avisar a Prime** del cambio de visibilidad (todos los reclutadores de una vacante ven a todos sus candidatos).
6. Vercel: confirmar que el cron diario aparece en Settings → Cron Jobs y que `CRON_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_APP_URL=https://app.primehrinnovation.com.mx` están en las variables.

**Cómo se entregan las queries:** el usuario pega en el SQL Editor de Supabase. Escribir el `.sql` en el scratchpad, re-ejecutable y con checklist o protecciones (se detiene si encuentra más de lo esperado), probarlo dos veces con `boot()` de `scripts/rls-lite/harness.mjs` y darle la ruta completa. Si sale la advertencia de RLS por `supabase_migrations.schema_migrations`, es "Run without RLS" (solo preocupa si nombra una tabla de `public`). Supabase no deja borrar archivos de Storage por SQL: se borran en el panel. Leer el Excel (`excel/`) solo si el usuario lo pide. Preguntar antes de cargar o borrar datos.

## Hecho el 28 oct (sin commit; falta probar, `pendientes_revision.md` §18)

- **Reclutadores al crear la vacante:** checklist en el levantamiento (solo admin), se asignan con `set_profile_recruiters` al dar "Guardar y crear vacante".
- **Subir descriptivo:** PDF o Word .docx → Claude llena los pasos 2 a 7 sin pisar lo capturado (plan §12.17). Migración **0030** y archivo manual **17_lectura_de_descriptivo.sql**: **pegarlo antes de desplegar**. Se agregó la dependencia `mammoth`.
- El usuario confirmó que la carga masiva funciona.
- **Canales Indeed, OCC y Computrabajo** (plan §12.18): migración **0031** y archivo manual **18_canales_bolsas.sql**, ya aplicado por el usuario (3 ok); falta probar §19.
- Archivos manuales 17 y 18 ya aplicados por el usuario. La base va de **01 a 18**.

## Siguiente: código sin dependencias, en este orden

1. ~~Canales~~ (hecho).
2. **Outlook antes de probarlo:** avisar al cancelar una entrevista cuando el Outlook de quien la agendó ya no está conectado; invitar a la cuenta maestra (entrevistas@) en lugar de `fred@fireflies.ai` (variable de entorno).
3. **Calibrar la IA del CV:** alerta "Sin fechas de inicio y fin" en el prompt de `cv_score`, subir `PROMPT_VERSION` y recalificar.
4. **"Olvidé mi contraseña" en el portal del cliente** (hoy solo admins).
5. Textos viejos de reparto: `pendientes_revision.md` §14 (Ver → Rol, Elegir vacantes) y `requerimientos_estado.md` §14 todavía dicen "se reparten sus candidatos"; revisar también los textos de Configuración.

## Después (`tasks.md` §8)

Teams, Outlook y Fireflies (cuando Prime tenga el admin de M365) → `psych_parse` (3 o 4 PDF de Psicotest) → webhook de Fireflies e `interview_analysis` → correos (Resend o Graph) → Whaapy (prefiltro, documentos, `doc_check`) → weekly insights. Importar el Excel histórico cuando llegue.

Ofrecido y **rechazado por ahora** (27 oct): "Banco de talento" (buscador por texto del CV, una fila por persona, postular a otra vacante). Hoy se busca por nombre y se filtra por vacante, cliente, etapa (incluido Descartado) y canal.

## Avance estimado (27 oct): ~65 %

Operación diaria ~95 %, portal ~90 %, tablero ~85 %, IA ~40 % (3 de 7 usos), Outlook/Teams ~60 % sin probar, correos ~20 %, WhatsApp ~5 %, Fireflies y Pandapé 0 %. Lo que más destraba: el admin de Microsoft 365 de Prime.

## Contexto que sigue vigente

- **Los prompts viven en el código** (`src/lib/ai/prompts/`): se edita, se sube `PROMPT_VERSION` y se despliega.
- **El teléfono es la identidad:** un CV o alta con un teléfono existente agrega una postulación a esa persona y solo llena sus datos vacíos.
- **Dos responsables, ahora uno:** reclutadores por vacante (pestaña Reclutadores o Configuración → Ver). `applications.assigned_recruiter_id` solo guarda quién capturó a mano; la acción `assignApplicationRecruiter` y `components/candidate/assigned-recruiter.tsx` quedaron sin pantalla.
- **Bloqueado por Prime:** admin de Microsoft 365 y cuenta entrevistas@, Fireflies con API, número de WhatsApp y Meta, aviso de privacidad y consentimiento, PDF de Psicotest, CV reales, Excel histórico, logotipo, las 11 vacantes de Grupo Huerta, los datos de Chela Chupas y las respuestas de `datos_errores.md`.
