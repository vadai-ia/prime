-- Prime HR · migraciones 0019 y 0020 para pegar en el SQL Editor (después de 07_*.sql).
-- Microsoft 365: 'teams' como plataforma de entrevista (y valor por defecto al agendar),
-- 'microsoft' como integración (cada reclutador conecta su Outlook) y como origen de webhooks.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en DOS transacciones: Postgres no deja usar
-- un valor de enum en la misma transacción en que se agrega. Al final sale un checklist: todo "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0019 y 0020.

begin;

-- 0019 · Microsoft 365: Teams como plataforma y Outlook como integración (plan §4.4 y §12.6)
--
-- Prime usa Outlook y Teams. Cada reclutador conecta su cuenta de Microsoft desde "Mi cuenta"
-- (OAuth delegado, opción B); los tokens van cifrados en user_integrations.
-- 'meet', 'zoom' y 'google' se quedan en los enums por las filas que ya existen; la app ya no los ofrece.
-- Un valor nuevo de enum no se puede usar en la misma transacción en que se agrega: el valor por
-- defecto de interviews.platform cambia en 0020.

alter type public.meeting_platform add value if not exists 'teams';
alter type public.integration_provider add value if not exists 'microsoft';
alter type public.webhook_source add value if not exists 'microsoft';


commit;

begin;

-- 0020 · Teams por defecto al agendar, y las entrevistas viejas de Meet o Zoom pasan a Teams
-- (decisión del 20 oct 2026: Prime solo usa Teams). El enlace guardado no se toca.

alter table public.interviews alter column platform set default 'teams';

update public.interviews set platform = 'teams' where platform in ('meet', 'zoom');


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0019', 'microsoft_enums'),
  ('0020', 'teams_default')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  enum_has (typ, val) as (
    select t.typname::text, e.enumlabel::text from pg_enum e join pg_type t on t.oid = e.enumtypid
  ),
  checks (orden, objeto, ok) as (
    values
      (1, 'meeting_platform incluye teams',
          exists (select 1 from enum_has where typ = 'meeting_platform' and val = 'teams')),
      (2, 'integration_provider incluye microsoft',
          exists (select 1 from enum_has where typ = 'integration_provider' and val = 'microsoft')),
      (3, 'webhook_source incluye microsoft',
          exists (select 1 from enum_has where typ = 'webhook_source' and val = 'microsoft')),
      (4, 'interviews.platform es teams por defecto',
          coalesce((select column_default from information_schema.columns
            where table_schema = 'public' and table_name = 'interviews' and column_name = 'platform'), '') like '%teams%')
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
