insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'photobooth-media',
  'photobooth-media',
  false,
  67108864,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/webm']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
