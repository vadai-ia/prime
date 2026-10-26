-- Prime HR · migración 0026 para pegar en el SQL Editor (después de 12_*.sql).
-- Edición a mano de la evaluación de la vacante: reglas y preguntas del prefiltro, mínimos
-- psicométricos y sueldo máximo como bloqueo o alerta. Solo los cambios de pesos del CV piden
-- recalificar (cv_version). Cada edición de la vacante queda en Logs técnicos ('edit_profile').
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0026.

begin;

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
  add column if not exists cv_version int,
  add column if not exists salary_is_blocking boolean not null default true;

-- los scores existentes se calificaron con `version`: al arrancar, los pesos vigentes son esa versión
update public.job_profile_ai_configs set cv_version = version where cv_version is null;

alter table public.job_profile_ai_configs alter column cv_version set default 1;
alter table public.job_profile_ai_configs alter column cv_version set not null;


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0026', 'profile_edit')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  col as (select column_name, is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'job_profile_ai_configs'),
  checks (orden, objeto, ok) as (
    values
      (1, 'audit_action con edit_profile',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'audit_action' and e.enumlabel = 'edit_profile')),
      (2, 'job_profile_ai_configs.cv_version (obligatoria)',
          exists (select 1 from col where column_name = 'cv_version' and is_nullable = 'NO')),
      (3, 'job_profile_ai_configs.salary_is_blocking',
          exists (select 1 from col where column_name = 'salary_is_blocking'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
