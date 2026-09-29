-- Prime HR · migración 0017 para pegar en el SQL Editor (después de 05_*.sql).
-- Catálogos que la app necesita: los 10 tipos de documento del expediente y los 6 templates de
-- WhatsApp. Estaban solo en la semilla de desarrollo; sin ellos la pestaña Expediente sale vacía.
--
-- SE PUEDE CORRER MÁS DE UNA VEZ: actualiza textos del catálogo y no borra documentos ya subidos.
-- Al final sale un checklist: todas las filas deben decir "ok".
--
-- Generado por scripts/build-manual.py a partir de supabase/migrations/0017.

begin;

-- 0017 · Catálogos que la app necesita para funcionar
--
-- Vivían en seed.sql (semilla de desarrollo), así que una base armada solo con migraciones
-- quedaba sin ellos: el expediente salía sin renglones y no había qué subir. Son datos de
-- referencia, no de prueba: van en migración. Re-ejecutable: actualiza textos, no borra nada.

-- Expediente: los 10 documentos de la demo. Claves por confirmar con Prime (plan §12).
insert into public.document_types (key, label, required, sort_order, accepts, validation_hints) values
  ('ine',                   'INE (frente y reverso)',            true,  10, '{image,pdf}', 'Vigente, legible, nombre coincide con el candidato'),
  ('curp',                  'CURP',                              true,  20, '{image,pdf}', 'Formato de 18 caracteres, nombre y fecha de nacimiento coinciden'),
  ('rfc',                   'Constancia de situación fiscal',    true,  30, '{image,pdf}', 'RFC con homoclave, emitida por el SAT, nombre coincide'),
  ('nss',                   'Número de seguridad social (NSS)',  true,  40, '{image,pdf}', '11 dígitos, documento del IMSS'),
  ('comprobante_domicilio', 'Comprobante de domicilio',          true,  50, '{image,pdf}', 'No mayor a 3 meses, dirección legible'),
  ('acta_nacimiento',       'Acta de nacimiento',                true,  60, '{image,pdf}', 'Nombre y fecha coinciden con CURP'),
  ('comprobante_estudios',  'Comprobante de estudios',           true,  70, '{image,pdf}', 'Certificado, título o cédula según el perfil'),
  ('carta_recomendacion_1', 'Carta de recomendación 1',          true,  80, '{image,pdf}', 'Con nombre, teléfono y firma de quien recomienda'),
  ('carta_recomendacion_2', 'Carta de recomendación 2',          true,  90, '{image,pdf}', 'Con nombre, teléfono y firma de quien recomienda'),
  ('fotografia',            'Fotografía reciente',               true, 100, '{image}',     'Fondo claro, rostro visible')
on conflict (key) do update set
  label = excluded.label, required = excluded.required, sort_order = excluded.sort_order,
  accepts = excluded.accepts, validation_hints = excluded.validation_hints;

-- Templates de WhatsApp que se mandan a aprobación de Meta (plan §4.1). Entran inactivos y
-- "pending": aquí solo se registran para que Configuración los muestre; no se tocan si ya existen.
insert into public.wa_templates (name, language, purpose, variables, meta_status, is_active) values
  ('prime_primer_contacto',         'es_MX', 'first_contact',     '[{"position":1,"key":"first_name"},{"position":2,"key":"job_title"}]', 'pending', false),
  ('prime_confirmacion_entrevista', 'es_MX', 'interview_confirm', '[{"position":1,"key":"first_name"},{"position":2,"key":"job_title"},{"position":3,"key":"datetime"},{"position":4,"key":"link"}]', 'pending', false),
  ('prime_enlace_psicometrico',     'es_MX', 'psych_link',        '[{"position":1,"key":"first_name"},{"position":2,"key":"link"},{"position":3,"key":"due_date"}]', 'pending', false),
  ('prime_recordatorio',            'es_MX', 'reminder',          '[{"position":1,"key":"first_name"},{"position":2,"key":"pending_item"}]', 'pending', false),
  ('prime_solicitud_documentos',    'es_MX', 'docs_request',      '[{"position":1,"key":"first_name"},{"position":2,"key":"document_label"}]', 'pending', false),
  ('prime_cierre_cortes',           'es_MX', 'courtesy_close',    '[{"position":1,"key":"first_name"},{"position":2,"key":"job_title"}]', 'pending', false)
on conflict (name, language) do nothing;


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
