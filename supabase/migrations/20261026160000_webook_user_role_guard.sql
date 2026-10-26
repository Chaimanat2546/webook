-- Role 1 will grant access to other users' login history. Membership managers
-- may manage ordinary accounts, but may not appoint or modify root admins.
create schema if not exists login_history_private;
revoke all on schema login_history_private from public;

create function login_history_private.block_client_user_writes()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if current_user in ('anon', 'authenticated')
     or coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'user_write_forbidden' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function login_history_private.block_client_user_writes() from public;
create trigger block_client_user_writes before insert or update or delete on public.users
for each row execute function login_history_private.block_client_user_writes();
revoke insert, update, delete, truncate, references, trigger on public.users from anon, authenticated;

create function public.webook_update_user_guarded(p_actor uuid, p_target uuid, p_fields jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor public.users%rowtype;
  target public.users%rowtype;
begin
  -- Consistent order avoids deadlocks, and locks keep actor and target roles
  -- stable until the guarded write finishes (including concurrent demotions).
  perform id from public.users where uid = p_actor or id = p_target order by id for update;
  begin
    select * into strict actor from public.users where uid = p_actor;
  exception when no_data_found or too_many_rows then
    raise exception 'user_write_forbidden' using errcode = '42501';
  end;
  if coalesce(actor.allow_tools ->> 'allow_members', 'false') <> 'true' then
    raise exception 'user_write_forbidden' using errcode = '42501';
  end if;
  select * into target from public.users where id = p_target;
  if not found then return null; end if;
  if actor.role_id is distinct from 1 and
      (target.role_id = 1 or (p_fields ->> 'role_id')::smallint = 1) then
    raise exception 'user_write_forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_fields) <> 'object'
     or p_fields - array['name','role_id','dv_id','allow_tools'] <> '{}'::jsonb
     or not (p_fields ?& array['name','role_id'])
     or coalesce(length(btrim(p_fields ->> 'name')), 0) not between 1 and 150 then
    raise exception 'invalid_user_fields' using errcode = '22023';
  end if;
  update public.users set
    name = btrim(p_fields ->> 'name'),
    role_id = (p_fields ->> 'role_id')::smallint,
    dv_id = case when p_fields ? 'dv_id' then (p_fields ->> 'dv_id')::bigint else dv_id end,
    allow_tools = case when p_fields ? 'allow_tools' then p_fields -> 'allow_tools' else allow_tools end
  where id = p_target;
  return p_target;
end;
$$;
revoke all on function public.webook_update_user_guarded(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.webook_update_user_guarded(uuid,uuid,jsonb) to service_role;
