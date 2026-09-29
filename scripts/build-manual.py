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
]


def main():
    for t in TARGETS:
        body = ""
        for name in t["migrations"]:
            with io.open(os.path.join(ROOT, "supabase", "migrations", name), encoding="utf-8") as f:
                body += f.read().replace("\r\n", "\n") + "\n"
        out = os.path.join(ROOT, "supabase", "manual", t["out"])
        with io.open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(t["head"] + idempotent(body, t["expected"]) + t["tail"])
        print("ok", t["out"])


if __name__ == "__main__":
    main()
