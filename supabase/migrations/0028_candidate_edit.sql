-- 0028 · Edición de los datos del candidato (27 oct 2026)
--
-- La ficha del candidato ya deja corregir sus datos (nombre, teléfono, correo, edad, zona,
-- escolaridad, notas e identidad: CURP, RFC, NSS y domicilio). Quién puede: lo deciden las
-- políticas de 0015 (admin, o el reclutador con una postulación asignada de esa persona).
--
-- Cada edición queda en audit_log con 'edit_candidate': qué campos cambiaron, no sus valores.
-- Se registra contra la postulación desde la que se editó, para que el log enlace a la ficha.

alter type public.audit_action add value if not exists 'edit_candidate';
