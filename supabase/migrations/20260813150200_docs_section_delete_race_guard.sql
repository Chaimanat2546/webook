-- Keep the membership of a prepared section-delete subtree immutable until
-- its exact R2 manifest is finalized. Every path uses the same transaction
-- advisory lock as the existing route/structure mutations.

create or replace function doc_private.doc_lock_media_lifecycle_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(810241, 1);
  return null;
end;
$$;
drop trigger if exists doc_documents_lock_media_lifecycle_mutation on public.doc_documents;
create trigger doc_documents_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_documents
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
drop trigger if exists doc_media_lock_media_lifecycle_mutation on public.doc_media;
create trigger doc_media_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_media
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
drop trigger if exists doc_sections_lock_media_lifecycle_mutation on public.doc_sections;
create trigger doc_sections_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_sections
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
drop trigger if exists doc_media_operations_lock_media_lifecycle_mutation on public.doc_media_operations;
create trigger doc_media_operations_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_media_operations
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
drop trigger if exists doc_media_operation_documents_lock_media_lifecycle_mutation on public.doc_media_operation_documents;
create trigger doc_media_operation_documents_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_media_operation_documents
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
drop trigger if exists doc_media_operation_items_lock_media_lifecycle_mutation on public.doc_media_operation_items;
create trigger doc_media_operation_items_lock_media_lifecycle_mutation
before insert or update or delete on public.doc_media_operation_items
for each statement execute function doc_private.doc_lock_media_lifecycle_mutation();
create or replace function public.doc_prepare_document_save(
  p_id uuid, p_section_id uuid, p_title text, p_slug text, p_excerpt text,
  p_content jsonb, p_status text, p_sort_order integer, p_expected_version bigint,
  p_media jsonb default '[]'::jsonb
)
returns table(operation_id uuid, finalized boolean, document_id uuid, version bigint, status text, path text)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_existing public.doc_documents%rowtype;
  v_operation_id uuid;
  v_removed_count integer;
  v_saved record;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  -- This must be the first lock acquired by every save path. In particular,
  -- do not lock the document row before section-delete preparation, which
  -- takes this advisory lock before freezing documents.
  perform pg_advisory_xact_lock(810241, 1);

  if exists (select 1 from public.doc_media_operation_documents as frozen where frozen.document_id = p_id) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;
  select * into v_existing from public.doc_documents where id = p_id for update;
  if found and (p_expected_version is null or p_expected_version <> v_existing.version) then
    raise exception 'The document has changed. Reload before saving.' using errcode = 'P0001';
  end if;
  if not found and p_expected_version is not null then
    raise exception 'The document was not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from doc_private.doc_content_media_ids(p_content) as ref
    where not exists (select 1 from public.doc_media as media where media.id = ref.media_id and media.document_id = p_id)
      and not exists (select 1 from jsonb_to_recordset(p_media) as item(id uuid) where item.id = ref.media_id)
  ) then
    raise exception 'The document references invalid media.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_media) as item(id uuid)
    where item.id is null
       or not exists (select 1 from doc_private.doc_content_media_ids(p_content) as ref where ref.media_id = item.id)
  ) then
    raise exception 'Uploaded media must be referenced by the document.' using errcode = '23514';
  end if;
  select count(*) into v_removed_count
  from public.doc_media as media
  where media.document_id = p_id
    and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(p_content) as ref);
  if v_removed_count = 0 then
    select * into v_saved from public.doc_save_document(p_id, p_section_id, p_title, p_slug, p_excerpt, p_content, p_status, p_sort_order, p_expected_version, p_media);
    return query select null::uuid, true, v_saved.document_id, v_saved.version, v_saved.status, v_saved.path;
    return;
  end if;
  v_operation_id := gen_random_uuid();
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  insert into public.doc_media_operations (id, kind, document_id, staged_save)
  values (v_operation_id, 'save_remove', p_id, jsonb_build_object(
    'section_id', p_section_id, 'title', p_title, 'slug', p_slug, 'excerpt', p_excerpt,
    'content', p_content, 'status', p_status, 'sort_order', p_sort_order,
    'expected_version', p_expected_version, 'media', p_media
  ));
  insert into public.doc_media_operation_documents(operation_id, document_id, expected_version)
  values (v_operation_id, p_id, v_existing.version);
  insert into public.doc_media_operation_items(operation_id, document_id, media_id, object_key, display_label)
  select v_operation_id, media.document_id, media.id, media.object_key,
         coalesce(nullif(media.id::text || '.webp', ''), media.object_key)
  from public.doc_media as media
  where media.document_id = p_id
    and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(p_content) as ref);
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);
  return query select v_operation_id, false, p_id, v_existing.version, v_existing.status, doc_private.doc_document_path(v_existing.section_id, v_existing.slug);
end;
$$;
create or replace function doc_private.doc_section_is_in_subtree(
  p_section_id uuid,
  p_root_section_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select p_section_id is not null
    and p_root_section_id is not null
    and (
      p_section_id = p_root_section_id
      or exists (
        select 1
        from public.doc_sections as section
        where section.id = p_section_id
          and section.parent_id = p_root_section_id
      )
    );
$$;
create or replace function doc_private.doc_section_has_pending_delete(
  p_section_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.doc_media_operations as operation
    where operation.kind = 'section_delete'
      and doc_private.doc_section_is_in_subtree(p_section_id, operation.section_id)
  );
$$;
create or replace function doc_private.doc_document_has_pending_media_operation(
  p_document_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select p_document_id is not null
    and exists (
      select 1
      from public.doc_media_operation_documents as frozen
      join public.doc_media_operations as operation on operation.id = frozen.operation_id
      where frozen.document_id = p_document_id
        and operation.kind in ('save_remove', 'document_delete')
    );
$$;
create or replace function doc_private.doc_reject_pending_section_delete_document_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(810241, 1);

  if (select doc_private.doc_section_has_pending_delete(new.section_id))
     or (
       tg_op = 'UPDATE'
       and (select doc_private.doc_section_has_pending_delete(old.section_id))
     ) then
    raise exception 'A section delete operation is pending.' using errcode = 'P0003';
  end if;

  return new;
end;
$$;
drop trigger if exists doc_documents_reject_pending_section_delete on public.doc_documents;
create trigger doc_documents_reject_pending_section_delete
before insert or update on public.doc_documents
for each row execute function doc_private.doc_reject_pending_section_delete_document_write();
create or replace function doc_private.doc_reject_pending_section_delete_media_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_new_document_id uuid;
  v_old_document_id uuid;
  v_new_section_id uuid;
  v_old_section_id uuid;
begin
  perform pg_advisory_xact_lock(810241, 1);

  if tg_op <> 'DELETE' then
    v_new_document_id := new.document_id;
    select document.section_id
    into v_new_section_id
    from public.doc_documents as document
    where document.id = new.document_id;
  end if;

  if tg_op <> 'INSERT' then
    v_old_document_id := old.document_id;
    select document.section_id
    into v_old_section_id
    from public.doc_documents as document
    where document.id = old.document_id;
  end if;

  if (select doc_private.doc_section_has_pending_delete(v_new_section_id))
     or (select doc_private.doc_section_has_pending_delete(v_old_section_id)) then
    raise exception 'A section delete operation is pending.' using errcode = 'P0003';
  end if;

  if coalesce(current_setting('doc_private.allow_frozen_document_media_mutation', true), '') <> 'on'
     and (
       (select doc_private.doc_document_has_pending_media_operation(v_new_document_id))
       or (select doc_private.doc_document_has_pending_media_operation(v_old_document_id))
     ) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists doc_media_reject_pending_section_delete on public.doc_media;
create trigger doc_media_reject_pending_section_delete
before insert or update or delete on public.doc_media
for each row execute function doc_private.doc_reject_pending_section_delete_media_write();
create or replace function doc_private.doc_reject_pending_section_delete_section_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(810241, 1);

  if (
       tg_op in ('UPDATE', 'DELETE')
       and (select doc_private.doc_section_has_pending_delete(old.id))
     )
     or (
       tg_op <> 'DELETE'
       and
       new.parent_id is not null
       and (select doc_private.doc_section_has_pending_delete(new.parent_id))
     ) then
    raise exception 'A section delete operation is pending.' using errcode = 'P0003';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists doc_sections_reject_pending_section_delete on public.doc_sections;
create trigger doc_sections_reject_pending_section_delete
before insert or update or delete on public.doc_sections
for each row execute function doc_private.doc_reject_pending_section_delete_section_write();
create or replace function doc_private.doc_reject_overlapping_media_operation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_staged_section_id uuid;
begin
  if tg_op in ('INSERT', 'DELETE')
     and coalesce(current_setting('doc_private.allow_media_operation_snapshot_write', true), '') <> 'on' then
    -- Preserve the RLS denial for non-admin INSERT attempts; authenticated
    -- administrators must use the lifecycle RPCs to create/cancel work.
    if tg_op = 'INSERT' and not (select doc_private.doc_is_admin()) then
      return new;
    end if;

    raise exception 'A media operation snapshot cannot be changed directly.' using errcode = 'P0003';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.kind is distinct from old.kind
       or new.document_id is distinct from old.document_id
       or new.section_id is distinct from old.section_id
       or new.staged_save is distinct from old.staged_save then
      raise exception 'A media operation target cannot be changed.' using errcode = 'P0003';
    end if;

    return new;
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  if new.kind = 'save_remove' then
    v_staged_section_id := (new.staged_save ->> 'section_id')::uuid;

    if (select doc_private.doc_section_has_pending_delete(v_staged_section_id)) then
      raise exception 'A section delete operation is pending.' using errcode = 'P0003';
    end if;
  elsif new.kind = 'section_delete' and exists (
    select 1
    from public.doc_media_operations as operation
    where operation.kind = 'save_remove'
      and doc_private.doc_section_is_in_subtree(
        (operation.staged_save ->> 'section_id')::uuid,
        new.section_id
      )
  ) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;

  return new;
end;
$$;
drop trigger if exists doc_media_operations_reject_overlap on public.doc_media_operations;
create trigger doc_media_operations_reject_overlap
before insert or update or delete on public.doc_media_operations
for each row execute function doc_private.doc_reject_overlapping_media_operation();
create or replace function doc_private.doc_reject_direct_media_operation_snapshot_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(810241, 1);

  if coalesce(current_setting('doc_private.allow_media_operation_snapshot_write', true), '') <> 'on' then
    raise exception 'A media operation snapshot cannot be changed directly.' using errcode = 'P0003';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists doc_media_operation_documents_reject_direct_write on public.doc_media_operation_documents;
create trigger doc_media_operation_documents_reject_direct_write
before insert or update or delete on public.doc_media_operation_documents
for each row execute function doc_private.doc_reject_direct_media_operation_snapshot_write();
drop trigger if exists doc_media_operation_items_reject_direct_write on public.doc_media_operation_items;
create trigger doc_media_operation_items_reject_direct_write
before insert or update or delete on public.doc_media_operation_items
for each row execute function doc_private.doc_reject_direct_media_operation_snapshot_write();
create or replace function public.doc_finalize_document_save(p_operation_id uuid)
returns table(document_id uuid, version bigint, status text, path text)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_operation public.doc_media_operations%rowtype;
  v_frozen public.doc_media_operation_documents%rowtype;
  v_saved record;
  v_current_removal_set jsonb;
  v_manifest_media_set jsonb;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  select * into v_operation from public.doc_media_operations where id = p_operation_id for update;
  if not found or v_operation.kind <> 'save_remove' then
    raise exception 'The media operation was not found.' using errcode = 'P0002';
  end if;
  select * into v_frozen from public.doc_media_operation_documents as frozen where frozen.operation_id = p_operation_id for update;
  perform media.id
  from public.doc_media as media
  where media.document_id = v_operation.document_id
    and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(v_operation.staged_save -> 'content') as ref)
  order by media.id
  for update;
  select coalesce(
    jsonb_agg(jsonb_build_array(media.document_id, media.id, media.object_key) order by media.document_id, media.id, media.object_key),
    '[]'::jsonb
  )
  into v_current_removal_set
  from public.doc_media as media
  where media.document_id = v_operation.document_id
    and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(v_operation.staged_save -> 'content') as ref);
  select coalesce(
    jsonb_agg(jsonb_build_array(item.document_id, item.media_id, item.object_key) order by item.document_id, item.media_id, item.object_key),
    '[]'::jsonb
  )
  into v_manifest_media_set
  from public.doc_media_operation_items as item
  where item.operation_id = p_operation_id;
  if v_current_removal_set is distinct from v_manifest_media_set then
    raise exception 'The document media changed. Retry saving.' using errcode = 'P0001';
  end if;
  perform set_config('doc_private.allow_media_removal', 'on', true);
  perform set_config('doc_private.allow_frozen_document_media_mutation', 'on', true);
  select * into v_saved from public.doc_save_document(
    v_operation.document_id,
    (v_operation.staged_save ->> 'section_id')::uuid,
    v_operation.staged_save ->> 'title', v_operation.staged_save ->> 'slug', v_operation.staged_save ->> 'excerpt',
    v_operation.staged_save -> 'content', v_operation.staged_save ->> 'status',
    (v_operation.staged_save ->> 'sort_order')::integer, v_frozen.expected_version,
    v_operation.staged_save -> 'media'
  );
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  delete from public.doc_media_operation_items where operation_id = p_operation_id;
  delete from public.doc_media where id in (
    select media.id
    from public.doc_media as media
    where media.document_id = v_operation.document_id
      and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(v_operation.staged_save -> 'content') as ref)
  );
  delete from public.doc_media_operations where id = p_operation_id;
  perform set_config('doc_private.allow_frozen_document_media_mutation', 'off', true);
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);
  return query select v_saved.document_id, v_saved.version, v_saved.status, v_saved.path;
end;
$$;
create or replace function public.doc_prepare_document_delete(p_document_id uuid, p_expected_version bigint)
returns table(operation_id uuid, media_count bigint)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_document public.doc_documents%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  if exists (select 1 from public.doc_media_operation_documents as frozen where frozen.document_id = p_document_id) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;
  select * into v_document from public.doc_documents where id = p_document_id for update;
  if not found then
    raise exception 'The document was not found.' using errcode = 'P0002';
  end if;
  if v_document.version <> p_expected_version then
    raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001';
  end if;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  insert into public.doc_media_operations(id, kind, document_id) values(v_id, 'document_delete', p_document_id);
  insert into public.doc_media_operation_documents(operation_id, document_id, expected_version) values(v_id, p_document_id, v_document.version);
  insert into public.doc_media_operation_items(operation_id, document_id, media_id, object_key, display_label)
    select v_id, media.document_id, media.id, media.object_key, media.id::text || '.webp'
    from public.doc_media as media
    where media.document_id = p_document_id;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);
  return query select v_id, (select count(*) from public.doc_media_operation_items as item where item.operation_id = v_id);
end;
$$;
create or replace function public.doc_finalize_document_delete(p_operation_id uuid)
returns table(document_id uuid)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_operation public.doc_media_operations%rowtype;
  v_frozen public.doc_media_operation_documents%rowtype;
  v_current_media_set jsonb;
  v_manifest_media_set jsonb;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  select * into v_operation from public.doc_media_operations where id = p_operation_id for update;
  if not found or v_operation.kind <> 'document_delete' then
    raise exception 'The media operation was not found.' using errcode = 'P0002';
  end if;
  select * into v_frozen from public.doc_media_operation_documents as frozen where frozen.operation_id = p_operation_id for update;
  if (select version from public.doc_documents where id = v_frozen.document_id for update) <> v_frozen.expected_version then
    raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001';
  end if;
  perform media.id
  from public.doc_media as media
  where media.document_id = v_frozen.document_id
  order by media.id
  for update;
  select coalesce(
    jsonb_agg(jsonb_build_array(media.document_id, media.id, media.object_key) order by media.document_id, media.id, media.object_key),
    '[]'::jsonb
  )
  into v_current_media_set
  from public.doc_media as media
  where media.document_id = v_frozen.document_id;
  select coalesce(
    jsonb_agg(jsonb_build_array(item.document_id, item.media_id, item.object_key) order by item.document_id, item.media_id, item.object_key),
    '[]'::jsonb
  )
  into v_manifest_media_set
  from public.doc_media_operation_items as item
  where item.operation_id = p_operation_id;
  if v_current_media_set is distinct from v_manifest_media_set then
    raise exception 'The document media changed. Retry deletion.' using errcode = 'P0001';
  end if;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  perform set_config('doc_private.allow_frozen_document_media_mutation', 'on', true);
  delete from public.doc_media_operations where id = p_operation_id;
  delete from public.doc_route_redirects as redirect where redirect.document_id = v_frozen.document_id;
  delete from public.doc_media as media where media.document_id = v_frozen.document_id;
  delete from public.doc_documents where id = v_frozen.document_id;
  perform set_config('doc_private.allow_frozen_document_media_mutation', 'off', true);
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);
  return query select v_frozen.document_id;
end;
$$;
create or replace function public.doc_prepare_section_delete(p_section_id uuid, p_confirmed_title text)
returns table(operation_id uuid, document_count bigint, media_count bigint)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_title text;
  v_id uuid := gen_random_uuid();
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(810241, 1);
  select title into v_title from public.doc_sections where id = p_section_id for update;
  if not found then
    raise exception 'The section was not found.' using errcode = 'P0002';
  end if;
  if v_title is distinct from p_confirmed_title then
    raise exception 'The confirmation name does not match.' using errcode = '23514';
  end if;
  if exists (select 1 from public.doc_media_operations where section_id = p_section_id) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;
  if exists (
    select 1
    from public.doc_media_operations as operation
    where operation.kind = 'section_delete'
      and (
        doc_private.doc_section_is_in_subtree(p_section_id, operation.section_id)
        or doc_private.doc_section_is_in_subtree(operation.section_id, p_section_id)
      )
  ) then
    raise exception 'An overlapping section delete operation is pending.' using errcode = 'P0003';
  end if;
  if exists (
    select 1
    from public.doc_documents as document
    join public.doc_media_operation_documents as frozen on frozen.document_id = document.id
    where doc_private.doc_section_is_in_subtree(document.section_id, p_section_id)
  ) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;
  if exists (
    select 1
    from public.doc_media_operations as operation
    where operation.kind = 'save_remove'
      and doc_private.doc_section_is_in_subtree(
        (operation.staged_save ->> 'section_id')::uuid,
        p_section_id
      )
  ) then
    raise exception 'A media operation is pending.' using errcode = 'P0003';
  end if;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  insert into public.doc_media_operations(id, kind, section_id) values(v_id, 'section_delete', p_section_id);
  insert into public.doc_media_operation_documents(operation_id, document_id, expected_version)
    select v_id, document.id, document.version
    from public.doc_documents as document
    where doc_private.doc_section_is_in_subtree(document.section_id, p_section_id);
  insert into public.doc_media_operation_items(operation_id, document_id, media_id, object_key, display_label)
    select v_id, media.document_id, media.id, media.object_key, media.id::text || '.webp'
    from public.doc_media as media
    join public.doc_media_operation_documents as frozen on frozen.document_id = media.document_id
    where frozen.operation_id = v_id;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);
  return query select v_id,
    (select count(*) from public.doc_media_operation_documents as frozen where frozen.operation_id = v_id),
    (select count(*) from public.doc_media_operation_items as item where item.operation_id = v_id);
end;
$$;
create or replace function public.doc_finalize_section_delete(p_operation_id uuid)
returns table(section_id uuid)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_operation public.doc_media_operations%rowtype;
  v_current_document_ids uuid[];
  v_frozen_document_ids uuid[];
  v_current_media_set jsonb;
  v_manifest_media_set jsonb;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(810241, 1);

  select *
  into v_operation
  from public.doc_media_operations
  where id = p_operation_id
  for update;

  if not found or v_operation.kind <> 'section_delete' then
    raise exception 'The media operation was not found.' using errcode = 'P0002';
  end if;

  perform section.id
  from public.doc_sections as section
  where section.id = v_operation.section_id
     or section.parent_id = v_operation.section_id
  order by section.id
  for update;

  perform document.id
  from public.doc_documents as document
  where doc_private.doc_section_is_in_subtree(document.section_id, v_operation.section_id)
  order by document.id
  for update;

  select coalesce(array_agg(document.id order by document.id), array[]::uuid[])
  into v_current_document_ids
  from public.doc_documents as document
  where doc_private.doc_section_is_in_subtree(document.section_id, v_operation.section_id);

  select coalesce(array_agg(frozen.document_id order by frozen.document_id), array[]::uuid[])
  into v_frozen_document_ids
  from public.doc_media_operation_documents as frozen
  where frozen.operation_id = p_operation_id;

  if v_current_document_ids is distinct from v_frozen_document_ids then
    raise exception 'The section contents changed. Retry deletion.' using errcode = 'P0001';
  end if;

  perform media.id
  from public.doc_media as media
  where media.document_id = any(v_current_document_ids)
  order by media.document_id, media.id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_array(media.document_id, media.id, media.object_key)
      order by media.document_id, media.id, media.object_key
    ),
    '[]'::jsonb
  )
  into v_current_media_set
  from public.doc_media as media
  where media.document_id = any(v_current_document_ids);

  select coalesce(
    jsonb_agg(
      jsonb_build_array(item.document_id, item.media_id, item.object_key)
      order by item.document_id, item.media_id, item.object_key
    ),
    '[]'::jsonb
  )
  into v_manifest_media_set
  from public.doc_media_operation_items as item
  where item.operation_id = p_operation_id;

  if v_current_media_set is distinct from v_manifest_media_set then
    raise exception 'The section media changed. Retry deletion.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.doc_media_operation_documents as frozen
    join public.doc_documents as document on document.id = frozen.document_id
    where frozen.operation_id = p_operation_id
      and document.version <> frozen.expected_version
  ) then
    raise exception 'A document has changed. Retry deletion.' using errcode = 'P0001';
  end if;

  perform set_config('doc_private.allow_media_operation_snapshot_write', 'on', true);
  delete from public.doc_media_operations
  where id = p_operation_id;
  perform set_config('doc_private.allow_media_operation_snapshot_write', 'off', true);

  delete from public.doc_route_redirects as redirect
  where redirect.document_id = any(v_frozen_document_ids);

  delete from public.doc_media as media
  where media.document_id = any(v_frozen_document_ids);

  delete from public.doc_documents as document
  where document.id = any(v_frozen_document_ids);

  delete from public.doc_sections as child
  where child.parent_id = v_operation.section_id;

  delete from public.doc_sections as section
  where section.id = v_operation.section_id;

  return query select v_operation.section_id;
end;
$$;
revoke all on function doc_private.doc_section_is_in_subtree(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_section_has_pending_delete(uuid) from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_document_has_pending_media_operation(uuid) from public, anon, authenticated, service_role;
grant execute on function doc_private.doc_section_is_in_subtree(uuid, uuid) to authenticated;
grant execute on function doc_private.doc_section_has_pending_delete(uuid) to authenticated;
grant execute on function doc_private.doc_document_has_pending_media_operation(uuid) to authenticated;
revoke all on function doc_private.doc_reject_pending_section_delete_document_write() from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_reject_pending_section_delete_media_write() from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_reject_pending_section_delete_section_write() from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_reject_overlapping_media_operation() from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_lock_media_lifecycle_mutation() from public, anon, authenticated, service_role;
revoke all on function doc_private.doc_reject_direct_media_operation_snapshot_write() from public, anon, authenticated, service_role;
