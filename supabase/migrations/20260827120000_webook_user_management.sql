alter table public.users
  add column if not exists is_banned boolean not null default false;

create index if not exists users_management_order_idx
  on public.users (is_banned, updated_at desc, id);

drop policy if exists "selected" on public.users;

create or replace function private.is_webook_user_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users
    where users.role_id = 1
      and users.is_banned = false
      and (
        users.uid = auth.uid()
        or users.email = auth.jwt() ->> 'email'
      )
  );
$$;

revoke all on function private.is_webook_user_manager() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_webook_user_manager() to authenticated;

create policy "Authenticated users can read their own Webook user record"
  on public.users
  for select
  to authenticated
  using (
    users.uid = auth.uid()
    or users.email = auth.jwt() ->> 'email'
  );

create policy "Role 1 can manage Webook users"
  on public.users
  for all
  to authenticated
  using ((select private.is_webook_user_manager()))
  with check ((select private.is_webook_user_manager()));

create policy "Role 1 cannot update their own Webook user record"
  on public.users
  as restrictive
  for update
  to authenticated
  using (
    users.uid is distinct from auth.uid()
    and users.email is distinct from auth.jwt() ->> 'email'
  )
  with check (
    users.uid is distinct from auth.uid()
    and users.email is distinct from auth.jwt() ->> 'email'
  );
