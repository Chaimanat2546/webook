insert into public.users (email, role_id, uid, name, mid, allow_tools)
values (
  'admin@example.com',
  1,
  '43a218fa-8d5d-455b-8fe8-271fcee30650',
  'Admin Name',
  1,
  '{"allow_accommodation": true}'::jsonb
);