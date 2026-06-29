insert into public.users (email, role_id, uid, name, mid, allow_tools)
values (
  'admin@example.com',
  3,
  'a4de4fef-3596-4a45-9897-c0ec1a28419f',
  'Local Test User',
  100001,
  '{"allow_accommodation": true}'::jsonb
);