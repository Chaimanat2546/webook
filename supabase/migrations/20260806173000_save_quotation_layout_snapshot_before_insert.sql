-- A quotation layout is an immutable part of the quotation document. The
-- constraint is evaluated at insert time, so snapshot values must be written
-- by the base save boundary rather than by a later wrapper.
create or replace function private.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_document_number text;
  v_item jsonb;
  v_updated integer;
  v_expected_gross numeric;
  v_expected_discount numeric;
  v_expected_pre_tax numeric;
  v_expected_vat numeric;
  v_expected_grand numeric;
  v_expected_withholding numeric;
  v_expected_due numeric;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' or jsonb_array_length(p_payload -> 'items') not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;
  select sum(item.gross), sum(item.discount), sum(item.gross - item.discount), sum(case when item.vat_treatment = 'taxable' then round((item.gross - item.discount) * item.vat_rate / 100, 2) else 0 end)
  into v_expected_gross, v_expected_discount, v_expected_pre_tax, v_expected_vat
  from (
    select round((value ->> 'quantity')::numeric(12,3) * (value ->> 'unit_price')::numeric(14,2), 2) as gross, (value ->> 'discount_amount')::numeric(14,2) as discount, value ->> 'vat_treatment' as vat_treatment, (value ->> 'vat_rate')::numeric(5,2) as vat_rate
    from jsonb_array_elements(p_payload -> 'items')
  ) item;
  v_expected_grand := v_expected_pre_tax + v_expected_vat;
  v_expected_withholding := round(v_expected_pre_tax * coalesce(nullif(p_payload ->> 'withholding_tax_rate', '')::numeric(5,2), 0) / 100, 2);
  v_expected_due := v_expected_grand - v_expected_withholding;
  if (p_payload #>> '{totals,grossTotal}')::numeric(14,2) is distinct from v_expected_gross
    or (p_payload #>> '{totals,discountTotal}')::numeric(14,2) is distinct from v_expected_discount
    or (p_payload #>> '{totals,preTaxTotal}')::numeric(14,2) is distinct from v_expected_pre_tax
    or (p_payload #>> '{totals,vatTotal}')::numeric(14,2) is distinct from v_expected_vat
    or (p_payload #>> '{totals,grandTotal}')::numeric(14,2) is distinct from v_expected_grand
    or (p_payload #>> '{totals,withholdingTaxTotal}')::numeric(14,2) is distinct from v_expected_withholding
    or (p_payload #>> '{totals,amountDue}')::numeric(14,2) is distinct from v_expected_due then
    raise exception using errcode = '23514', message = 'Quotation totals do not match items';
  end if;
  v_id := nullif(p_payload ->> 'id', '')::uuid;
  if v_id is null then
    v_id := gen_random_uuid();
    v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
    insert into public.quotations (
      id, document_number, issue_date, valid_until, validity_days, reference, subject,
      seller_snapshot, customer_snapshot, gross_total, discount_total, pre_tax_total,
      vat_total, grand_total, withholding_tax_rate, withholding_tax_total, amount_due,
      public_notes, internal_notes, document_template_snapshot,
      document_template_source_id, document_template_revision_snapshot,
      document_layout_schema_version_snapshot, document_layout_snapshot, created_by, updated_by
    ) values (
      v_id, v_document_number, (p_payload ->> 'issue_date')::date, (p_payload ->> 'valid_until')::date,
      nullif(p_payload ->> 'validity_days', '')::integer, coalesce(p_payload ->> 'reference', ''),
      coalesce(p_payload ->> 'subject', ''), p_payload -> 'seller_snapshot', p_payload -> 'customer_snapshot',
      (p_payload #>> '{totals,grossTotal}')::numeric, (p_payload #>> '{totals,discountTotal}')::numeric,
      (p_payload #>> '{totals,preTaxTotal}')::numeric, (p_payload #>> '{totals,vatTotal}')::numeric,
      (p_payload #>> '{totals,grandTotal}')::numeric, nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
      (p_payload #>> '{totals,withholdingTaxTotal}')::numeric, (p_payload #>> '{totals,amountDue}')::numeric,
      coalesce(p_payload ->> 'public_notes', ''), coalesce(p_payload ->> 'internal_notes', ''),
      p_payload ->> 'document_template_snapshot', nullif(p_payload ->> 'document_template_source_id', '')::uuid,
      nullif(p_payload ->> 'document_template_revision_snapshot', '')::bigint,
      nullif(p_payload ->> 'document_layout_schema_version_snapshot', '')::integer,
      p_payload -> 'document_layout_snapshot', auth.uid(), auth.uid()
    );
  else
    update public.quotations set
      issue_date = (p_payload ->> 'issue_date')::date,
      valid_until = (p_payload ->> 'valid_until')::date,
      validity_days = nullif(p_payload ->> 'validity_days', '')::integer,
      reference = coalesce(p_payload ->> 'reference', ''),
      subject = coalesce(p_payload ->> 'subject', ''),
      seller_snapshot = p_payload -> 'seller_snapshot',
      customer_snapshot = p_payload -> 'customer_snapshot',
      gross_total = (p_payload #>> '{totals,grossTotal}')::numeric,
      discount_total = (p_payload #>> '{totals,discountTotal}')::numeric,
      pre_tax_total = (p_payload #>> '{totals,preTaxTotal}')::numeric,
      vat_total = (p_payload #>> '{totals,vatTotal}')::numeric,
      grand_total = (p_payload #>> '{totals,grandTotal}')::numeric,
      withholding_tax_rate = nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
      withholding_tax_total = (p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
      amount_due = (p_payload #>> '{totals,amountDue}')::numeric,
      public_notes = coalesce(p_payload ->> 'public_notes', ''),
      internal_notes = coalesce(p_payload ->> 'internal_notes', ''),
      document_template_snapshot = p_payload ->> 'document_template_snapshot',
      document_template_source_id = nullif(p_payload ->> 'document_template_source_id', '')::uuid,
      document_template_revision_snapshot = nullif(p_payload ->> 'document_template_revision_snapshot', '')::bigint,
      document_layout_schema_version_snapshot = nullif(p_payload ->> 'document_layout_schema_version_snapshot', '')::integer,
      document_layout_snapshot = p_payload -> 'document_layout_snapshot',
      updated_by = auth.uid(), updated_at = now()
    where quotations.id = v_id and quotations.created_by = auth.uid() and quotations.deleted_at is null
    returning quotations.document_number into v_document_number;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;
  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.quotation_items (quotation_id, position, name, description, quantity, unit, unit_price, discount_amount, vat_treatment, vat_rate)
    values (v_id, (v_item ->> 'position')::integer, v_item ->> 'name', coalesce(v_item ->> 'description', ''), (v_item ->> 'quantity')::numeric, nullif(v_item ->> 'unit', ''), (v_item ->> 'unit_price')::numeric, (v_item ->> 'discount_amount')::numeric, v_item ->> 'vat_treatment', (v_item ->> 'vat_rate')::numeric);
  end loop;
  return query select v_id, v_document_number;
end;
$$;

revoke all on function private.save_quotation(jsonb) from public;
grant execute on function private.save_quotation(jsonb) to authenticated;
