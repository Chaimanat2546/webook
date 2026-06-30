begin;

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advertisement_images (
  id uuid primary key default gen_random_uuid(),
  advertisement_id uuid not null references public.advertisements(id) on delete cascade,
  image_name text not null,
  image_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisement_images_order_unique unique (advertisement_id, image_order),
  constraint advertisement_images_order_range check (image_order between 1 and 2)
);

create index if not exists advertisement_images_advertisement_id_idx
  on public.advertisement_images (advertisement_id);

create index if not exists advertisements_active_updated_idx
  on public.advertisements (is_active desc, updated_at desc);

alter table public.advertisements enable row level security;
alter table public.advertisement_images enable row level security;

grant select on public.advertisements to anon, authenticated;
grant select on public.advertisement_images to anon, authenticated;
grant insert, update, delete on public.advertisements to authenticated;
grant insert, update, delete on public.advertisement_images to authenticated;

drop policy if exists "Public can read active advertisements" on public.advertisements;
drop policy if exists "Public can read active advertisement images" on public.advertisement_images;
drop policy if exists "Administrators can manage advertisements" on public.advertisements;
drop policy if exists "Administrators can manage advertisement images" on public.advertisement_images;

create policy "Public can read active advertisements"
  on public.advertisements
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can read active advertisement images"
  on public.advertisement_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.advertisements
      where advertisements.id = advertisement_images.advertisement_id
        and advertisements.is_active = true
    )
  );

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

drop policy if exists "Authenticated can read images" on public.images;
drop policy if exists "allow images" on public.images;
drop policy if exists "select_public" on public.images;
drop policy if exists "Administrators can read images" on public.images;
drop policy if exists "Administrators can manage images" on public.images;

revoke all on table public.images from anon;
revoke insert, update, delete on table public.images from authenticated;
grant select, insert, update, delete on table public.images to authenticated;
grant select on table public.images to anon;

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

drop policy if exists "Public can read images" on public.images;

create policy "Public can read images"
  on public.images
  for select
  to anon
  using (true);

insert into supabase_migrations.schema_migrations (version, statements, name)
values
  ('20260626050000', array['manual baseline already existed in production'], 'remote_public_schema'),
  ('20260626055459', array['manual production migration'], 'advertisement_management'),
  ('20260626095839', array['manual production migration'], 'allow_authenticated_image_reads'),
  ('20260629043610', array['manual production migration'], 'admin_manage_house_images'),
  ('20260629055840', array['manual production migration'], 'advertisement_allow_accommodation'),
  ('20260630084922', array['manual production migration'], 'allow_public_house_image_reads')
on conflict (version) do update
set
  name = excluded.name,
  statements = excluded.statements;

commit;
