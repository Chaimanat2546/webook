drop policy if exists "Administrators can manage advertisements" on public.advertisements;
drop policy if exists "Administrators can manage advertisement images" on public.advertisement_images;

create policy "Administrators can manage advertisements"
  on public.advertisements
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

create policy "Administrators can manage advertisement images"
  on public.advertisement_images
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
