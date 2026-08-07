-- Existing bearer links that predate the expiry default cannot be safely
-- updated: some legacy quotation snapshots deliberately remain read-only
-- because they no longer pass the current validation rules. The public reader
-- below retires every link without an expiry instead. Newly created links use
-- the 30-day default installed by the previous hardening migration.

create or replace function private.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', q.id, 'document_number', q.document_number, 'issue_date', q.issue_date,
    'valid_until', q.valid_until, 'validity_days', q.validity_days,
    'reference', q.reference, 'subject', q.subject,
    'seller_snapshot', q.seller_snapshot, 'certification_snapshot', q.certification_snapshot,
    'document_display_snapshot', q.document_display_snapshot,
    'document_template_snapshot', q.document_template_snapshot,
    'document_template_revision_snapshot', q.document_template_revision_snapshot,
    'document_layout_schema_version_snapshot', q.document_layout_schema_version_snapshot,
    'document_layout_snapshot', q.document_layout_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')
    ),
    'withholding_tax_rate', q.withholding_tax_rate, 'public_notes', q.public_notes,
    'quotation_items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'position', i.position, 'name', i.name, 'description', i.description,
      'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price,
      'discount_amount', i.discount_amount, 'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate
    ) order by i.position) from public.quotation_items i where i.quotation_id = q.id), '[]'::jsonb),
    'quotation_payment_methods', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'type', p.type, 'position', p.position,
      'bank_code', case when p.type = 'bank_transfer' then p.bank_code else '' end,
      'bank_name', case when p.type = 'bank_transfer' then p.bank_name else '' end,
      'bank_logo_url', case when p.type = 'bank_transfer' then p.bank_logo_url else '' end,
      'custom_bank_name', case when p.type = 'bank_transfer' then p.custom_bank_name else '' end,
      'custom_bank_logo_url', case when p.type = 'bank_transfer' then p.custom_bank_logo_url else '' end,
      'account_number', case when p.type = 'bank_transfer' then p.account_number else '' end,
      'account_type', case when p.type = 'bank_transfer' then p.account_type else '' end,
      'account_name', case when p.type in ('bank_transfer', 'promptpay') then p.account_name else '' end,
      'promptpay_id', case when p.type = 'promptpay' then p.promptpay_id else '' end,
      'provider_name', case when p.type in ('qr_payment', 'other') then p.provider_name else '' end,
      'instructions', p.instructions, 'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end,
      'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end
    ) order by p.position) from public.quotation_payment_methods p where p.quotation_id = q.id), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null
    and q.public_token_revoked_at is null
    and q.public_token_expires_at > now();
$$;

drop policy if exists "Quotation users read owned document templates" on public.quotation_document_templates;
create policy "Quotation users read owned document templates"
on public.quotation_document_templates
for select
to authenticated
using (
  (select private.has_quotation_permission())
  and user_id = (select auth.uid())
);

drop policy if exists "Quotation users read owned document template revisions" on public.quotation_document_template_revisions;
create policy "Quotation users read owned document template revisions"
on public.quotation_document_template_revisions
for select
to authenticated
using (
  (select private.has_quotation_permission())
  and exists (
    select 1
    from public.quotation_document_templates template
    where template.id = quotation_document_template_revisions.template_id
      and template.user_id = (select auth.uid())
  )
);
