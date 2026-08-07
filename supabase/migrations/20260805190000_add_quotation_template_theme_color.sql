-- A layout revision owns one primary theme color. Rendering derives the light,
-- border, dark, and contrast shades so HTML, print, and PDF use one snapshot.

alter table public.quotations
  drop constraint if exists quotations_document_layout_snapshot_valid,
  drop constraint if exists quotations_snapshot_input_rules_valid;

alter function private.is_quotation_layout(jsonb, text)
  rename to is_quotation_layout_v1;

create or replace function private.is_quotation_layout(p_value jsonb, p_template_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog, private
as $$
  select jsonb_typeof(p_value) = 'object'
    and p_value ?& array['schemaVersion', 'blocks', 'themeColor']
    and p_value - 'schemaVersion' - 'blocks' - 'themeColor' = '{}'::jsonb
    and p_value ->> 'schemaVersion' = '2'
    and p_value ->> 'themeColor' ~ '^#[0-9A-Fa-f]{6}$'
    and private.is_quotation_layout_v1(
      jsonb_build_object(
        'schemaVersion', 1,
        'blocks', p_value -> 'blocks'
      ),
      p_template_key
    );
$$;

alter function private.canonical_quotation_layout(text)
  rename to canonical_quotation_layout_v1;

create or replace function private.canonical_quotation_layout(p_template_key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog, private
as $$
  select case
    when p_template_key in ('current', 'hospitality', 'corporate') then
      jsonb_build_object(
        'schemaVersion', 2,
        'themeColor', case p_template_key
          when 'current' then '#6366F1'
          when 'hospitality' then '#286A5B'
          when 'corporate' then '#142D4C'
        end,
        'blocks', private.canonical_quotation_layout_v1(p_template_key) -> 'blocks'
      )
  end;
$$;

update public.quotation_document_template_revisions as revision
set layout_schema_version = 2,
    layout_config = jsonb_build_object(
      'schemaVersion', 2,
      'themeColor', case template.template_key
        when 'current' then '#6366F1'
        when 'hospitality' then '#286A5B'
        when 'corporate' then '#142D4C'
      end,
      'blocks', revision.layout_config -> 'blocks'
    )
from public.quotation_document_templates as template
where template.id = revision.template_id
  and revision.layout_schema_version = 1;

update public.quotations
set document_layout_schema_version_snapshot = 2,
    document_layout_snapshot = jsonb_build_object(
      'schemaVersion', 2,
      'themeColor', case document_template_snapshot
        when 'current' then '#6366F1'
        when 'hospitality' then '#286A5B'
        when 'corporate' then '#142D4C'
      end,
      'blocks', document_layout_snapshot -> 'blocks'
    )
where document_layout_schema_version_snapshot = 1;

alter table public.quotations
  add constraint quotations_document_layout_snapshot_valid
  check (private.is_quotation_layout(document_layout_snapshot, document_template_snapshot));

-- Preserve legacy rows that predate the snapshot input rule. New and changed
-- quotation payloads still have to satisfy the same rule.
alter table public.quotations
  add constraint quotations_snapshot_input_rules_valid check (
    jsonb_typeof(seller_snapshot) = 'object'
    and jsonb_typeof(customer_snapshot) = 'object'
    and coalesce(seller_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(customer_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(seller_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and coalesce(customer_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and (seller_snapshot ->> 'officeType' <> 'branch' or btrim(coalesce(seller_snapshot ->> 'branchNumber', '')) <> '')
    and (customer_snapshot ->> 'officeType' <> 'branch' or btrim(coalesce(customer_snapshot ->> 'branchNumber', '')) <> '')
  ) not valid;

create or replace function private.ensure_quotation_document_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template_id uuid;
  v_template_key text;
begin
  foreach v_template_key in array array['current', 'hospitality', 'corporate'] loop
    insert into public.quotation_document_templates (user_id, template_key, current_revision_number)
    values (p_user_id, v_template_key, 1)
    on conflict (user_id, template_key) do nothing
    returning id into v_template_id;

    if found then
      insert into public.quotation_document_template_revisions (
        template_id, revision_number, layout_schema_version, layout_config, created_by
      ) values (
        v_template_id, 1, 2, private.canonical_quotation_layout(v_template_key), p_user_id
      );
    end if;
  end loop;
end;
$$;

create or replace function public.publish_quotation_document_template_layout(
  p_template_key text,
  p_expected_revision_number bigint,
  p_layout_config jsonb
)
returns table (template_id uuid, revision_number bigint, layout_config jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template record;
  v_revision_number bigint;
begin
  if auth.uid() is null or p_template_key not in ('current', 'hospitality', 'corporate') then
    raise exception using errcode = '42501', message = 'Quotation layout publication denied';
  end if;
  if not private.is_quotation_layout(p_layout_config, p_template_key) then
    raise exception using errcode = '22023', message = 'Invalid quotation layout';
  end if;

  select id, current_revision_number
  into v_template
  from public.quotation_document_templates
  where user_id = auth.uid() and template_key = p_template_key
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Quotation layout template not found';
  end if;
  if p_expected_revision_number <> v_template.current_revision_number then
    raise exception using errcode = '40001', message = 'Quotation layout revision conflict';
  end if;

  v_revision_number := v_template.current_revision_number + 1;
  insert into public.quotation_document_template_revisions (
    template_id, revision_number, layout_schema_version, layout_config, created_by
  ) values (v_template.id, v_revision_number, 2, p_layout_config, auth.uid());

  update public.quotation_document_templates
  set current_revision_number = v_revision_number, updated_at = now()
  where id = v_template.id;

  return query select v_template.id, v_revision_number, p_layout_config;
end;
$$;
