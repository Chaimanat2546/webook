-- Current uses the same two-row settlement composition as the other templates:
-- payment methods + notes on the left and the total summary spanning both rows on the right.
create or replace function private.canonical_quotation_layout(p_template_key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_template_key
    when 'current' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
    when 'hospitality' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12},{"id":"sellerFooter","zone":"footer","column":1,"order":10,"span":12}]}'::jsonb
    when 'corporate' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":6},{"id":"documentMetadata","zone":"header","column":7,"order":10,"span":6},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
  end;
$$;

-- Upgrade only untouched Current defaults. Custom account layouts and already-issued
-- quotation snapshots intentionally remain unchanged.
with legacy_current_layout as (
  select '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"summary","zone":"settlement","column":1,"order":10,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":20,"span":12},{"id":"publicNotes","zone":"settlement","column":1,"order":30,"span":12},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb as config
), upgraded_templates as (
  select template.id, template.user_id, template.current_revision_number + 1 as revision_number
  from public.quotation_document_templates as template
  join public.quotation_document_template_revisions as revision
    on revision.template_id = template.id
   and revision.revision_number = template.current_revision_number
  cross join legacy_current_layout
  where template.template_key = 'current'
    and revision.layout_config = legacy_current_layout.config
), inserted_revisions as (
  insert into public.quotation_document_template_revisions (
    template_id, revision_number, layout_schema_version, layout_config, created_by
  )
  select id, revision_number, 1, private.canonical_quotation_layout('current'), user_id
  from upgraded_templates
  returning template_id, revision_number
)
update public.quotation_document_templates as template
set current_revision_number = inserted_revisions.revision_number,
    updated_at = now()
from inserted_revisions
where template.id = inserted_revisions.template_id;
