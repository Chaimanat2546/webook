-- M06 owns durable media lifecycle state. External R2 calls remain outside
-- PostgreSQL transactions; this migration records only Docs-owned intent.

do $$
begin
  if exists (select 1 from public.doc_media) then
    raise exception 'M06 media metadata migration requires an empty doc_media table.';
  end if;
end;
$$;
alter table public.doc_media
  drop column cleanup_required,
  add column mime_type text not null default 'image/webp'
    check (mime_type = 'image/webp'),
  add column size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 10485760),
  add column width integer not null
    check (width between 1 and 1920),
  add column height integer not null
    check (height between 1 and 1920);
alter table public.doc_media alter column mime_type drop default;
alter table public.doc_media_cleanup rename column reason to last_error;
alter table public.doc_media_cleanup
  add column display_label text not null default 'unknown.webp'
    check (length(btrim(display_label)) > 0),
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column last_attempt_at timestamptz,
  add column claim_token uuid,
  add column claim_expires_at timestamptz;
alter table public.doc_media_cleanup alter column display_label drop default;
create table public.doc_media_operations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('save_remove', 'document_delete', 'section_delete')),
  document_id uuid references public.doc_documents(id) on delete restrict,
  section_id uuid references public.doc_sections(id) on delete restrict,
  staged_save jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'save_remove' and document_id is not null and section_id is null and staged_save is not null)
    or (kind = 'document_delete' and document_id is not null and section_id is null and staged_save is null)
    or (kind = 'section_delete' and document_id is null and section_id is not null and staged_save is null)
  )
);
create table public.doc_media_operation_documents (
  operation_id uuid not null references public.doc_media_operations(id) on delete cascade,
  document_id uuid not null references public.doc_documents(id) on delete restrict,
  expected_version bigint not null check (expected_version > 0),
  primary key (operation_id, document_id),
  unique (document_id)
);
create table public.doc_media_operation_items (
  operation_id uuid not null references public.doc_media_operations(id) on delete cascade,
  document_id uuid not null references public.doc_documents(id) on delete restrict,
  media_id uuid not null references public.doc_media(id) on delete restrict,
  object_key text not null check (object_key like 'docs/%'),
  display_label text not null check (length(btrim(display_label)) > 0),
  primary key (operation_id, media_id),
  unique (operation_id, object_key)
);
create index doc_media_operations_document_id_idx
  on public.doc_media_operations (document_id) where document_id is not null;
create index doc_media_operations_section_id_idx
  on public.doc_media_operations (section_id) where section_id is not null;
create index doc_media_operation_items_document_id_idx
  on public.doc_media_operation_items (document_id);
create index doc_media_operation_items_media_id_idx
  on public.doc_media_operation_items (media_id);
create index doc_media_cleanup_claim_idx
  on public.doc_media_cleanup (claim_expires_at, created_at);
create or replace function doc_private.doc_set_media_operation_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger doc_media_operations_set_audit_fields
before update on public.doc_media_operations
for each row execute function doc_private.doc_set_media_operation_audit_fields();
grant select, insert, update, delete
  on public.doc_media_operations,
     public.doc_media_operation_documents,
     public.doc_media_operation_items
  to authenticated;
revoke all on public.doc_media_operations,
              public.doc_media_operation_documents,
              public.doc_media_operation_items
  from anon, public;
alter table public.doc_media_operations enable row level security;
alter table public.doc_media_operation_documents enable row level security;
alter table public.doc_media_operation_items enable row level security;
create policy "Docs administrators manage media operations"
on public.doc_media_operations for all to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators manage operation documents"
on public.doc_media_operation_documents for all to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
create policy "Docs administrators manage operation items"
on public.doc_media_operation_items for all to authenticated
using ((select doc_private.doc_is_admin()))
with check ((select doc_private.doc_is_admin()));
revoke all on function doc_private.doc_set_media_operation_audit_fields() from public;
-- Keep the public M04 save signature for the existing Admin UI while enforcing
-- the M06 verified-media payload. Later M06 prepared operations reuse these
-- same normalized fields rather than permitting a metadata-free write.
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
returns table (document_id uuid, version bigint, status text, path text)
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
  select * into v_existing from public.doc_documents where id = p_id for update;
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
  if exists (select 1 from public.doc_route_redirects as redirect where redirect.old_path = v_new_path) then
    raise exception 'This document route is already reserved by a redirect.' using errcode = '23505';
  end if;
  if not v_is_create then
    v_old_path := doc_private.doc_document_path(v_existing.section_id, v_existing.slug);
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_media) as item(
      id uuid, object_key text, public_url text, mime_type text,
      size_bytes bigint, width integer, height integer
    )
    where id is null
       or object_key is null
       or object_key <> 'docs/' || p_id::text || '/' || id::text || '.webp'
       or public_url is null
       or mime_type <> 'image/webp'
       or size_bytes is null or size_bytes <= 0 or size_bytes > 10485760
       or width is null or width not between 1 and 1920
       or height is null or height not between 1 and 1920
  ) then
    raise exception 'The media input is invalid.' using errcode = '23514';
  end if;

  if v_is_create then
    insert into public.doc_documents (id, section_id, title, slug, excerpt, content, status, sort_order, published_at)
    values (p_id, p_section_id, btrim(p_title), p_slug, nullif(btrim(coalesce(p_excerpt, '')), ''), p_content,
      p_status, p_sort_order, case when p_status = 'published' then now() else null end);
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
      set target_path = excluded.target_path, document_id = excluded.document_id;
    end if;
    update public.doc_route_redirects as redirect
    set target_path = v_new_path
    where redirect.document_id = p_id and redirect.target_path is distinct from v_new_path;
  end if;

  insert into public.doc_media (id, document_id, object_key, public_url, mime_type, size_bytes, width, height)
  select item.id, p_id, item.object_key, item.public_url, item.mime_type, item.size_bytes, item.width, item.height
  from jsonb_to_recordset(p_media) as item(
    id uuid, object_key text, public_url text, mime_type text,
    size_bytes bigint, width integer, height integer
  )
  on conflict (id) do nothing;

  return query
  select document.id, document.version, document.status, v_new_path
  from public.doc_documents as document where document.id = p_id;
end;
$$;
revoke all on function public.doc_save_document(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.doc_save_document(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb)
  to authenticated;
