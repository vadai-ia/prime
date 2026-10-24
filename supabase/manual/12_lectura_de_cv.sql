-- Prime HR · migración 0025 para pegar en el SQL Editor (después de 11_*.sql).
-- Tipo de llamada a la IA "cv_extract": la carga masiva de CV lee nombre, teléfono y demás datos
-- de contacto del PDF y cada lectura queda registrada en ai_runs.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0025.

begin;

-- 0025 · Tipo de llamada a la IA para leer los datos de contacto de un CV (24 oct 2026)
--
-- La carga masiva de CV (Candidatos → Carga masiva) lee nombre, teléfono, correo, municipio,
-- escolaridad y edad del PDF antes de dar de alta al candidato; cada lectura queda en ai_runs
-- con este tipo. No evalúa ni descarta: el reclutador revisa los datos antes de guardarlos.

alter type public.ai_run_kind add value if not exists 'cv_extract';


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0025', 'cv_extract_kind')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  checks (orden, objeto, ok) as (
    values
      (1, 'ai_run_kind con cv_extract',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'ai_run_kind' and e.enumlabel = 'cv_extract'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
