grant select on table public.images to anon;

drop policy if exists "Public can read images" on public.images;

create policy "Public can read images"
  on public.images
  for select
  to anon
  using (true);
