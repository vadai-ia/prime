-- 0019 · Microsoft 365: Teams como plataforma y Outlook como integración (plan §4.4 y §12.6)
--
-- Prime usa Outlook y Teams. Cada reclutador conecta su cuenta de Microsoft desde "Mi cuenta"
-- (OAuth delegado, opción B); los tokens van cifrados en user_integrations.
-- 'meet', 'zoom' y 'google' se quedan en los enums por las filas que ya existen; la app ya no los ofrece.
-- Un valor nuevo de enum no se puede usar en la misma transacción en que se agrega: el valor por
-- defecto de interviews.platform cambia en 0020.

alter type public.meeting_platform add value if not exists 'teams';
alter type public.integration_provider add value if not exists 'microsoft';
alter type public.webhook_source add value if not exists 'microsoft';
