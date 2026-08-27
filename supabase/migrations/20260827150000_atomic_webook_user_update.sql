create or replace function public.update_webook_user_details(
  p_id uuid,
  p_name text,
  p_username text,
  p_tel text,
  p_email text
)
returns table (
  id uuid,
  uid uuid,
  name varchar,
  username varchar,
  tel varchar,
  email varchar,
  is_banned boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_webook_user_manager() then
    raise insufficient_privilege;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('webook:username:' || p_username, 0));
  perform pg_advisory_xact_lock(hashtextextended('webook:email:' || lower(btrim(p_email)), 0));

  if exists (
    select 1
    from public.users
    where users.id <> p_id
      and (
        users.username = p_username
        or lower(btrim(users.email)) = lower(btrim(p_email))
      )
  ) then
    raise unique_violation
      using message = 'Webook user identity already exists',
            constraint = 'webook_users_identity_unique';
  end if;

  return query
  update public.users as target
  set name = p_name,
      username = p_username,
      tel = p_tel,
      email = lower(btrim(p_email)),
      updated_at = now()
  where target.id = p_id
  returning
    target.id,
    target.uid,
    target.name,
    target.username,
    target.tel,
    target.email,
    target.is_banned,
    target.updated_at;
end;
$$;

revoke all on function public.update_webook_user_details(uuid, text, text, text, text) from public;
grant execute on function public.update_webook_user_details(uuid, text, text, text, text) to authenticated;
