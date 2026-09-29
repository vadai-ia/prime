-- Prime HR · asignar rol a los usuarios creados desde el dashboard.
-- Pegar completo en el SQL Editor. El trigger de auth.users crea la fila en public.users.
-- Si un usuario ya había iniciado sesión en la app, tiene que salir y volver a entrar
-- para que el JWT traiga el rol.

-- Empresa del usuario cliente (client_id es obligatorio para el rol client).
-- Id fijo: coincide con el del seed por si algún día lo corres.
insert into public.clients (id, name, industry, city)
values ('a0000000-0000-4000-8000-000000000001', 'Telasist', 'Textil', 'Aguascalientes')
on conflict (id) do nothing;

-- Admins
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "admin", "client_id": null}'::jsonb
where email in ('diegoldeve@gmail.com', 'admin@prime.com');

-- Reclutador
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "recruiter", "client_id": null}'::jsonb
where email = 'reclutador@prime.com';

-- Cliente
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "client", "client_id": "a0000000-0000-4000-8000-000000000001"}'::jsonb
where email = 'cliente@prime.com';

-- Verificar: deben salir las 4 filas con su rol.
select u.email, u.role, u.client_id, c.name as client_name, u.is_active
from public.users u
left join public.clients c on c.id = u.client_id
order by u.role, u.email;
