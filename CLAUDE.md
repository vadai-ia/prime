@AGENTS.md

# Prime HR · reglas del proyecto

`plan.md` (raíz) es la fuente de verdad; `tasks.md` detalla servicios, llaves y tareas. Si una decisión cambia, se actualiza `plan.md` en el mismo cambio. Identificadores en inglés `snake_case`, etiquetas de UI en español, fechas `timestamptz`, sin `any`.

## Visibilidad y permisos (plan §2.3, migraciones 0014 y 0015)

Decididas con Prime el 11 sep 2026. Todo módulo nuevo las hereda; no son opcionales.

- **El reclutador no ve todo.** Solo lee las vacantes que un admin le asignó (`job_profile_assignments`), los clientes detrás de esas vacantes y las postulaciones asignadas a él (`applications.assigned_recruiter_id`). Dos reclutadores de la misma vacante no ven los candidatos del otro. Admin ve todo; el cliente no cambia.
- **Se hace cumplir en la base, no en la UI.** La regla vive una vez en SQL: `app.assigned_profile_ids()`, `app.assigned_client_ids()`, `app.can_access_profile()`, `app.can_access_client()`, `app.can_access_application()`, `app.can_access_candidate()`. Una tabla nueva que cuelgue de una vacante, una postulación o un candidato usa esos helpers en sus políticas. Nunca `app.is_staff()` como única condición de lectura sobre datos de candidatos o clientes.
- **RLS desde la primera migración** de cada tabla. Las vistas `security_invoker` heredan; una vista `security definer` filtra explícito con los helpers (ver `v_portal_applications`).
- **Solo un admin cambia asignaciones**: checklist en Perfiles → vacante → Reclutadores (RPC `set_profile_recruiters`) y reasignación de un candidato desde su ficha. El reclutador nunca se asigna solo. Crear vacantes también es de admin. Todo cambio queda en `job_profile_assignment_events`.
- **Round robin**: cada postulación nueva se asigna por turno entre los reclutadores de la vacante (trigger en `applications`); si la captura un reclutador a mano, es suya. Desactivar a un usuario o quitarlo de una vacante reparte sus candidatos en proceso; si no queda nadie, quedan sin asignar y solo los ve el admin. El código de la app no asigna: inserta la postulación y la base decide.
- **Solo admin**: exportar o descargar bases (Excel, PDF), ver candidatos inactivos y ver la lista negra. Se consulta `can(role, permiso)` / `requirePermission` / `assertPermission` (`src/lib/auth/permissions.ts`, `src/lib/dal.ts`) en TypeScript y `app.has_permission()` en SQL; los dos mapas van a la par. Todo flujo de exportación registra `log_audit('export')`, que rechaza a quien no sea admin.
- **Service role** solo en webhooks, cron, jobs y Storage. Con service role no hay RLS: quien lo use para leer candidatos o clientes a nombre de un usuario tiene que filtrar por la misma regla.
- Avisos sobre un candidato: `app.notify_application()` (admins y su reclutador). `notify_staff()` es para avisos generales del sistema y solo lo llama el service role.

## Cómo se trabaja aquí

- El SQL se aplica a mano en el SQL Editor del proyecto hospedado: cada migración nueva lleva su copia en `supabase/manual/NN_*.sql`. Sin Docker. El SQL Editor no lleva historial, así que esa copia tiene que ser **re-ejecutable** (`if not exists`, `drop ... if exists` antes de cada `create policy`/`create trigger`, tipos dentro de `do $$ ... exception when duplicate_object`), ir en una transacción y terminar con un checklist de ok/FALTA. `scripts/build-manual.py` las genera desde las migraciones; `scripts/rls-lite/manual-sql.test.mjs` prueba que corren dos veces y sobre una base a medias sin tocar datos.
- Un dato sin el que una pantalla no funciona (catálogos como `document_types`) va en migración, no en `seed.sql`: la base real se arma solo con los archivos manuales.
- `npm run db:rls-lite` prueba las políticas en un Postgres en WASM (PGlite) con las migraciones del repo, sin Docker. Una política nueva lleva su verificación ahí. `db:rls-check` es la misma idea contra Supabase real (necesita el stack local).
- `src/lib/db/types.ts` se regenera con `db:types` (stack local); si no hay, se edita a mano con lo que agregue la migración.
- Archivos (CV, documentos, psicométricos): buckets privados sin políticas. Subir y abrir pasa por `src/lib/uploads.ts`: primero se lee la fila con la sesión del usuario (RLS decide), después se usa service role solo para Storage, y abrir un archivo se registra con `log_audit`.
- Mientras una integración no exista, su dato se captura a mano en la misma pantalla (entrevistas, psicométrico, expediente). Al conectar la integración se reutiliza esa acción, no se hace otra pantalla.
- `MOCK_DATA` (`src/lib/mock`) sirve datos de demo; el modo demo no aplica la visibilidad por reclutador.
- Antes de cerrar: `npm run typecheck`, `npx eslint src`, `npm run db:rls-lite`, `npm run build`.
