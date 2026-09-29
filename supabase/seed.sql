-- Semilla de desarrollo. Los usuarios se crean con scripts/seed-users.mjs
-- (necesitan pasar por auth.admin para que app_metadata traiga el rol).

-- Los catálogos (tipos de documento del expediente y templates de WhatsApp) están en la
-- migración 0017: la app los necesita también fuera de desarrollo.

-- Cliente de desarrollo (id fijo para que scripts/seed-users.mjs le cuelgue el usuario cliente)
insert into public.clients (id, name, industry, city, contact_name, contact_title, contact_email, client_since, weekly_report_dow, report_recipients)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Telasist', 'Textil', 'Aguascalientes',
  'Verónica', 'Gerente de RH', 'cliente@prime.local',
  '2026-01-15', 5, '{cliente@prime.local}'
)
on conflict (id) do nothing;

insert into public.job_profiles (id, client_id, title, status, openings, unit, work_zone, objective)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Ejecutivo de cobranza', 'active', 2, 'Cobranza', 'Aguascalientes', 'Recuperar cartera vencida por teléfono y visita'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Diseñador industrial', 'active', 1, 'Desarrollo', 'Aguascalientes', 'Diseñar fichas técnicas y prototipos de nuevos productos'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Supervisor de producción', 'active', 1, 'Producción', 'Aguascalientes', 'Coordinar el turno de tejido y cumplir el plan de producción')
on conflict (id) do nothing;

-- Quién trabaja cada vacante lo siembra scripts/seed-users.mjs (necesita a los reclutadores creados):
-- Roberto → cobranza y diseñador · Lucía → diseñador y supervisor. Diseñador es la vacante compartida.

insert into public.job_profile_ai_configs (profile_id, age_min, age_max, age_is_blocking, commute_max_min, experience_min_months, education_min, cv_weights, cv_threshold, prefilter_questions, psych_minimums, psych_blocking)
values
  ('b0000000-0000-4000-8000-000000000001', 23, 45, false, 60, 12, 'Preparatoria',
   '[{"key":"experience","label":"Experiencia en cobranza","weight":40},{"key":"education","label":"Escolaridad","weight":15},{"key":"stability","label":"Estabilidad laboral","weight":25},{"key":"skills","label":"Negociación y sistemas","weight":20}]',
   70,
   '[{"order":1,"key":"zone","text":"¿En qué colonia o municipio vives?","rule_key":"commute","answer_type":"text"},{"order":2,"key":"experience","text":"¿Cuánto tiempo tienes de experiencia en cobranza?","rule_key":"experience_min","answer_type":"months"},{"order":3,"key":"saturdays","text":"El puesto trabaja sábados medio día, ¿tienes disponibilidad?","rule_key":"requires_saturdays","answer_type":"yes_no"},{"order":4,"key":"salary","text":"¿Cuál es tu expectativa de sueldo mensual?","rule_key":"salary_max","answer_type":"money"}]',
   '[{"scale":"tolerancia_presion","min":60},{"scale":"persuasion","min":55}]',
   '[{"scale":"tolerancia_presion","min":40}]'),
  ('b0000000-0000-4000-8000-000000000002', 24, 40, false, 60, 24, 'Licenciatura',
   '[{"key":"experience","label":"Experiencia en diseño industrial","weight":35},{"key":"software","label":"SolidWorks / AutoCAD","weight":30},{"key":"education","label":"Escolaridad","weight":15},{"key":"portfolio","label":"Portafolio","weight":20}]',
   75,
   '[{"order":1,"key":"zone","text":"¿En qué colonia o municipio vives?","rule_key":"commute","answer_type":"text"},{"order":2,"key":"software","text":"¿Qué software de diseño dominas?","rule_key":"systems","answer_type":"text"},{"order":3,"key":"salary","text":"¿Cuál es tu expectativa de sueldo mensual?","rule_key":"salary_max","answer_type":"money"}]',
   '[{"scale":"creatividad","min":60},{"scale":"atencion_detalle","min":60}]',
   '[]')
on conflict (profile_id) do nothing;
