-- M04 owns document persistence, publish transitions, route history and the
-- minimum Media cleanup contract. Legacy tables and policies remain untouched.

alter table public.doc_documents
  add column created_by uuid default auth.uid(),
  add column updated_by uuid default auth.uid();
alter table public.doc_route_redirects
  add column document_id uuid references public.doc_documents(id) on delete cascade;
create index doc_route_redirects_document_id_idx
  on public.doc_route_redirects (document_id)
  where document_id is not null;
create table public.doc_media_cleanup (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  object_key text not null unique check (object_key like 'docs/%'),
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index doc_media_cleanup_document_id_idx
  on public.doc_media_cleanup (document_id, created_at);
grant select, insert, update, delete on public.doc_media_cleanup to authenticated;
alter table public.doc_media_cleanup enable row level security;
create policy "Docs administrators manage media cleanup"
on public.doc_media_cleanup for all to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create or replace function doc_private.doc_document_path(
  p_section_id uuid,
  p_document_slug text
)
returns text
language sql
security definer
set search_path = pg_catalog
as $$
  select case
    when section.parent_id is null then '/' || section.slug || '/' || p_document_slug
    else '/' || parent.slug || '/' || section.slug || '/' || p_document_slug
  end
  from public.doc_sections as section
  left join public.doc_sections as parent on parent.id = section.parent_id
  where section.id = p_section_id;
$$;
create or replace function doc_private.doc_validate_document_route()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_path text;
begin
  perform pg_advisory_xact_lock(810241, 1);

  if new.slug = any (array['admin', 'api', 'search', 'login', '_next']) then
    raise exception 'This slug is reserved.' using errcode = '23514';
  end if;

  v_path := doc_private.doc_document_path(new.section_id, new.slug);
  if v_path is null then
    raise exception 'The selected section does not exist.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.doc_route_redirects as redirect
    where redirect.old_path = v_path
  ) then
    raise exception 'This document route is already reserved by a redirect.' using errcode = '23505';
  end if;

  return new;
end;
$$;
create or replace function doc_private.doc_set_document_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create or replace function doc_private.doc_set_cleanup_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger doc_documents_validate_route
before insert or update of section_id, slug on public.doc_documents
for each row execute function doc_private.doc_validate_document_route();
create trigger doc_documents_set_audit_fields
before insert or update on public.doc_documents
for each row execute function doc_private.doc_set_document_audit_fields();
create trigger doc_media_cleanup_set_audit_fields
before update on public.doc_media_cleanup
for each row execute function doc_private.doc_set_cleanup_audit_fields();
create or replace function public.doc_save_document(
  p_id uuid,
  p_section_id uuid,
  p_title text,
  p_slug text,
  p_excerpt text,
  p_content jsonb,
  p_status text,
  p_sort_order integer,
  p_expected_version bigint,
  p_media jsonb default '[]'::jsonb
)
returns table (
  document_id uuid,
  version bigint,
  status text,
  path text
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_existing public.doc_documents%rowtype;
  v_new_path text;
  v_old_path text;
  v_is_create boolean := false;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0
     or p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_content is null or p_content->>'type' <> 'doc'
     or p_status not in ('draft', 'published', 'archived')
     or p_sort_order is null or p_sort_order < 0
     or jsonb_typeof(p_media) <> 'array' then
    raise exception 'The document input is invalid.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(810241, 1);
  select * into v_existing
  from public.doc_documents
  where id = p_id
  for update;

  if found then
    if p_expected_version is null or p_expected_version <> v_existing.version then
      raise exception 'The document has changed. Reload before saving.' using errcode = 'P0001';
    end if;
  else
    if p_expected_version is not null then
      raise exception 'The document was not found.' using errcode = 'P0002';
    end if;
    v_is_create := true;
  end if;

  v_new_path := doc_private.doc_document_path(p_section_id, p_slug);
  if v_new_path is null then
    raise exception 'The selected section does not exist.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.doc_route_redirects as redirect where redirect.old_path = v_new_path
  ) then
    raise exception 'This document route is already reserved by a redirect.' using errcode = '23505';
  end if;

  if not v_is_create then
    v_old_path := doc_private.doc_document_path(v_existing.section_id, v_existing.slug);
  end if;

  if v_is_create then
    insert into public.doc_documents (
      id, section_id, title, slug, excerpt, content, status, sort_order, published_at
    ) values (
      p_id, p_section_id, btrim(p_title), p_slug, nullif(btrim(coalesce(p_excerpt, '')), ''), p_content,
      p_status, p_sort_order, case when p_status = 'published' then now() else null end
    );
  else
    update public.doc_documents as document
    set section_id = p_section_id,
        title = btrim(p_title),
        slug = p_slug,
        excerpt = nullif(btrim(coalesce(p_excerpt, '')), ''),
        content = p_content,
        status = p_status,
        sort_order = p_sort_order,
        version = document.version + 1,
        published_at = case when p_status = 'published' then coalesce(document.published_at, now()) else document.published_at end
    where document.id = p_id;

    if v_old_path is distinct from v_new_path then
      insert into public.doc_route_redirects (old_path, target_path, document_id)
      values (v_old_path, v_new_path, p_id)
      on conflict (old_path) do update
      set target_path = excluded.target_path,
          document_id = excluded.document_id;
    end if;

    update public.doc_route_redirects as redirect
    set target_path = v_new_path
    where redirect.document_id = p_id
      and redirect.target_path is distinct from v_new_path;
  end if;

  insert into public.doc_media (id, document_id, object_key, public_url)
  select item.id, p_id, item.object_key, item.public_url
  from jsonb_to_recordset(p_media) as item(id uuid, object_key text, public_url text)
  on conflict (id) do nothing;

  return query
  select document.id, document.version, document.status, v_new_path
  from public.doc_documents as document
  where document.id = p_id;
end;
$$;
create or replace function public.doc_reorder_documents(
  p_section_id uuid,
  p_document_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_expected_count integer;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_document_ids is null or cardinality(p_document_ids) <> cardinality(array(select distinct id from unnest(p_document_ids) as id)) then
    raise exception 'The document order is invalid.' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(810241, 1);
  select count(*) into v_expected_count from public.doc_documents where section_id = p_section_id;
  if v_expected_count <> cardinality(p_document_ids)
     or exists (select 1 from public.doc_documents where section_id = p_section_id and id <> all(p_document_ids)) then
    raise exception 'The document order must contain every document in the section.' using errcode = '23514';
  end if;
  update public.doc_documents as document
  set sort_order = ordered.ordinality - 1
  from unnest(p_document_ids) with ordinality as ordered(id, ordinality)
  where document.id = ordered.id and document.section_id = p_section_id;
end;
$$;
create or replace function public.doc_prepare_document_delete(
  p_document_id uuid,
  p_expected_version bigint
)
returns table (
  version bigint,
  object_keys text[]
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_document public.doc_documents%rowtype;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select * into v_document from public.doc_documents where id = p_document_id;
  if not found then raise exception 'The document was not found.' using errcode = 'P0002'; end if;
  if p_expected_version <> v_document.version then
    raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001';
  end if;
  return query select v_document.version, coalesce(array_agg(media.object_key order by media.object_key), array[]::text[])
  from public.doc_media as media where media.document_id = p_document_id;
end;
$$;
create or replace function public.doc_finalize_document_delete(
  p_document_id uuid,
  p_expected_version bigint
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_version bigint;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select version into v_version
  from public.doc_documents
  where id = p_document_id
  for update;
  if not found then raise exception 'The document was not found.' using errcode = 'P0002'; end if;
  if v_version <> p_expected_version then
    raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001';
  end if;
  delete from public.doc_media where document_id = p_document_id;
  delete from public.doc_route_redirects where document_id = p_document_id;
  delete from public.doc_documents where id = p_document_id;
end;
$$;
revoke all on function doc_private.doc_document_path(uuid, text) from public;
revoke all on function doc_private.doc_validate_document_route() from public;
revoke all on function doc_private.doc_set_document_audit_fields() from public;
revoke all on function doc_private.doc_set_cleanup_audit_fields() from public;
revoke all on function public.doc_save_document(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.doc_reorder_documents(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.doc_prepare_document_delete(uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function public.doc_finalize_document_delete(uuid, bigint) from public, anon, authenticated, service_role;
grant execute on function doc_private.doc_document_path(uuid, text) to anon, authenticated;
grant execute on function public.doc_save_document(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb) to authenticated;
grant execute on function public.doc_reorder_documents(uuid, uuid[]) to authenticated;
grant execute on function public.doc_prepare_document_delete(uuid, bigint) to authenticated;
grant execute on function public.doc_finalize_document_delete(uuid, bigint) to authenticated;
