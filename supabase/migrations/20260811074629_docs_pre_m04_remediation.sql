-- Pre-M04 remediation. This migration only changes Docs-owned functions and
-- policies; it does not alter any Legacy object.

-- A Published document is public only when every section in its two-level
-- route is also public. Keep this lookup in the private schema so RLS does
-- not query its own tables recursively.
create or replace function doc_private.doc_document_is_public(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.doc_documents as document
    join public.doc_sections as section
      on section.id = document.section_id
    left join public.doc_sections as parent
      on parent.id = section.parent_id
    where document.id = p_document_id
      and document.status = 'published'
      and section.is_published
      and (parent.id is null or parent.is_published)
  );
$$;
revoke all on function doc_private.doc_document_is_public(uuid) from public;
grant execute on function doc_private.doc_document_is_public(uuid)
  to anon, authenticated;
drop policy "Published documents are readable by guests" on public.doc_documents;
drop policy "Published documents or administrators are readable" on public.doc_documents;
drop policy "Media for published documents is readable by guests" on public.doc_media;
drop policy "Media for published documents or administrators is readable" on public.doc_media;
create policy "Public documents are readable by guests"
on public.doc_documents for select to anon
using ((select doc_private.doc_document_is_public(id)));
create policy "Public documents or administrators are readable"
on public.doc_documents for select to authenticated
using (
  (select doc_private.doc_document_is_public(id))
  or (select doc_private.doc_is_admin())
);
create policy "Media for public documents is readable by guests"
on public.doc_media for select to anon
using ((select doc_private.doc_document_is_public(document_id)));
create policy "Media for public documents or administrators is readable"
on public.doc_media for select to authenticated
using (
  (select doc_private.doc_document_is_public(document_id))
  or (select doc_private.doc_is_admin())
);
-- Serialize structural changes. Structure writes are infrequent, and this
-- prevents two concurrent moves/inserts from bypassing the two-level limit.
create or replace function doc_private.doc_validate_section_structure()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_parent_parent_id uuid;
  v_route_path text;
begin
  perform pg_advisory_xact_lock(810241, 1);

  if new.slug = any (array['admin', 'api', 'search', 'login', '_next']) then
    raise exception 'This slug is reserved.' using errcode = '23514';
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A section cannot be its own parent.' using errcode = '23514';
    end if;

    select parent_id
      into v_parent_parent_id
      from public.doc_sections
      where id = new.parent_id;

    if not found then
      raise exception 'The selected parent section does not exist.' using errcode = '23503';
    end if;

    if v_parent_parent_id is not null then
      raise exception 'Sections may only be nested two levels deep.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.doc_sections as child
      where child.parent_id = new.id
    ) then
      raise exception 'A section with child sections cannot become a child section.' using errcode = '23514';
    end if;

    select '/' || parent.slug || '/' || new.slug
      into v_route_path
      from public.doc_sections as parent
      where parent.id = new.parent_id;
  else
    v_route_path := '/' || new.slug;
  end if;

  if exists (
    select 1
    from public.doc_route_redirects as redirect
    where redirect.old_path = v_route_path
  ) then
    raise exception 'This section route is already reserved by a redirect.' using errcode = '23505';
  end if;

  return new;
end;
$$;
-- The old function did not receive the confirmation text, so it could not
-- protect against a concurrent rename between preview and deletion.
drop function public.doc_delete_section(uuid);
create function public.doc_delete_section(
  p_section_id uuid,
  p_confirmed_title text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_media_count bigint;
  v_title text;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  select title
    into v_title
    from public.doc_sections
    where id = p_section_id
    for update;

  if not found then
    raise exception 'The section was not found.' using errcode = 'P0002';
  end if;

  if v_title is distinct from p_confirmed_title then
    raise exception 'The confirmation name does not match.' using errcode = '23514';
  end if;

  with subtree as (
    select id from public.doc_sections where id = p_section_id
    union all
    select child.id from public.doc_sections as child where child.parent_id = p_section_id
  )
  select count(*) into v_media_count
  from public.doc_media as media
  join public.doc_documents as document on document.id = media.document_id
  join subtree on subtree.id = document.section_id;

  if v_media_count > 0 then
    raise exception 'Media cleanup must complete before deleting this section.' using errcode = 'P0001';
  end if;

  with subtree as (
    select section.id, section.parent_id, section.slug
    from public.doc_sections as section
    where section.id = p_section_id
    union all
    select child.id, child.parent_id, child.slug
    from public.doc_sections as child
    where child.parent_id = p_section_id
  ), document_paths as (
    select case
      when subtree.parent_id is null then '/' || subtree.slug || '/' || document.slug
      else '/' || parent.slug || '/' || subtree.slug || '/' || document.slug
    end as path
    from public.doc_documents as document
    join subtree on subtree.id = document.section_id
    left join public.doc_sections as parent on parent.id = subtree.parent_id
  )
  delete from public.doc_route_redirects as redirect
  using document_paths
  where redirect.target_path = document_paths.path;

  delete from public.doc_documents
  where section_id = p_section_id
     or section_id in (select id from public.doc_sections where parent_id = p_section_id);

  delete from public.doc_sections where parent_id = p_section_id;
  delete from public.doc_sections where id = p_section_id;
end;
$$;
revoke all on function public.doc_delete_section(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.doc_delete_section(uuid, text) to authenticated;
