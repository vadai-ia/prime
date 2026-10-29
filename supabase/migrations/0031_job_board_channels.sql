-- 0031 · Canales Indeed, OCC y Computrabajo (28 oct 2026)
--
-- Son las tres bolsas que más postulantes le traen a Prime (últimos 30 días al 26 oct: Indeed 2,851,
-- OCC 2,336, Computrabajo 1,223). Sin ellas en el catálogo quedaban como "Otro" o "Pandape" y el
-- Tablero, Reportes y la exportación no podían decir qué bolsa rinde más.

alter type public.source_channel add value if not exists 'indeed';
alter type public.source_channel add value if not exists 'occ';
alter type public.source_channel add value if not exists 'computrabajo';
