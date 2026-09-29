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

create trigger applications_after_hire_cancelled
  after update of stage on public.applications
  for each row execute function app.after_hire_cancelled();
