-- 0030 · Tipo de llamada a la IA para leer un descriptivo de puesto (28 oct 2026)
--
-- En el levantamiento se puede subir el descriptivo (PDF o Word) y Claude llena las secciones II a
-- VII. Cada lectura queda en ai_runs con este tipo. Solo propone: quien captura revisa antes de guardar.

alter type public.ai_run_kind add value if not exists 'intake_extract';
