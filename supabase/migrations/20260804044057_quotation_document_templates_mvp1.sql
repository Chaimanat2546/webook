alter table public.quotation_company_profiles
  add column document_template_default text not null default 'current',
  add constraint quotation_company_profiles_document_template_default_valid
    check (document_template_default in ('current', 'hospitality', 'corporate'));

alter table public.quotations
  add column document_template_snapshot text not null default 'current',
  add constraint quotations_document_template_snapshot_valid
    check (document_template_snapshot in ('current', 'hospitality', 'corporate'));

create function private.is_quotation_template(value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select value in ('current', 'hospitality', 'corporate');
$$;

grant select (document_template_default)
  on public.quotation_company_profiles to authenticated;
grant update (document_template_default)
  on public.quotation_company_profiles to authenticated;

create function private.save_quotation_with_template(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template text := btrim(coalesce(p_payload ->> 'document_template_snapshot', ''));
  v_saved record;
begin
  if not private.is_quotation_template(v_template) then
    raise exception using
      errcode = '22023',
      message = 'Invalid quotation document template';
  end if;

  select *
  into v_saved
  from private.save_quotation_with_document_display(p_payload);

  update public.quotations q
  set document_template_snapshot = v_template
  where q.id = v_saved.id
    and q.created_by = auth.uid()
    and q.deleted_at is null;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Quotation document template update denied';
  end if;

  return query select v_saved.id, v_saved.document_number;
end;
$$;

create or replace function public.save_quotation_with_payments(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select *
  from private.save_quotation_with_template(p_payload);
$$;

create or replace function public.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select *
  from private.save_quotation_with_template(p_payload);
$$;

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
    'seller_snapshot', q.seller_snapshot,
    'certification_snapshot', q.certification_snapshot,
    'document_display_snapshot', q.document_display_snapshot,
    'document_template_snapshot', q.document_template_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')
    ),
    'withholding_tax_rate', q.withholding_tax_rate,
    'public_notes', q.public_notes,
    'quotation_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'position', i.position, 'name', i.name,
        'description', i.description, 'quantity', i.quantity, 'unit', i.unit,
        'unit_price', i.unit_price, 'discount_amount', i.discount_amount,
        'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i where i.quotation_id = q.id
    ), '[]'::jsonb),
    'quotation_payment_methods', coalesce((
      select jsonb_agg(jsonb_build_object(
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
        'instructions', p.instructions,
        'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end,
        'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end
      ) order by p.position)
      from public.quotation_payment_methods p where p.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token and q.deleted_at is null;
$$;

revoke all on function private.is_quotation_template(text) from public, anon;
revoke all on function private.save_quotation_with_template(jsonb) from public, anon;
revoke all on function public.save_quotation(jsonb) from public, anon;
revoke all on function public.save_quotation_with_payments(jsonb) from public, anon;
grant execute on function private.save_quotation_with_template(jsonb) to authenticated;
grant execute on function public.save_quotation(jsonb) to authenticated;
grant execute on function public.save_quotation_with_payments(jsonb) to authenticated;
