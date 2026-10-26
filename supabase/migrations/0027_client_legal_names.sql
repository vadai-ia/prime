-- 0027 · Razón social y nombre comercial del cliente (26 oct 2026)
--
-- La ficha de clientes que mandó Prime trae cliente, razón social, nombre comercial, giro,
-- domicilio, responsable, puesto, teléfono y correo. `name` sigue siendo el nombre corto con el
-- que se ve el cliente en todo el sistema; los otros dos son datos de la empresa.
--
-- El "reclutador asignado" de esa ficha no va aquí: los reclutadores se asignan por vacante
-- (job_profile_assignments, plan §2.3), y al cargar la ficha se asignan a las vacantes del cliente.

alter table public.clients
  add column legal_name text,
  add column trade_name text;
