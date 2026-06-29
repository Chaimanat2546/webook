drop policy if exists "Authenticated can read images" on public.images;
drop policy if exists "allow images" on public.images;
drop policy if exists "select_public" on public.images;

revoke all on table public.images from anon;
revoke insert, update, delete on table public.images from authenticated;
grant select on table public.images to authenticated;

create policy "Administrators can read images"
  on public.images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );