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
