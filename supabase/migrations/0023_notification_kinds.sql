-- 0023 · Tipos de aviso nuevos (21 oct 2026)
--
-- Van solos: un valor de enum nuevo no se puede usar en la misma transacción que lo crea.
-- Los usa 0024 (candidato asignado, entrevista agendada, intento de registrar a alguien
-- de la lista negra).

alter type public.notification_kind add value if not exists 'candidate_assigned';
alter type public.notification_kind add value if not exists 'interview_scheduled';
alter type public.notification_kind add value if not exists 'blacklist_attempt';
