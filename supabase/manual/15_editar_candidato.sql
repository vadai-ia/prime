-- Prime HR · migración 0028 para pegar en el SQL Editor (después de 14_*.sql).
-- Edición de los datos del candidato desde su ficha: cada cambio queda en Logs técnicos
-- ('edit_candidate'), con los campos que cambiaron y sin sus valores.
--
-- Pegar ANTES de abrir la app con el código nuevo: guardar los datos registra 'edit_candidate'.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0028.

begin;

-- 0028 · Edición de los datos del candidato (27 oct 2026)
--
-- La ficha del candidato ya deja corregir sus datos (nombre, teléfono, correo, edad, zona,
-- escolaridad, notas e identidad: CURP, RFC, NSS y domicilio). Quién puede: lo deciden las
-- políticas de 0015 (admin, o el reclutador con una postulación asignada de esa persona).
--
-- Cada edición queda en audit_log con 'edit_candidate': qué campos cambiaron, no sus valores.
-- Se registra contra la postulación desde la que se editó, para que el log enlace a la ficha.

alter type public.audit_action add value if not exists 'edit_candidate';


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0028', 'candidate_edit')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  checks (orden, objeto, ok) as (
    values
      (1, 'audit_action con edit_candidate',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'audit_action' and e.enumlabel = 'edit_candidate'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
