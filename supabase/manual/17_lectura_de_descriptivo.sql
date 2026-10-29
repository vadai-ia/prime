-- Prime HR · migración 0030 para pegar en el SQL Editor (después de 16_*.sql).
-- Tipo de llamada a la IA "intake_extract": en el levantamiento se sube el descriptivo de puesto
-- (PDF o Word) y Claude llena las secciones II a VII. Cada lectura queda registrada en ai_runs.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0030.

begin;

-- 0030 · Tipo de llamada a la IA para leer un descriptivo de puesto (28 oct 2026)
--
-- En el levantamiento se puede subir el descriptivo (PDF o Word) y Claude llena las secciones II a
-- VII. Cada lectura queda en ai_runs con este tipo. Solo propone: quien captura revisa antes de guardar.

alter type public.ai_run_kind add value if not exists 'intake_extract';


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0030', 'intake_extract_kind')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  checks (orden, objeto, ok) as (
    values
      (1, 'ai_run_kind con intake_extract',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'ai_run_kind' and e.enumlabel = 'intake_extract'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
