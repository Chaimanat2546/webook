grant insert, update, delete on table public.images to authenticated;

drop policy if exists "Administrators can read images" on public.images;
drop policy if exists "Administrators can manage images" on public.images;

create policy "Administrators can read images"
  on public.images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.allow_tools @> '{"allow_accommodation": true}'::jsonb
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );

create policy "Administrators can manage images"
  on public.images
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.allow_tools @> '{"allow_accommodation": true}'::jsonb
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.users
      where users.allow_tools @> '{"allow_accommodation": true}'::jsonb
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );
