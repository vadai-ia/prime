-- 0012 · Storage: buckets privados
--
-- Sin políticas sobre storage.objects para authenticated: toda lectura y
-- escritura pasa por el servidor con service role (URL firmada de 60 s tras
-- verificar rol + audit_log; subida con createSignedUploadUrl).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs',           'cvs',           false,  20971520, array['application/pdf']),
  ('documents',     'documents',     false,  20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('psychometrics', 'psychometrics', false,  33554432, array['application/pdf']),
  ('wa-media',      'wa-media',      false, 104857600, null),
  ('reports',       'reports',       false,  20971520, array['application/pdf', 'text/html'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
