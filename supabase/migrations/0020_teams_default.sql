-- 0020 · Teams por defecto al agendar, y las entrevistas viejas de Meet o Zoom pasan a Teams
-- (decisión del 20 oct 2026: Prime solo usa Teams). El enlace guardado no se toca.

alter table public.interviews alter column platform set default 'teams';

update public.interviews set platform = 'teams' where platform in ('meet', 'zoom');
