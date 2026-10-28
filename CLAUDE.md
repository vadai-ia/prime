@AGENTS.md

# Prime HR · reglas del proyecto

`plan.md` (raíz) es la fuente de verdad; `tasks.md` detalla servicios, llaves y tareas. Si una decisión cambia, se actualiza `plan.md` en el mismo cambio. Identificadores en inglés `snake_case`, etiquetas de UI en español, fechas `timestamptz`, sin `any`.

## Visibilidad y permisos (plan §2.3, migraciones 0014, 0015 y 0029)

Decididas con Prime el 11 sep 2026; la unidad pasó a ser la vacante el 27 oct 2026 (0029). Todo módulo nuevo las hereda; no son opcionales.

- **El reclutador no ve todo.** Solo lee las vacantes que un admin le asignó (`job_profile_assignments`), los clientes detrás de esas vacantes y **todas** las postulaciones de esas vacantes. Los reclutadores de una misma vacante ven a los mismos candidatos. No hay reclutador por candidato: `applications.assigned_recruiter_id` solo dice quién lo capturó y no decide quién lo ve. Admin ve todo; el cliente no cambia.
- **Se hace cumplir en la base, no en la UI.** La regla vive una vez en SQL: `app.assigned_profile_ids()`, `app.assigned_client_ids()`, `app.can_access_profile()`, `app.can_access_client()`, `app.can_access_application()`, `app.can_access_candidate()`. Una tabla nueva que cuelgue de una vacante, una postulación o un candidato usa esos helpers en sus políticas. Nunca `app.is_staff()` como única condición de lectura sobre datos de candidatos o clientes.
- **RLS desde la primera migración** de cada tabla. Las vistas `security_invoker` heredan; una vista `security definer` filtra explícito con los helpers (ver `v_portal_applications`).
- **Solo un admin cambia asignaciones**: checklist en Perfiles → vacante → Reclutadores (RPC `set_profile_recruiters`) o Configuración → usuario → Ver. El reclutador nunca se asigna solo. Crear vacantes también es de admin. Todo cambio queda en `job_profile_assignment_events`.
- **Sin round robin** (0029): una postulación nueva no se asigna a nadie; la ven todos los reclutadores de su vacante. Quitar a alguien de una vacante o desactivarlo solo le quita la vista; no se reparte nada. Una vacante sin reclutadores solo la ve el admin. Filtros y cargas "por reclutador" (Tablero, Entrevistas) van por las vacantes que trabaja (`listRecruiterProfiles`).
- **Solo admin**: exportar o descargar bases (Excel, PDF), ver candidatos inactivos y ver la lista negra. Se consulta `can(role, permiso)` / `requirePermission` / `assertPermission` (`src/lib/auth/permissions.ts`, `src/lib/dal.ts`) en TypeScript y `app.has_permission()` en SQL; los dos mapas van a la par. Todo flujo de exportación registra `log_audit('export')`, que rechaza a quien no sea admin.
- **Service role** solo en webhooks, cron, jobs, Storage, los tokens de `user_integrations` (`microsoft-graph.ts`), la administración de cuentas en Auth (`src/actions/users.ts`) y el login fallido, que lee solo el rol y si la cuenta está activa (`src/actions/auth.ts`). Con service role no hay RLS: quien lo use para leer candidatos o clientes a nombre de un usuario tiene que filtrar por la misma regla.
- **Lista negra** (0021): la base rechaza cualquier postulación de una persona marcada (`candidate_blacklisted`). Un flujo nuevo que dé de alta candidatos (WhatsApp, carga masiva) pregunta antes `is_blacklisted()` y nunca le muestra el motivo a quien no sea admin.
- Avisos sobre un candidato: `app.notify_application()` (admins y los reclutadores de su vacante). `notify_staff()` es para avisos generales del sistema y solo lo llama el service role.

## Cómo se trabaja aquí

- El SQL se aplica a mano en el SQL Editor del proyecto hospedado: cada migración nueva lleva su copia en `supabase/manual/NN_*.sql`. Sin Docker. El SQL Editor no lleva historial, así que esa copia tiene que ser **re-ejecutable** (`if not exists`, `drop ... if exists` antes de cada `create policy`/`create trigger`, tipos dentro de `do $$ ... exception when duplicate_object`), ir en una transacción y terminar con un checklist de ok/FALTA. `scripts/build-manual.py` las genera desde las migraciones; `scripts/rls-lite/manual-sql.test.mjs` prueba que corren dos veces y sobre una base a medias sin tocar datos.
- Un dato sin el que una pantalla no funciona (catálogos como `document_types`) va en migración, no en `seed.sql`: la base real se arma solo con los archivos manuales.
- `npm run db:rls-lite` prueba las políticas en un Postgres en WASM (PGlite) con las migraciones del repo, sin Docker. Una política nueva lleva su verificación ahí. `db:rls-check` es la misma idea contra Supabase real (necesita el stack local).
- `src/lib/db/types.ts` se regenera con `db:types` (stack local); si no hay, se edita a mano con lo que agregue la migración.
- Archivos (CV, documentos, psicométricos): buckets privados sin políticas. Subir y abrir pasa por `src/lib/uploads.ts`: primero se lee la fila con la sesión del usuario (RLS decide), después se usa service role solo para Storage, y abrir un archivo se registra con `log_audit`.
- **Trabajo en segundo plano va por la cola** (`src/lib/queue/`): un tipo nuevo se registra en `handlers.ts` (payload con zod, `retry: false` si reintentar no sirve) y se encola con `enqueue()`; lo diario va en `recurring.ts`. Nada de `after()` suelto para trabajo que deba reintentarse.
- Mientras una integración no exista, su dato se captura a mano en la misma pantalla (entrevistas, psicométrico, expediente). Al conectar la integración se reutiliza esa acción, no se hace otra pantalla.
- `MOCK_DATA` (`src/lib/mock`) sirve datos de demo; el modo demo no aplica la visibilidad por reclutador.
- Antes de cerrar: `npm run typecheck`, `npx eslint src`, `npm run db:rls-lite`, `npm run build`.
