drop policy if exists "Role 1 can manage Webook users" on public.users;
drop policy if exists "Role 1 cannot update their own Webook user record" on public.users;

create policy "Role 1 can read Webook users"
  on public.users
  for select
  to authenticated
  using ((select private.is_webook_user_manager()));

revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;

create table if not exists private.webook_user_lifecycle_locks (
  user_id uuid primary key references public.users(id) on delete cascade,
  owner_token uuid not null,
  expires_at timestamptz not null
);

revoke all on table private.webook_user_lifecycle_locks
  from public, anon, authenticated, service_role;

create or replace function public.acquire_webook_user_lifecycle_lock(
  p_id uuid,
  p_owner_token uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, private
as $$
declare
  acquired boolean := false;
begin
  insert into private.webook_user_lifecycle_locks as current_lock (
    user_id,
    owner_token,
    expires_at
  )
  values (
    p_id,
    p_owner_token,
    now() + interval '5 minutes'
  )
  on conflict (user_id) do update
  set owner_token = excluded.owner_token,
      expires_at = excluded.expires_at
  where current_lock.expires_at <= now()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

revoke all on function public.acquire_webook_user_lifecycle_lock(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.acquire_webook_user_lifecycle_lock(uuid, uuid)
  to service_role;

create or replace function public.release_webook_user_lifecycle_lock(
  p_id uuid,
  p_owner_token uuid
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog, public, private
as $$
  delete from private.webook_user_lifecycle_locks
  where user_id = p_id
    and owner_token = p_owner_token;
$$;

revoke all on function public.release_webook_user_lifecycle_lock(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_webook_user_lifecycle_lock(uuid, uuid)
  to service_role;

drop function if exists public.update_webook_user_details(uuid, text, text, text, text);

create or replace function public.update_webook_user_details(
  p_id uuid,
  p_name text,
  p_username text,
  p_tel text,
  p_email text,
  p_lock_token uuid
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
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform 1
  from private.webook_user_lifecycle_locks
  where user_id = p_id
    and owner_token = p_lock_token
    and expires_at > now()
  for update;

  if not found then
    raise serialization_failure using message = 'Webook user lifecycle lock is not owned';
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

revoke all on function public.update_webook_user_details(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_webook_user_details(uuid, text, text, text, text, uuid)
  to service_role;

create or replace function public.set_webook_user_ban(
  p_id uuid,
  p_is_banned boolean,
  p_lock_token uuid
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
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform 1
  from private.webook_user_lifecycle_locks
  where user_id = p_id
    and owner_token = p_lock_token
    and expires_at > now()
  for update;

  if not found then
    raise serialization_failure using message = 'Webook user lifecycle lock is not owned';
  end if;

  return query
  update public.users as target
  set is_banned = p_is_banned,
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

revoke all on function public.set_webook_user_ban(uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.set_webook_user_ban(uuid, boolean, uuid)
  to service_role;
