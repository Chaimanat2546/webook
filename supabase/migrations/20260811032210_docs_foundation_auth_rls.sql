-- Docs-owned schema baseline. This migration intentionally does not alter any
-- legacy object, including public.users and public.roles.

create table public.doc_sections (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.doc_sections(id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index doc_sections_root_slug_key
  on public.doc_sections (slug)
  where parent_id is null;
create unique index doc_sections_parent_slug_key
  on public.doc_sections (parent_id, slug)
  where parent_id is not null;
create index doc_sections_parent_sort_order_idx
  on public.doc_sections (parent_id, sort_order);
create table public.doc_documents (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.doc_sections(id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  version bigint not null default 1 check (version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, slug)
);
create index doc_documents_section_created_at_idx
  on public.doc_documents (section_id, created_at);
create index doc_documents_published_updated_at_idx
  on public.doc_documents (updated_at desc)
  where status = 'published';
create table public.doc_media (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.doc_documents(id) on delete restrict,
  object_key text not null unique check (object_key like 'docs/%'),
  public_url text not null,
  cleanup_required boolean not null default false,
  created_at timestamptz not null default now()
);
create index doc_media_document_id_idx on public.doc_media (document_id);
create table public.doc_route_redirects (
  id uuid primary key default gen_random_uuid(),
  old_path text not null unique check (old_path like '/%'),
  target_path text not null check (target_path like '/%'),
  created_at timestamptz not null default now(),
  check (old_path <> target_path)
);
-- SECURITY DEFINER helpers must not be exposed through the Data API. They read
-- only the legacy authorization columns permitted for Docs and return booleans.
create schema if not exists doc_private;
revoke all on schema doc_private from public;
create or replace function doc_private.doc_is_admin()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  return coalesce((
    select exists (
      select 1
      from public.users
      where uid = (select auth.uid())
        and role_id = 1
    )
  ), false);
exception
  when undefined_table then
    return false;
end;
$$;
create or replace function doc_private.doc_section_is_public(p_section_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.doc_documents as document
    where document.section_id = p_section_id
      and document.status = 'published'
  )
  or exists (
    select 1
    from public.doc_sections as child_section
    join public.doc_documents as document
      on document.section_id = child_section.id
    where child_section.parent_id = p_section_id
      and document.status = 'published'
  );
$$;
create or replace function doc_private.doc_document_is_published(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.doc_documents as document
    where document.id = p_document_id
      and document.status = 'published'
  );
$$;
-- The RPC stays in public for the Server-side route guard, but runs with the
-- caller's privileges and delegates to the private helper.
create or replace function public.doc_is_admin()
returns boolean
language sql
security invoker
set search_path = pg_catalog
as $$
  select doc_private.doc_is_admin();
$$;
revoke all on function doc_private.doc_is_admin() from public;
revoke all on function doc_private.doc_section_is_public(uuid) from public;
revoke all on function doc_private.doc_document_is_published(uuid) from public;
revoke all on function public.doc_is_admin() from public;
grant usage on schema doc_private to anon, authenticated;
grant execute on function doc_private.doc_is_admin() to authenticated;
grant execute on function doc_private.doc_section_is_public(uuid),
  doc_private.doc_document_is_published(uuid) to anon, authenticated;
grant execute on function public.doc_is_admin() to authenticated;
grant select on public.doc_sections, public.doc_documents, public.doc_media
  to anon;
grant select, insert, update, delete on public.doc_sections, public.doc_documents,
  public.doc_media, public.doc_route_redirects to authenticated;
alter table public.doc_sections enable row level security;
alter table public.doc_documents enable row level security;
alter table public.doc_media enable row level security;
alter table public.doc_route_redirects enable row level security;
create policy "Published document sections are readable by guests"
on public.doc_sections for select to anon
using ((select doc_private.doc_section_is_public(id)));
create policy "Published document sections or administrators are readable"
on public.doc_sections for select to authenticated
using (
  (select doc_private.doc_section_is_public(id))
  or (select doc_private.doc_is_admin())
);
create policy "Published documents are readable by guests"
on public.doc_documents for select to anon
using (status = 'published');
create policy "Published documents or administrators are readable"
on public.doc_documents for select to authenticated
using (status = 'published' or (select doc_private.doc_is_admin()));
create policy "Media for published documents is readable by guests"
on public.doc_media for select to anon
using ((select doc_private.doc_document_is_published(document_id)));
create policy "Media for published documents or administrators is readable"
on public.doc_media for select to authenticated
using (
  (select doc_private.doc_document_is_published(document_id))
  or (select doc_private.doc_is_admin())
);
create policy "Docs administrators insert sections"
on public.doc_sections for insert to authenticated
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators update sections"
on public.doc_sections for update to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators delete sections"
on public.doc_sections for delete to authenticated
using ((select doc_private.doc_is_admin()));
create policy "Docs administrators insert documents"
on public.doc_documents for insert to authenticated
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators update documents"
on public.doc_documents for update to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators delete documents"
on public.doc_documents for delete to authenticated
using ((select doc_private.doc_is_admin()));
create policy "Docs administrators insert media"
on public.doc_media for insert to authenticated
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators update media"
on public.doc_media for update to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators delete media"
on public.doc_media for delete to authenticated
using ((select doc_private.doc_is_admin()));
create policy "Docs administrators read redirects"
on public.doc_route_redirects for select to authenticated
using ((select doc_private.doc_is_admin()));
create policy "Docs administrators insert redirects"
on public.doc_route_redirects for insert to authenticated
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators update redirects"
on public.doc_route_redirects for update to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators delete redirects"
on public.doc_route_redirects for delete to authenticated
using ((select doc_private.doc_is_admin()));
