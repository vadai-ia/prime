# Genera los archivos de supabase/manual/ (los que se pegan en el SQL Editor) a partir de las
# migraciones, en versión RE-EJECUTABLE: el SQL Editor no lleva historial de migraciones, así
# que cada archivo tiene que poder correrse dos veces (o sobre una base a medias) sin fallar.
# Cada uno va en una transacción y termina con un checklist de ok / FALTA.
#
#   python scripts/build-manual.py
#
# Las migraciones de supabase/migrations/ no se tocan: ahí cada una corre una sola vez.
import io
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def idempotent(sql: str, expected: dict) -> str:
    """expected = cuántas sentencias de cada tipo trae el archivo; si no cuadra, alguien cambió la
    migración y hay que revisar que la conversión siga cubriendo todo."""

    def sub(pattern, repl, kind, flags=re.M):
        nonlocal sql
        sql, n = re.subn(pattern, repl, sql, flags=flags)
        assert n == expected.get(kind, 0), (kind, n, expected.get(kind, 0))

    # create type no tiene "if not exists"
    sub(r"^create type (public\.\w+) as enum \(([^;]*)\);$",
        r"do $$ begin\n  create type \1 as enum (\2);\nexception when duplicate_object then null;\nend $$;", "type")
    sub(r"^create table public\.", "create table if not exists public.", "table")
    sub(r"^create index ", "create index if not exists ", "index")
    sub(r"^create sequence ", "create sequence if not exists ", "sequence")
    sub(r"^(\s+)add column ", r"\1add column if not exists ", "column")
    sub(r"^create trigger (\w+)\n(\s+(?:before|after)[^\n]* on (public\.\w+))$",
        r"drop trigger if exists \1 on \3;\ncreate trigger \1\n\2", "trigger")
    sub(r"^drop policy (\w+) on ", r"drop policy if exists \1 on ", "drop_policy")
    sub(r"^create policy (\w+) on (public\.\w+) ",
        r"drop policy if exists \1 on \2;\ncreate policy \1 on \2 ", "policy")
    leftover = re.findall(r"^create (?:type|table|index|sequence|trigger|policy) (?!if not exists)\S+", sql, flags=re.M)
    leftover = [x for x in leftover if not x.startswith(("create trigger", "create policy"))]  # esos van precedidos de su drop ... if exists
    assert not leftover, leftover
    return sql


HEAD_04 = """-- Prime HR · migraciones 0014 y 0015 para pegar en el SQL Editor (después de 03_*.sql).
-- Asignación de reclutadores por vacante, visibilidad acotada, permisos solo-admin y
-- candidatos por reclutador (round robin). Decisiones de la junta del 11 sep 2026.
--
-- Pegar COMPLETO y correr ANTES de levantar la app con el código nuevo: /perfiles y
-- /clientes ya consultan job_profile_assignments.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ. Si ya estaba aplicado (o quedó a medias), vuelve a dejar
-- todo igual y no toca datos: las asignaciones y los candidatos ya repartidos se conservan.
-- Va en una transacción: si algo falla no queda nada a medias.
-- Al final sale un checklist: todas las filas deben decir "ok".
--
-- Después de la primera vez nadie tiene vacantes asignadas: el reclutador entra y no ve
-- nada hasta que un admin lo marque en Perfiles → (vacante) → pestaña Reclutadores.
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0014 y 0015.

begin;

"""

TAIL_04 = """
-- Historial (coherente con el bloque de 01_todas_las_migraciones.sql; se crea si no lo corriste)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0014', 'recruiter_assignments'),
  ('0015', 'candidate_scope')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  pol as (select tablename, policyname from pg_policies where schemaname = 'public'),
  fn  as (select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace),
  trg as (select c.relname || '.' || t.tgname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal),
  col as (select table_name || '.' || column_name as name from information_schema.columns where table_schema = 'public'),
  checks (orden, objeto, ok) as (
    values
      (1,  'enum assignment_action (assigned, unassigned)',
           (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'assignment_action') = array['assigned', 'unassigned']),
      (2,  'enum assignment_source (manual, user_deactivated, role_changed)',
           (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'assignment_source') = array['manual', 'user_deactivated', 'role_changed']),
      (3,  'tabla job_profile_assignments con RLS',
           coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.job_profile_assignments')), false)),
      (4,  'tabla job_profile_assignment_events con RLS',
           coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.job_profile_assignment_events')), false)),
      (5,  'columnas turn_seq y last_candidate_at en job_profile_assignments',
           (select count(*) from col where name in ('job_profile_assignments.turn_seq', 'job_profile_assignments.last_candidate_at')) = 2),
      (6,  'columnas assigned_recruiter_id y assigned_at en applications',
           (select count(*) from col where name in ('applications.assigned_recruiter_id', 'applications.assigned_at')) = 2),
      (7,  'v_pipeline trae assigned_recruiter_id y assigned_recruiter_name',
           (select count(*) from col where name in ('v_pipeline.assigned_recruiter_id', 'v_pipeline.assigned_recruiter_name')) = 2),
      (8,  'secuencia app.recruiter_turn_seq',
           to_regclass('app.recruiter_turn_seq') is not null),
      (9,  'helpers de visibilidad (6) y app.has_permission',
           (select count(*) from fn where name in ('app.assigned_profile_ids', 'app.assigned_client_ids', 'app.can_access_profile', 'app.can_access_client', 'app.can_access_application', 'app.can_access_candidate', 'app.has_permission')) = 7),
      (10, 'RPC set_profile_recruiters y find_candidate_by_phone',
           (select count(*) from fn where name in ('public.set_profile_recruiters', 'public.find_candidate_by_phone')) = 2),
      (11, 'round robin: funciones y triggers',
           (select count(*) from fn where name in ('app.next_recruiter_for_profile', 'app.distribute_unassigned_applications', 'app.notify_application')) = 3
           and (select count(*) from trg where name in ('applications.applications_before_insert_assign', 'applications.applications_guard_reassign', 'job_profile_assignments.job_profile_assignments_redistribute')) = 3),
      (12, 'triggers de asignación e historial',
           (select count(*) from trg where name in ('job_profile_assignments.job_profile_assignments_before_insert', 'job_profile_assignments.job_profile_assignments_log', 'users.users_release_assignments')) = 3),
      (13, 'políticas nuevas del reclutador (clients, job_profiles, applications, candidates, users)',
           (select count(*) from pol where policyname in ('clients_select_recruiter', 'job_profiles_select_recruiter', 'applications_select_recruiter', 'candidates_select_recruiter', 'users_select_recruiter')) = 5),
      (14, 'políticas viejas "staff ve todo" eliminadas',
           (select count(*) from pol where policyname in ('clients_select_staff', 'job_profiles_select_staff', 'job_profiles_insert_staff', 'applications_select_staff', 'candidates_all_staff', 'users_select_staff', 'job_intakes_all_staff', 'report_runs_select_staff', 'import_batches_all_staff')) = 0),
      (15, 'notify_staff ya no es ejecutable por usuarios',
           not has_function_privilege('authenticated', 'public.notify_staff(public.notification_kind, text, text, text, uuid, text)', 'execute')),
      (16, 'log_audit rechaza export a quien no es admin',
           (select prosrc like '%has_permission(''export'')%' from pg_proc where oid = to_regproc('public.log_audit')))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""


HEAD_05 = """-- Prime HR · migración 0016 para pegar en el SQL Editor (después de 04_*.sql).
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

"""

TAIL_05 = """
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
"""

HEAD_06 = """-- Prime HR · migración 0017 para pegar en el SQL Editor (después de 05_*.sql).
-- Catálogos que la app necesita: los 10 tipos de documento del expediente y los 6 templates de
-- WhatsApp. Estaban solo en la semilla de desarrollo; sin ellos la pestaña Expediente sale vacía.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ: actualiza textos del catálogo y no borra documentos ya subidos.
-- Al final sale un checklist: todas las filas deben decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0017.

begin;

"""

TAIL_06 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0017', 'catalogs')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with checks (orden, objeto, ok) as (
  values
    (1, 'catálogo del expediente: 10 tipos de documento',
        (select count(*) from public.document_types) >= 10),
    (2, 'están INE, CURP y constancia de situación fiscal',
        (select count(*) from public.document_types where key in ('ine', 'curp', 'rfc')) = 3),
    (3, 'templates de WhatsApp registrados (6)',
        (select count(*) from public.wa_templates) >= 6)
)
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

HEAD_07 = """-- Prime HR · migración 0018 para pegar en el SQL Editor (después de 06_*.sql).
-- Cancelar una contratación: al regresar de Contratado se limpian fecha de contratación, fecha de
-- ingreso, decisión del cliente y seguimientos pendientes. La línea de tiempo conserva todo.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0018.

begin;

"""

TAIL_07 = """
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
"""

HEAD_08 = """-- Prime HR · migraciones 0019 y 0020 para pegar en el SQL Editor (después de 07_*.sql).
-- Microsoft 365: 'teams' como plataforma de entrevista (y valor por defecto al agendar),
-- 'microsoft' como integración (cada reclutador conecta su Outlook) y como origen de webhooks.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en DOS transacciones: Postgres no deja usar
-- un valor de enum en la misma transacción en que se agrega. Al final sale un checklist: todo "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0019 y 0020.

begin;

"""

TAIL_08 = """
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
"""

HEAD_09 = """-- Prime HR · migración 0021 para pegar en el SQL Editor (después de 08_*.sql).
-- Lista negra: solo el admin la ve y la maneja. Una persona marcada no puede volver a postularse
-- (lo impide la base, venga del alta manual, la carga masiva o WhatsApp).
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en una transacción.
-- Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0021.

begin;

"""

TAIL_09 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0021', 'blacklist')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace),
  checks (orden, objeto, ok) as (
    values
      (1, 'enum blacklist_reason',
          to_regtype('public.blacklist_reason') is not null),
      (2, 'tabla candidate_blacklist con RLS',
          coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.candidate_blacklist')), false)),
      (3, 'política: solo admin la lee',
          exists (select 1 from pg_policies where tablename = 'candidate_blacklist' and policyname = 'candidate_blacklist_select_admin')),
      (4, 'trigger que bloquea postulaciones de la lista negra',
          exists (select 1 from pg_trigger where tgname = 'applications_block_blacklisted' and not tgisinternal)),
      (5, 'RPC blacklist_candidate, unblacklist_candidate e is_blacklisted',
          (select count(*) from fn where name in ('public.blacklist_candidate', 'public.unblacklist_candidate', 'public.is_blacklisted')) = 3)
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

HEAD_10 = """-- Prime HR · migración 0022 para pegar en el SQL Editor (después de 09_*.sql).
-- Cola de tareas: recuperar tareas colgadas, correr una tarea al encolarla, fallar sin reintentar,
-- avisar a los admins cuando una tarea falla, reintentar o cancelar desde Configuración, y los
-- avisos de permanencia (30, 90 y 180 días).
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos (las tareas que ya estén en la cola se quedan).
-- Va en una transacción. Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0022.

begin;

"""

TAIL_10 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('0022', 'task_queue')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig, p.proname as name
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  checks (orden, objeto, ok) as (
    values
      (1, 'notification_kind incluye followup_due',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'notification_kind' and e.enumlabel = 'followup_due')),
      (2, 'columna placement_followups.notified_at',
          exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'placement_followups' and column_name = 'notified_at')),
      (3, 'claim_scheduled_tasks con p_only (y sin la versión vieja)',
          (select count(*) from fn where name = 'claim_scheduled_tasks') = 1
          and exists (select 1 from fn where sig like 'public.claim_scheduled_tasks(%p_only uuid)')),
      (4, 'finish_scheduled_task con p_retry (y sin la versión vieja)',
          (select count(*) from fn where name = 'finish_scheduled_task') = 1
          and exists (select 1 from fn where sig like 'public.finish_scheduled_task(%p_retry boolean)')),
      (5, 'RPC retry_scheduled_task, cancel_scheduled_task y notify_followups_due',
          (select count(*) from fn where name in ('retry_scheduled_task', 'cancel_scheduled_task', 'notify_followups_due')) = 3)
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

HEAD_11 = """-- Prime HR · migraciones 0023 y 0024 para pegar en el SQL Editor (después de 10_*.sql).
-- Permanencia (Sigue / Se fue / No se sabe), base de candidatos inactivos (solo admin), avisos
-- automáticos (candidato asignado, entrevista agendada, documento recibido, intento de registrar
-- a alguien de la lista negra) y quién conectó su Outlook.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Va en dos transacciones: los tipos de aviso
-- nuevos tienen que existir antes de usarse. Al final sale un checklist: todo debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0023 y 0024.

begin;

"""

TAIL_11 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0023', 'notification_kinds'),
  ('0024', 'admin_tools')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select n.nspname || '.' || p.proname as name, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace),
  checks (orden, objeto, ok) as (
    values
      (1, 'notification_kind con candidate_assigned, interview_scheduled y blacklist_attempt',
          (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
           where t.typname = 'notification_kind' and e.enumlabel in ('candidate_assigned', 'interview_scheduled', 'blacklist_attempt')) = 3),
      (2, 'avisos: candidato asignado, entrevista agendada y documento recibido',
          (select count(*) from pg_trigger where not tgisinternal
           and tgname in ('applications_notify_assigned', 'interviews_notify_scheduled', 'candidate_documents_notify_received')) = 3),
      (3, 'los avisos no le llegan a quien hizo el cambio',
          exists (select 1 from fn where name = 'app.notify_application' and src like '%is distinct from auth.uid()%')),
      (4, 'RPC report_blacklist_attempt, record_placement_followup y list_user_integrations',
          (select count(*) from fn where name in ('public.report_blacklist_attempt', 'public.record_placement_followup', 'public.list_user_integrations')) = 3),
      (5, 'vista v_inactive_candidates',
          to_regclass('public.v_inactive_candidates') is not null)
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

HEAD_12 = """-- Prime HR · migración 0025 para pegar en el SQL Editor (después de 11_*.sql).
-- Tipo de llamada a la IA "cv_extract": la carga masiva de CV lee nombre, teléfono y demás datos
-- de contacto del PDF y cada lectura queda registrada en ai_runs.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0025.

begin;

"""

TAIL_12 = """
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
"""

HEAD_13 = """-- Prime HR · migración 0026 para pegar en el SQL Editor (después de 12_*.sql).
-- Edición a mano de la evaluación de la vacante: reglas y preguntas del prefiltro, mínimos
-- psicométricos y sueldo máximo como bloqueo o alerta. Solo los cambios de pesos del CV piden
-- recalificar (cv_version). Cada edición de la vacante queda en Logs técnicos ('edit_profile').
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0026.

begin;

"""

TAIL_13 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0026', 'profile_edit')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  col as (select column_name, is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'job_profile_ai_configs'),
  checks (orden, objeto, ok) as (
    values
      (1, 'audit_action con edit_profile',
          exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'audit_action' and e.enumlabel = 'edit_profile')),
      (2, 'job_profile_ai_configs.cv_version (obligatoria)',
          exists (select 1 from col where column_name = 'cv_version' and is_nullable = 'NO')),
      (3, 'job_profile_ai_configs.salary_is_blocking',
          exists (select 1 from col where column_name = 'salary_is_blocking'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

HEAD_14 = """-- Prime HR · migración 0027 para pegar en el SQL Editor (después de 13_*.sql).
-- Razón social y nombre comercial del cliente.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0027.

begin;

"""

TAIL_14 = """
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
"""

HEAD_15 = """-- Prime HR · migración 0028 para pegar en el SQL Editor (después de 14_*.sql).
-- Edición de los datos del candidato desde su ficha: cada cambio queda en Logs técnicos
-- ('edit_candidate'), con los campos que cambiaron y sin sus valores.
--
-- Pegar ANTES de abrir la app con el código nuevo: guardar los datos registra 'edit_candidate'.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0028.

begin;

"""

TAIL_15 = """
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
"""

HEAD_16 = """-- Prime HR · migración 0029 para pegar en el SQL Editor (después de 15_*.sql).
-- El reclutador ve a TODOS los candidatos de las vacantes que trabaja (ya no solo los suyos).
-- Se acaba el reparto por turno: los candidatos nuevos no se asignan a nadie y quitar a un
-- reclutador de una vacante no reparte nada. Los avisos de un candidato llegan a todos los
-- reclutadores de su vacante.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no borra datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0029.

begin;

"""

TAIL_16 = """
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('0029', 'vacancy_scope')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Checklist: todas las filas deben decir "ok". Si alguna dice FALTA, mándame la tabla.
-- ---------------------------------------------------------------------------
with
  fn as (select p.proname, pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'app'),
  pol as (select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'applications'),
  checks (orden, objeto, ok) as (
    values
      (1, 'can_access_application por vacante',
          exists (select 1 from fn where proname = 'can_access_application' and def not like '%assigned_recruiter_id%')),
      (2, 'can_access_candidate por vacante',
          exists (select 1 from fn where proname = 'can_access_candidate' and def not like '%assigned_recruiter_id%')),
      (3, 'applications: el reclutador ve toda su vacante',
          exists (select 1 from pol where policyname = 'applications_select_recruiter' and qual not like '%assigned_recruiter_id%')),
      (4, 'sin reparto por turno',
          exists (select 1 from fn where proname = 'next_recruiter_for_profile' and def not like '%turn_seq%')),
      (5, 'avisos a los reclutadores de la vacante',
          exists (select 1 from fn where proname = 'notify_application' and def like '%job_profile_assignments%'))
  )
select orden, objeto, case when ok then 'ok' else 'FALTA' end as estado
from checks
order by orden;
"""

# Entre migraciones que van en transacciones separadas ("separate": True).
BETWEEN = "\ncommit;\n\nbegin;\n\n"


HEAD_17 = """-- Prime HR · migración 0030 para pegar en el SQL Editor (después de 16_*.sql).
-- Tipo de llamada a la IA "intake_extract": en el levantamiento se sube el descriptivo de puesto
-- (PDF o Word) y Claude llena las secciones II a VII. Cada lectura queda registrada en ai_runs.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0030.

begin;

"""

TAIL_17 = """
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
"""


HEAD_18 = """-- Prime HR · migración 0031 para pegar en el SQL Editor (después de 17_*.sql).
-- Canales Indeed, OCC y Computrabajo en el catálogo de origen del candidato (source_channel).
--
-- SE PUEDE CORRER MÁS DE UNA VEZ y no toca datos. Al final sale un checklist: debe decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0031.

begin;

"""

TAIL_18 = """
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
"""

TARGETS = [
    {
        "out": "04_asignacion_reclutadores_y_alcance.sql",
        "migrations": ["0014_recruiter_assignments.sql", "0015_candidate_scope.sql"],
        "head": HEAD_04,
        "tail": TAIL_04,
        "expected": {"type": 2, "table": 2, "index": 4, "sequence": 1, "column": 4, "trigger": 6, "drop_policy": 31, "policy": 49},
    },
    {
        "out": "05_captura_manual.sql",
        "migrations": ["0016_manual_capture.sql"],
        "head": HEAD_05,
        "tail": TAIL_05,
        "expected": {},  # solo alter type ... if not exists y create or replace function: ya es re-ejecutable
    },
    {
        "out": "06_catalogos.sql",
        "migrations": ["0017_catalogs.sql"],
        "head": HEAD_06,
        "tail": TAIL_06,
        "expected": {},  # solo inserts con on conflict
    },
    {
        "out": "07_cancelar_contratacion.sql",
        "migrations": ["0018_cancel_hire.sql"],
        "head": HEAD_07,
        "tail": TAIL_07,
        "expected": {"trigger": 1},
    },
    {
        "out": "08_microsoft_teams.sql",
        "migrations": ["0019_microsoft_enums.sql", "0020_teams_default.sql"],
        "head": HEAD_08,
        "tail": TAIL_08,
        "expected": {},  # alter type ... add value if not exists y set default: ya es re-ejecutable
        "separate": True,
    },
    {
        "out": "09_lista_negra.sql",
        "migrations": ["0021_blacklist.sql"],
        "head": HEAD_09,
        "tail": TAIL_09,
        "expected": {"type": 1, "table": 1, "index": 3, "trigger": 2, "policy": 1},
    },
    {
        "out": "10_cola_de_tareas.sql",
        "migrations": ["0022_task_queue.sql"],
        "head": HEAD_10,
        "tail": TAIL_10,
        "expected": {"column": 1},
    },
    {
        "out": "11_permanencia_inactivos_avisos.sql",
        "migrations": ["0023_notification_kinds.sql", "0024_admin_tools.sql"],
        "head": HEAD_11,
        "tail": TAIL_11,
        "expected": {"trigger": 3},
        "separate": True,
    },
    {
        "out": "12_lectura_de_cv.sql",
        "migrations": ["0025_cv_extract_kind.sql"],
        "head": HEAD_12,
        "tail": TAIL_12,
        "expected": {},  # solo alter type ... add value if not exists: ya es re-ejecutable
    },
    {
        "out": "13_editar_vacante.sql",
        "migrations": ["0026_profile_edit.sql"],
        "head": HEAD_13,
        "tail": TAIL_13,
        "expected": {"column": 2},  # el update solo toca filas sin cv_version y set not null se puede repetir
    },
    {
        "out": "14_razon_social_cliente.sql",
        "migrations": ["0027_client_legal_names.sql"],
        "head": HEAD_14,
        "tail": TAIL_14,
        "expected": {"column": 2},
    },
    {
        "out": "15_editar_candidato.sql",
        "migrations": ["0028_candidate_edit.sql"],
        "head": HEAD_15,
        "tail": TAIL_15,
        "expected": {},  # solo alter type ... add value if not exists: ya es re-ejecutable
    },
    {
        "out": "16_reclutador_ve_su_vacante.sql",
        "migrations": ["0029_vacancy_scope.sql"],
        "head": HEAD_16,
        "tail": TAIL_16,
        "expected": {"trigger": 1, "drop_policy": 2, "policy": 2},
    },
    {
        "out": "17_lectura_de_descriptivo.sql",
        "migrations": ["0030_intake_extract_kind.sql"],
        "head": HEAD_17,
        "tail": TAIL_17,
        "expected": {},  # solo alter type ... add value if not exists: ya es re-ejecutable
    },
    {
        "out": "18_canales_bolsas.sql",
        "migrations": ["0031_job_board_channels.sql"],
        "head": HEAD_18,
        "tail": TAIL_18,
        "expected": {},  # solo alter type ... add value if not exists: ya es re-ejecutable
    },
]


def main():
    for t in TARGETS:
        parts = []
        for name in t["migrations"]:
            with io.open(os.path.join(ROOT, "supabase", "migrations", name), encoding="utf-8") as f:
                parts.append(f.read().replace("\r\n", "\n") + "\n")
        body = (BETWEEN if t.get("separate") else "").join(parts)
        out = os.path.join(ROOT, "supabase", "manual", t["out"])
        with io.open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(t["head"] + idempotent(body, t["expected"]) + t["tail"])
        print("ok", t["out"])


if __name__ == "__main__":
    main()
