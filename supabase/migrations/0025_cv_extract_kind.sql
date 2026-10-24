-- 0025 · Tipo de llamada a la IA para leer los datos de contacto de un CV (24 oct 2026)
--
-- La carga masiva de CV (Candidatos → Carga masiva) lee nombre, teléfono, correo, municipio,
-- escolaridad y edad del PDF antes de dar de alta al candidato; cada lectura queda en ai_runs
-- con este tipo. No evalúa ni descarta: el reclutador revisa los datos antes de guardarlos.

alter type public.ai_run_kind add value if not exists 'cv_extract';
