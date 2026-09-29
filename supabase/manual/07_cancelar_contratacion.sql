-- Prime HR · migración 0018 para pegar en el SQL Editor (después de 06_*.sql).
-- Cancelar una contratación: al regresar de Contratado se limpian fecha de contratación, fecha de
-- ingreso, decisión del cliente y seguimientos pendientes. La línea de tiempo conserva todo.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0018.

begin;

-- 0018 · Cancelar una contratación
--
-- "Contratado" fija fecha de contratación, decisión del cliente y tres seguimientos (0013).
-- Al regresar de esa etapa se limpia lo que la contratación había fijado; la línea de tiempo
-- conserva el Vo.Bo. y el regreso. Salir de Contratado a Descartado no limpia nada: eso es
-- "se fue", no "se canceló", y lo capturan los seguimientos.

create or replace function app.before_application_stage_change()
returns trigger
language plpgsql
as $$
begin
  if new.stage is not distinct from old.stage then
    return new;
  end if;

  new.stage_changed_at := now();

  if new.stage = 'discarded' then
    new.discarded_at         := coalesce(new.discarded_at, now());
    new.discarded_from_stage := coalesce(new.discarded_from_stage, old.stage);
    new.discarded_by         := coalesce(new.discarded_by, app.actor_from_context());
    new.discarded_by_user_id := coalesce(new.discarded_by_user_id, auth.uid());
    new.discard_reason       := coalesce(new.discard_reason, nullif(current_setting('app.stage_reason', true), ''));
  elsif old.stage = 'discarded' then
    -- reapertura: se limpia el descarte
    new.discarded_at         := null;
    new.discarded_from_stage := null;
    new.discarded_by         := null;
    new.discarded_by_user_id := null;
    new.discard_reason       := null;
    new.discard_reason_key   := null;
  end if;

  if new.stage = 'hired' then
    new.hired_at := coalesce(new.hired_at, now());
  elsif old.stage = 'hired' and new.stage <> 'discarded' then
    -- contratación cancelada: el cliente puede volver a decidir
    new.hired_at                := null;
    new.start_date              := null;
    new.client_decision         := null;
    new.client_decision_at      := null;
    new.client_decision_by      := null;
    new.client_decision_comment := null;
  end if;

  return new;
end;
$$;

-- Los seguimientos que todavía no se capturaron ya no aplican.
create or replace function app.after_hire_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stage = 'hired' and new.stage not in ('hired', 'discarded') then
    delete from public.placement_followups
    where application_id = new.id and outcome = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_after_hire_cancelled on public.applications;
create trigger applications_after_hire_cancelled
  after update of stage on public.applications
  for each row execute function app.after_hire_cancelled();


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0018', 'cancel_hire')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with checks (orden, objeto, ok) as (
  values
    (1, 'al salir de Contratado se limpia la contratación',
        (select prosrc like '%new.hired_at                := null%' from pg_proc where oid = to_regproc('app.before_application_stage_change'))),
    (2, 'trigger que borra los seguimientos pendientes',
        exists (select 1 from pg_trigger where tgname = 'applications_after_hire_cancelled' and not tgisinternal))
)
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
