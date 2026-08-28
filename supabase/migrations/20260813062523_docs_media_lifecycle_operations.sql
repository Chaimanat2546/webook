-- M06 durable cleanup operations. R2 is always called by the application only
-- after an exact-key manifest/claim has been persisted here.

create or replace function public.doc_record_media_cleanup(
  p_document_id uuid,
  p_items jsonb,
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_document_id is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100
     or p_error is null or length(btrim(p_error)) = 0 then
    raise exception 'The cleanup input is invalid.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(object_key text, display_label text)
    where object_key is null
       or object_key !~ ('^docs/' || p_document_id::text || '/[0-9a-f-]{36}\.webp$')
       or display_label is null or length(btrim(display_label)) = 0
  ) then
    raise exception 'The cleanup input is invalid.' using errcode = '23514';
  end if;

  insert into public.doc_media_cleanup (document_id, object_key, display_label, last_error)
  select p_document_id, item.object_key, btrim(item.display_label), btrim(p_error)
  from jsonb_to_recordset(p_items) as item(object_key text, display_label text)
  on conflict (object_key) do update
    set display_label = excluded.display_label,
        last_error = excluded.last_error,
        claim_token = null,
        claim_expires_at = null;
end;
$$;
create or replace function public.doc_claim_media_cleanup(
  p_document_id uuid default null,
  p_limit integer default 100
)
returns table(claim_token uuid, document_id uuid, object_key text, display_label text, attempt_count integer)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_claim_token uuid := gen_random_uuid();
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return query
  with candidates as (
    select cleanup.id
    from public.doc_media_cleanup as cleanup
    where (p_document_id is null or cleanup.document_id = p_document_id)
      and (cleanup.claim_expires_at is null or cleanup.claim_expires_at < now())
    order by cleanup.created_at, cleanup.id
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
    for update skip locked
  )
  update public.doc_media_cleanup as cleanup
  set claim_token = v_claim_token,
      claim_expires_at = now() + interval '5 minutes',
      last_attempt_at = now()
  from candidates
  where cleanup.id = candidates.id
  returning v_claim_token, cleanup.document_id, cleanup.object_key, cleanup.display_label, cleanup.attempt_count;
end;
$$;
create or replace function public.doc_complete_media_cleanup(
  p_claim_token uuid,
  p_object_keys text[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_claim_token is null or coalesce(array_length(p_object_keys, 1), 0) = 0 then
    raise exception 'The cleanup claim is invalid.' using errcode = '23514';
  end if;
  delete from public.doc_media_cleanup
  where claim_token = p_claim_token and object_key = any(p_object_keys);
end;
$$;
create or replace function public.doc_fail_media_cleanup(
  p_claim_token uuid,
  p_object_keys text[],
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_claim_token is null or coalesce(array_length(p_object_keys, 1), 0) = 0
     or p_error is null or length(btrim(p_error)) = 0 then
    raise exception 'The cleanup claim is invalid.' using errcode = '23514';
  end if;
  update public.doc_media_cleanup
  set claim_token = null,
      claim_expires_at = null,
      last_error = btrim(p_error),
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
  where claim_token = p_claim_token and object_key = any(p_object_keys);
end;
$$;
revoke all on function public.doc_record_media_cleanup(uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.doc_claim_media_cleanup(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.doc_complete_media_cleanup(uuid, text[]) from public, anon, authenticated, service_role;
revoke all on function public.doc_fail_media_cleanup(uuid, text[], text) from public, anon, authenticated, service_role;
grant execute on function public.doc_record_media_cleanup(uuid, jsonb, text) to authenticated;
grant execute on function public.doc_claim_media_cleanup(uuid, integer) to authenticated;
grant execute on function public.doc_complete_media_cleanup(uuid, text[]) to authenticated;
grant execute on function public.doc_fail_media_cleanup(uuid, text[], text) to authenticated;
create or replace function doc_private.doc_content_media_ids(p_content jsonb)
returns table(media_id uuid)
language sql
security invoker
set search_path = pg_catalog
as $$
  with recursive nodes(node) as (
    select p_content
    union all
    select child
    from nodes
    cross join lateral jsonb_array_elements(coalesce(nodes.node -> 'content', '[]'::jsonb)) as child
  )
  select (node -> 'attrs' ->> 'mediaId')::uuid
  from nodes
  where node ->> 'type' = 'image'
    and node -> 'attrs' ->> 'mediaId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;
-- Direct document writes must never make an existing object unreachable: such
-- a change has to go through the durable prepare/delete/finalize operation.
create or replace function doc_private.doc_reject_unprepared_media_removal()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if current_setting('doc_private.allow_media_removal', true) = 'on' then
    return new;
  end if;
  if exists (
    select 1
    from public.doc_media as media
    where media.document_id = new.id
      and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(new.content) as ref)
  ) then
    raise exception 'Remove media through a prepared media operation.' using errcode = 'P0003';
  end if;
  return new;
end;
$$;
drop trigger if exists doc_documents_reject_unprepared_media_removal on public.doc_documents;
create trigger doc_documents_reject_unprepared_media_removal
before update of content on public.doc_documents
for each row execute function doc_private.doc_reject_unprepared_media_removal();
create or replace function public.doc_get_media_operation(p_operation_id uuid)
returns table(operation_id uuid, kind text, target_id uuid, attempt_count integer, last_error text, items jsonb)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return query
  select operation.id, operation.kind, coalesce(operation.document_id, operation.section_id),
         operation.attempt_count, operation.last_error,
         coalesce(jsonb_agg(jsonb_build_object('documentId', item.document_id, 'objectKey', item.object_key, 'displayLabel', item.display_label)
           order by item.document_id, item.object_key) filter (where item.media_id is not null), '[]'::jsonb)
  from public.doc_media_operations as operation
  left join public.doc_media_operation_items as item on item.operation_id = operation.id
  where operation.id = p_operation_id
  group by operation.id;
end;
$$;
create or replace function public.doc_mark_media_operation_failed(p_operation_id uuid, p_error text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_error is null or length(btrim(p_error)) = 0 then
    raise exception 'The operation error is invalid.' using errcode = '23514';
  end if;
  update public.doc_media_operations
  set attempt_count = attempt_count + 1, last_attempt_at = now(), last_error = btrim(p_error)
  where id = p_operation_id;
end;
$$;
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
  return query select v_operation_id, false, p_id, v_existing.version, v_existing.status, doc_private.doc_document_path(v_existing.section_id, v_existing.slug);
end;
$$;
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
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select * into v_operation from public.doc_media_operations where id = p_operation_id for update;
  if not found or v_operation.kind <> 'save_remove' then raise exception 'The media operation was not found.' using errcode = 'P0002'; end if;
  select * into v_frozen from public.doc_media_operation_documents as frozen where frozen.operation_id = p_operation_id for update;
  perform set_config('doc_private.allow_media_removal', 'on', true);
  select * into v_saved from public.doc_save_document(
    v_operation.document_id,
    (v_operation.staged_save ->> 'section_id')::uuid,
    v_operation.staged_save ->> 'title', v_operation.staged_save ->> 'slug', v_operation.staged_save ->> 'excerpt',
    v_operation.staged_save -> 'content', v_operation.staged_save ->> 'status',
    (v_operation.staged_save ->> 'sort_order')::integer, v_frozen.expected_version,
    v_operation.staged_save -> 'media'
  );
  -- The operation items retain a foreign key to each media row.  Remove the
  -- durable work manifest only after R2 deletion has succeeded, then remove
  -- the now-unreferenced metadata before committing the staged document.
  delete from public.doc_media_operation_items where operation_id = p_operation_id;
  delete from public.doc_media where id in (
    select media.id
    from public.doc_media as media
    where media.document_id = v_operation.document_id
      and media.id not in (select ref.media_id from doc_private.doc_content_media_ids(v_operation.staged_save -> 'content') as ref)
  );
  delete from public.doc_media_operations where id = p_operation_id;
  return query select v_saved.document_id, v_saved.version, v_saved.status, v_saved.path;
end;
$$;
drop function public.doc_prepare_document_delete(uuid, bigint);
drop function public.doc_finalize_document_delete(uuid, bigint);
create function public.doc_prepare_document_delete(p_document_id uuid, p_expected_version bigint)
returns table(operation_id uuid, media_count bigint)
language plpgsql security invoker set search_path = pg_catalog as $$
declare v_document public.doc_documents%rowtype; v_id uuid := gen_random_uuid();
begin
  if not (select doc_private.doc_is_admin()) then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if exists (select 1 from public.doc_media_operation_documents as frozen where frozen.document_id = p_document_id) then raise exception 'A media operation is pending.' using errcode = 'P0003'; end if;
  select * into v_document from public.doc_documents where id = p_document_id for update;
  if not found then raise exception 'The document was not found.' using errcode = 'P0002'; end if;
  if v_document.version <> p_expected_version then raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001'; end if;
  insert into public.doc_media_operations(id, kind, document_id) values(v_id, 'document_delete', p_document_id);
  insert into public.doc_media_operation_documents(operation_id, document_id, expected_version) values(v_id, p_document_id, v_document.version);
  insert into public.doc_media_operation_items(operation_id, document_id, media_id, object_key, display_label)
    select v_id, media.document_id, media.id, media.object_key, media.id::text || '.webp' from public.doc_media media where media.document_id = p_document_id;
  return query select v_id, (select count(*) from public.doc_media_operation_items as item where item.operation_id = v_id);
end; $$;
create function public.doc_finalize_document_delete(p_operation_id uuid)
returns table(document_id uuid)
language plpgsql security invoker set search_path = pg_catalog as $$
declare v_operation public.doc_media_operations%rowtype; v_frozen public.doc_media_operation_documents%rowtype;
begin
  if not (select doc_private.doc_is_admin()) then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into v_operation from public.doc_media_operations where id=p_operation_id for update;
  if not found or v_operation.kind <> 'document_delete' then raise exception 'The media operation was not found.' using errcode = 'P0002'; end if;
  select * into v_frozen from public.doc_media_operation_documents as frozen where frozen.operation_id=p_operation_id for update;
  if (select version from public.doc_documents where id=v_frozen.document_id for update) <> v_frozen.expected_version then raise exception 'The document has changed. Reload before deleting.' using errcode = 'P0001'; end if;
  delete from public.doc_media_operations where id=p_operation_id;
  delete from public.doc_route_redirects as redirect where redirect.document_id=v_frozen.document_id;
  delete from public.doc_media as media where media.document_id=v_frozen.document_id;
  delete from public.doc_documents where id=v_frozen.document_id;
  return query select v_frozen.document_id;
end; $$;
create function public.doc_prepare_section_delete(p_section_id uuid, p_confirmed_title text)
returns table(operation_id uuid, document_count bigint, media_count bigint)
language plpgsql security invoker set search_path = pg_catalog as $$
declare v_title text; v_id uuid:=gen_random_uuid();
begin
  if not (select doc_private.doc_is_admin()) then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(810241, 1);
  select title into v_title from public.doc_sections where id=p_section_id for update;
  if not found then raise exception 'The section was not found.' using errcode='P0002'; end if;
  if v_title is distinct from p_confirmed_title then raise exception 'The confirmation name does not match.' using errcode='23514'; end if;
  if exists (select 1 from public.doc_media_operations where section_id=p_section_id) then raise exception 'A media operation is pending.' using errcode='P0003'; end if;
  if exists (
    select 1
    from public.doc_documents as document
    join public.doc_media_operation_documents as frozen on frozen.document_id = document.id
    where document.section_id = p_section_id
       or document.section_id in (select child.id from public.doc_sections as child where child.parent_id = p_section_id)
  ) then
    raise exception 'A media operation is pending.' using errcode='P0003';
  end if;
  insert into public.doc_media_operations(id, kind, section_id) values(v_id, 'section_delete', p_section_id);
  insert into public.doc_media_operation_documents(operation_id, document_id, expected_version)
    select v_id, document.id, document.version from public.doc_documents document where document.section_id=p_section_id or document.section_id in (select id from public.doc_sections where parent_id=p_section_id);
  insert into public.doc_media_operation_items(operation_id, document_id, media_id, object_key, display_label)
    select v_id, media.document_id, media.id, media.object_key, media.id::text || '.webp' from public.doc_media media join public.doc_media_operation_documents frozen on frozen.document_id=media.document_id where frozen.operation_id=v_id;
  return query select v_id, (select count(*) from public.doc_media_operation_documents as frozen where frozen.operation_id=v_id), (select count(*) from public.doc_media_operation_items as item where item.operation_id=v_id);
end; $$;
create function public.doc_finalize_section_delete(p_operation_id uuid)
returns table(section_id uuid)
language plpgsql security invoker set search_path = pg_catalog as $$
declare v_operation public.doc_media_operations%rowtype;
begin
  if not (select doc_private.doc_is_admin()) then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  select * into v_operation from public.doc_media_operations where id=p_operation_id for update;
  if not found or v_operation.kind <> 'section_delete' then raise exception 'The media operation was not found.' using errcode='P0002'; end if;
  if exists (select 1 from public.doc_media_operation_documents frozen join public.doc_documents document on document.id=frozen.document_id where frozen.operation_id=p_operation_id and document.version<>frozen.expected_version) then raise exception 'A document has changed. Retry deletion.' using errcode='P0001'; end if;
  delete from public.doc_media_operations where id=p_operation_id;
  delete from public.doc_route_redirects as redirect where redirect.document_id in (select document.id from public.doc_documents as document where document.section_id=v_operation.section_id or document.section_id in (select child.id from public.doc_sections as child where child.parent_id=v_operation.section_id));
  delete from public.doc_media as media where media.document_id in (select document.id from public.doc_documents as document where document.section_id=v_operation.section_id or document.section_id in (select child.id from public.doc_sections as child where child.parent_id=v_operation.section_id));
  delete from public.doc_documents as document where document.section_id=v_operation.section_id or document.section_id in (select child.id from public.doc_sections as child where child.parent_id=v_operation.section_id);
  delete from public.doc_sections as child where child.parent_id=v_operation.section_id;
  delete from public.doc_sections as section where section.id=v_operation.section_id;
  return query select v_operation.section_id;
end; $$;
revoke execute on function public.doc_delete_section(uuid, text) from authenticated;
revoke all on function doc_private.doc_content_media_ids(jsonb) from public;
grant execute on function doc_private.doc_content_media_ids(jsonb) to authenticated;
revoke all on function doc_private.doc_reject_unprepared_media_removal() from public;
revoke all on function public.doc_get_media_operation(uuid) from public, anon, authenticated, service_role;
revoke all on function public.doc_mark_media_operation_failed(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.doc_prepare_document_save(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.doc_finalize_document_save(uuid) from public, anon, authenticated, service_role;
revoke all on function public.doc_prepare_document_delete(uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function public.doc_finalize_document_delete(uuid) from public, anon, authenticated, service_role;
revoke all on function public.doc_prepare_section_delete(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.doc_finalize_section_delete(uuid) from public, anon, authenticated, service_role;
grant execute on function public.doc_get_media_operation(uuid), public.doc_mark_media_operation_failed(uuid, text), public.doc_prepare_document_save(uuid, uuid, text, text, text, jsonb, text, integer, bigint, jsonb), public.doc_finalize_document_save(uuid), public.doc_prepare_document_delete(uuid, bigint), public.doc_finalize_document_delete(uuid), public.doc_prepare_section_delete(uuid, text), public.doc_finalize_section_delete(uuid) to authenticated;
