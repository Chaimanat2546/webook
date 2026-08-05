-- Corporate and Hospitality reserve five columns for totals so Thai labels and
-- currency amounts remain on one line. The remaining settlement column is seven.
create or replace function private.canonical_quotation_layout(p_template_key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_template_key
    when 'current' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
    when 'hospitality' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":7},{"id":"summary","zone":"settlement","column":8,"order":10,"span":5},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":7},{"id":"certification","zone":"certification","column":1,"order":10,"span":12},{"id":"sellerFooter","zone":"footer","column":1,"order":10,"span":12}]}'::jsonb
    when 'corporate' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":6},{"id":"documentMetadata","zone":"header","column":7,"order":10,"span":6},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":7},{"id":"summary","zone":"settlement","column":8,"order":10,"span":5},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":7},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
  end;
$$;

create or replace function private.is_quotation_layout(p_value jsonb, p_template_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_template_key in ('current', 'hospitality', 'corporate')
    and jsonb_typeof(p_value) = 'object'
    and p_value ?& array['schemaVersion', 'blocks']
    and p_value - 'schemaVersion' - 'blocks' = '{}'::jsonb
    and p_value ->> 'schemaVersion' = '1'
    and jsonb_typeof(p_value -> 'blocks') = 'array'
    and jsonb_array_length(p_value -> 'blocks') = case when p_template_key = 'hospitality' then 9 else 8 end
    and not exists (
      select 1 from jsonb_array_elements(p_value -> 'blocks') as element(value)
      where jsonb_typeof(element.value) <> 'object'
        or not (element.value ?& array['id', 'zone', 'column', 'order', 'span'])
        or element.value - 'id' - 'zone' - 'column' - 'order' - 'span' <> '{}'::jsonb
        or element.value ->> 'id' not in ('seller', 'documentMetadata', 'customer', 'items', 'summary', 'paymentMethods', 'publicNotes', 'certification', 'sellerFooter')
        or (p_template_key <> 'hospitality' and element.value ->> 'id' = 'sellerFooter')
        or element.value ->> 'zone' not in ('header', 'body', 'settlement', 'footer', 'certification')
        or jsonb_typeof(element.value -> 'column') <> 'number'
        or jsonb_typeof(element.value -> 'order') <> 'number'
        or jsonb_typeof(element.value -> 'span') <> 'number'
        or element.value ->> 'column' !~ '^[1-9][0-9]*$'
        or element.value ->> 'order' !~ '^[1-9][0-9]*$'
        or element.value ->> 'span' !~ '^[1-9][0-9]*$'
        or (element.value ->> 'column')::integer > 12
        or (element.value ->> 'span')::integer > 12
        or (element.value ->> 'column')::integer + (element.value ->> 'span')::integer - 1 > 12
        or (element.value ->> 'order')::integer > 1000
        or mod((element.value ->> 'order')::integer, 10) <> 0
        or case element.value ->> 'id'
          when 'seller' then element.value ->> 'zone' <> 'header' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'documentMetadata' then element.value ->> 'zone' <> 'header' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'customer' then element.value ->> 'zone' <> 'body' or (element.value ->> 'span')::integer <> 12
          when 'items' then element.value ->> 'zone' <> 'body' or (element.value ->> 'span')::integer <> 12
          when 'summary' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'paymentMethods' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'publicNotes' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'certification' then element.value ->> 'zone' <> 'certification' or (element.value ->> 'span')::integer <> 12
          when 'sellerFooter' then element.value ->> 'zone' <> 'footer' or (element.value ->> 'span')::integer <> 12
          else true
        end
    )
    and not exists (
      select 1 from jsonb_array_elements(p_value -> 'blocks') as element(value)
      group by element.value ->> 'id' having count(*) <> 1
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_value -> 'blocks') with ordinality as left_block(value, ordinal_position)
      join jsonb_array_elements(p_value -> 'blocks') with ordinality as right_block(value, ordinal_position)
        on left_block.ordinal_position < right_block.ordinal_position
      where left_block.value ->> 'zone' = right_block.value ->> 'zone'
        and left_block.value ->> 'order' = right_block.value ->> 'order'
        and (left_block.value ->> 'column')::integer <= (right_block.value ->> 'column')::integer + (right_block.value ->> 'span')::integer - 1
        and (right_block.value ->> 'column')::integer <= (left_block.value ->> 'column')::integer + (left_block.value ->> 'span')::integer - 1
    );
$$;

-- Layout block dimensions are template-owned. Upgrade the current revision of
-- both new templates while retaining which side each account chose.
with latest as (
  select template.id, template.user_id, template.current_revision_number + 1 as revision_number,
    revision.layout_config,
    (select (block.value ->> 'column')::integer from jsonb_array_elements(revision.layout_config -> 'blocks') as block(value) where block.value ->> 'id' = 'summary') <
    (select (block.value ->> 'column')::integer from jsonb_array_elements(revision.layout_config -> 'blocks') as block(value) where block.value ->> 'id' = 'paymentMethods') as summary_is_left
  from public.quotation_document_templates as template
  join public.quotation_document_template_revisions as revision
    on revision.template_id = template.id and revision.revision_number = template.current_revision_number
  where template.template_key in ('corporate', 'hospitality')
    and (select block.value ->> 'span' from jsonb_array_elements(revision.layout_config -> 'blocks') as block(value) where block.value ->> 'id' = 'summary') = '4'
    and (select block.value ->> 'span' from jsonb_array_elements(revision.layout_config -> 'blocks') as block(value) where block.value ->> 'id' = 'paymentMethods') = '8'
    and (select block.value ->> 'span' from jsonb_array_elements(revision.layout_config -> 'blocks') as block(value) where block.value ->> 'id' = 'publicNotes') = '8'
), inserted_revisions as (
  insert into public.quotation_document_template_revisions (template_id, revision_number, layout_schema_version, layout_config, created_by)
  select latest.id, latest.revision_number, 1,
    jsonb_build_object('schemaVersion', latest.layout_config -> 'schemaVersion', 'blocks', (
      select jsonb_agg(
        case element.value ->> 'id'
          when 'summary' then jsonb_set(jsonb_set(element.value, '{span}', '5'::jsonb), '{column}', to_jsonb(case when latest.summary_is_left then 1 else 8 end))
          when 'paymentMethods' then jsonb_set(jsonb_set(element.value, '{span}', '7'::jsonb), '{column}', to_jsonb(case when latest.summary_is_left then 6 else 1 end))
          when 'publicNotes' then jsonb_set(jsonb_set(element.value, '{span}', '7'::jsonb), '{column}', to_jsonb(case when latest.summary_is_left then 6 else 1 end))
          else element.value
        end order by element.ordinality
      ) from jsonb_array_elements(latest.layout_config -> 'blocks') with ordinality as element(value, ordinality)
    )), latest.user_id
  from latest
  returning template_id, revision_number
)
update public.quotation_document_templates as template
set current_revision_number = inserted_revisions.revision_number, updated_at = now()
from inserted_revisions
where template.id = inserted_revisions.template_id;
