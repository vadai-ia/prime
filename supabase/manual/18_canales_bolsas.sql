-- Prime HR · migración 0031 para pegar en el SQL Editor (después de 17_*.sql).
-- Canales Indeed, OCC y Computrabajo en el catálogo de origen del candidato (source_channel).
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0031.

begin;

-- 0031 · Canales Indeed, OCC y Computrabajo (28 oct 2026)
--
-- Son las tres bolsas que más postulantes le traen a Prime (últimos 30 días al 26 oct: Indeed 2,851,
-- OCC 2,336, Computrabajo 1,223). Sin ellas en el catálogo quedaban como "Otro" o "Pandape" y el
-- Tablero, Reportes y la exportación no podían decir qué bolsa rinde más.

alter type public.source_channel add value if not exists 'indeed';
alter type public.source_channel add value if not exists 'occ';
alter type public.source_channel add value if not exists 'computrabajo';


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0031', 'job_board_channels')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  ch as (select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'source_channel'),
  checks (orden, objeto, ok) as (
    values
      (1, 'canal Indeed', exists (select 1 from ch where enumlabel = 'indeed')),
      (2, 'canal OCC', exists (select 1 from ch where enumlabel = 'occ')),
      (3, 'canal Computrabajo', exists (select 1 from ch where enumlabel = 'computrabajo'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
