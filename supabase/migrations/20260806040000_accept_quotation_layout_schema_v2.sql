-- Theme-enabled quotation layouts use schema version 2. The save wrapper must
-- accept that same version before matching the immutable revision snapshot.
create or replace function private.save_quotation_with_template(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template text := btrim(coalesce(p_payload ->> 'document_template_snapshot', ''));
  v_source_id uuid := nullif(p_payload ->> 'document_template_source_id', '')::uuid;
  v_revision_number bigint := nullif(p_payload ->> 'document_template_revision_snapshot', '')::bigint;
  v_schema_version integer := nullif(p_payload ->> 'document_layout_schema_version_snapshot', '')::integer;
  v_layout jsonb := p_payload -> 'document_layout_snapshot';
  v_saved record;
begin
  if not private.is_quotation_template(v_template)
    or v_source_id is null
    or v_revision_number is null
    or v_schema_version <> 2
    or not private.is_quotation_layout(v_layout, v_template) then
    raise exception using errcode = '22023', message = 'Invalid quotation document layout snapshot';
  end if;

  perform 1
  from public.quotation_document_templates template
  join public.quotation_document_template_revisions revision
    on revision.template_id = template.id and revision.revision_number = v_revision_number
  where template.id = v_source_id
    and template.user_id = auth.uid()
    and template.template_key = v_template
    and revision.layout_schema_version = v_schema_version
    and revision.layout_config = v_layout;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation document layout snapshot denied';
  end if;

  select * into v_saved from private.save_quotation_with_document_display(p_payload);
  update public.quotations quotation
  set document_template_snapshot = v_template,
      document_template_source_id = v_source_id,
      document_template_revision_snapshot = v_revision_number,
      document_layout_schema_version_snapshot = v_schema_version,
      document_layout_snapshot = v_layout
  where quotation.id = v_saved.id
    and quotation.created_by = auth.uid()
    and quotation.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation document layout update denied';
  end if;

  return query select v_saved.id, v_saved.document_number;
end;
$$;
