insert into public.users (
  username, email, role_id, uid, name, mid, allow_tools
) values (
  'admin',
  'chaymanus2003@gmail.com',
  1,
  'dedc178d-6a2d-4d02-a8ed-cf27362f72dc',
  'Admin',
  1,
  '{
    "allow_cost": true,
    "allow_price": true,
    "allow_report": true,
    "allow_billing": true,
    "allow_booking": true,
    "allow_invoice": true,
    "allow_members": true,
    "allow_receipt": true,
    "allow_quotation": true,
    "allow_tax_invoice": true,
    "allow_accommodation": true
  }'::jsonb
);