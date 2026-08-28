create or replace view public.webook_user_management_list
with (security_invoker = true)
as
select
  u.id,
  u.name,
  u.username,
  u.email,
  u.role_id,
  u.dv_id::text as dv_id,
  u.dv_id as dv_sort_id,
  coalesce(
    case
      when json_typeof(r.name) = 'string' then nullif(btrim(r.name #>> '{}'), '')
      when json_typeof(r.name) = 'object' then coalesce(
        nullif(btrim(r.name->>'th'), ''),
        nullif(btrim(r.name->>'th-TH'), ''),
        nullif(btrim(r.name->>'name_th'), ''),
        nullif(btrim(r.name->>'en'), ''),
        nullif(btrim(r.name->>'en-US'), ''),
        nullif(btrim(r.name->>'name_en'), ''),
        nullif(btrim(r.name->>'name'), ''),
        (
          select nullif(btrim(role_name.value), '')
          from json_each_text(r.name) as role_name
          where nullif(btrim(role_name.value), '') is not null
          limit 1
        )
      )
    end,
    'สิทธิ์ผู้ใช้ ' || r.id::text,
    'ไม่ระบุสิทธิ์ผู้ใช้'
  ) as role_name
from public.users u
left join public.roles r on r.id = u.role_id;

REVOKE ALL ON TABLE public.webook_user_management_list FROM anon, authenticated;
GRANT SELECT ON TABLE public.webook_user_management_list TO service_role;
