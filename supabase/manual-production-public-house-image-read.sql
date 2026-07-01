begin;

grant select on table public.images to anon;

drop policy if exists "Public can read images" on public.images;

create policy "Public can read images"
  on public.images
  for select
  to anon
  using (true);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260630084922',
  array['manual production migration'],
  'allow_public_house_image_reads'
)
on conflict (version) do update
set
  name = excluded.name,
  statements = excluded.statements;

commit;
