-- Prime HR · migración 0027 para pegar en el SQL Editor (después de 13_*.sql).
-- Razón social y nombre comercial del cliente.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0027.

begin;

-- 0027 · Razón social y nombre comercial del cliente (26 oct 2026)
--
-- La ficha de clientes que mandó Prime trae cliente, razón social, nombre comercial, giro,
-- domicilio, responsable, puesto, teléfono y correo. `name` sigue siendo el nombre corto con el
-- que se ve el cliente en todo el sistema; los otros dos son datos de la empresa.
--
-- El "reclutador asignado" de esa ficha no va aquí: los reclutadores se asignan por vacante
-- (job_profile_assignments, plan §2.3), y al cargar la ficha se asignan a las vacantes del cliente.

alter table public.clients
  add column if not exists legal_name text,
  add column if not exists trade_name text;


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0027', 'client_legal_names')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  col as (select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'clients'),
  checks (orden, objeto, ok) as (
    values
      (1, 'clients.legal_name (razón social)', exists (select 1 from col where column_name = 'legal_name')),
      (2, 'clients.trade_name (nombre comercial)', exists (select 1 from col where column_name = 'trade_name'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
