-- 0026 · Edición a mano de la evaluación de la vacante (26 oct 2026)
--
-- Perfiles → vacante → Evaluación IA ya deja editar, además de pesos y umbral, las reglas y las
-- preguntas del prefiltro y los mínimos psicométricos. Cada cambio sube `version`, pero solo los
-- pesos del CV vuelven viejo un score: `cv_version` es la versión en la que cambiaron por última
-- vez, y con ella se compara `applications.cv_score_version` (antes se comparaba con `version`).
--
-- `salary_is_blocking`: el sueldo pedido arriba del máximo puede ser bloqueo (como hasta hoy) o
-- solo alerta, mientras Prime decide (tasks.md §9).
--
-- Cada edición de la vacante (descriptivo o evaluación) queda en audit_log con 'edit_profile'.

alter type public.audit_action add value if not exists 'edit_profile';

alter table public.job_profile_ai_configs
  add column cv_version int,
  add column salary_is_blocking boolean not null default true;

-- los scores existentes se calificaron con `version`: al arrancar, los pesos vigentes son esa versión
update public.job_profile_ai_configs set cv_version = version where cv_version is null;

alter table public.job_profile_ai_configs alter column cv_version set default 1;
alter table public.job_profile_ai_configs alter column cv_version set not null;
