-- Prime HR · migración 0016 para pegar en el SQL Editor (después de 04_*.sql).
-- Captura manual: estado "realizada" para entrevistas e historial de la persona por teléfono.
--
-- Pegar COMPLETO y correr ANTES de levantar la app con el código nuevo: la ficha del candidato
-- y el alta ya llaman candidate_history_by_phone.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en una transacción.
-- Al final sale un checklist: todas las filas deben decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0016.

begin;

-- 0016 · Captura manual: entrevista "realizada" e historial de la persona
--
-- Mientras no estén Google Calendar, Fireflies ni la IA, el reclutador agenda, reagenda y
-- cierra entrevistas a mano, y sube documentos y el reporte psicométrico desde la ficha.
-- Las tablas ya existían (0007); aquí va lo único que faltaba en la base.

-- ---------------------------------------------------------------------------
-- 1. Entrevista realizada sin grabación. recorded → transcribed → analyzed quedan
--    para cuando Fireflies entregue la grabación y la IA la analice.
-- ---------------------------------------------------------------------------
alter type public.interview_status add value if not exists 'completed' after 'confirmed';

-- ---------------------------------------------------------------------------
-- 2. Historial de la persona (junta 11 sep 2026: "ya se envió a X cliente hace 2 meses").
--    Divulgación controlada: cualquier staff puede preguntar por un teléfono y recibe
--    vacante, cliente, etapa, fechas y reclutador de TODAS sus postulaciones, aunque no
--    sean suyas. No expone datos del candidato ni abre acceso a esas postulaciones
--    (is_mine dice cuáles sí puede abrir).
-- ---------------------------------------------------------------------------
create or replace function public.candidate_history_by_phone(p_phone text)
returns table (
  application_id     uuid,
  candidate_id       uuid,
  profile_title      text,
  client_name        text,
  stage              public.application_stage,
  applied_at         timestamptz,
  stage_changed_at   timestamptz,
  discard_reason_key public.discard_reason_key,
  recruiter_name     text,
  is_mine            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.candidate_id,
    p.title,
    cl.name,
    a.stage,
    a.applied_at,
    a.stage_changed_at,
    a.discard_reason_key,
    u.full_name,
    app.can_access_application(a.id)
  from public.candidates c
  join public.applications a  on a.candidate_id = c.id
  join public.job_profiles p  on p.id = a.profile_id
  join public.clients cl      on cl.id = p.client_id
  left join public.users u    on u.id = a.assigned_recruiter_id
  where c.phone_e164 = p_phone
    and app.is_staff()
  order by a.applied_at desc
$$;

revoke execute on function public.candidate_history_by_phone(text) from public, anon;
grant execute on function public.candidate_history_by_phone(text) to authenticated, service_role;


create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0016', 'manual_capture')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with checks (orden, objeto, ok) as (
  values
    (1, 'enum interview_status incluye completed (Realizada)',
        exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'interview_status' and e.enumlabel = 'completed')),
    (2, 'RPC candidate_history_by_phone',
        to_regprocedure('public.candidate_history_by_phone(text)') is not null),
    (3, 'el historial lo llama un usuario con sesión, no un anónimo',
        coalesce(has_function_privilege('authenticated', to_regprocedure('public.candidate_history_by_phone(text)'), 'execute'), false)
        and not coalesce(has_function_privilege('anon', to_regprocedure('public.candidate_history_by_phone(text)'), 'execute'), true)),
    (4, 'requisito: migraciones 0014 y 0015 aplicadas (archivo 04)',
        to_regprocedure('app.can_access_application(uuid)') is not null)
)
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
