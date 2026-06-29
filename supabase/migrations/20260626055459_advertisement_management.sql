create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advertisement_images (
  id uuid primary key default gen_random_uuid(),
  advertisement_id uuid not null references public.advertisements(id) on delete cascade,
  image_name text not null,
  image_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisement_images_order_unique unique (advertisement_id, image_order),
  constraint advertisement_images_order_range check (image_order between 1 and 2)
);

create index advertisement_images_advertisement_id_idx
  on public.advertisement_images (advertisement_id);

create index advertisements_active_updated_idx
  on public.advertisements (is_active desc, updated_at desc);

alter table public.advertisements enable row level security;
alter table public.advertisement_images enable row level security;

grant select on public.advertisements to anon, authenticated;
grant select on public.advertisement_images to anon, authenticated;
grant insert, update, delete on public.advertisements to authenticated;
grant insert, update, delete on public.advertisement_images to authenticated;

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
      where users.role_id = 1
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
      where users.role_id = 1
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
      where users.role_id = 1
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
      where users.role_id = 1
        and (
          users.uid = auth.uid()
          or users.email = auth.jwt() ->> 'email'
        )
    )
  );
