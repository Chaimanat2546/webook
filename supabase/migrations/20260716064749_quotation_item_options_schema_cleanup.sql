truncate table public.quotations cascade;
truncate table private.quotation_number_counters;

alter table public.quotations
  drop constraint if exists quotations_subtotal_check,
  drop constraint if exists quotations_item_discount_total_check,
  drop constraint if exists quotations_taxable_total_check,
  drop constraint if exists quotations_vat_total_check,
  drop constraint if exists quotations_grand_total_check,
  drop constraint if exists quotations_withholding_tax_total_check,
  drop constraint if exists quotations_amount_due_check,
  drop column currency,
  drop column price_mode,
  drop column document_discount_type,
  drop column document_discount_value,
  drop column document_discount_total;

alter table public.quotations rename column subtotal to gross_total;
alter table public.quotations rename column item_discount_total to discount_total;
alter table public.quotations rename column taxable_total to pre_tax_total;

alter table public.quotations
  add constraint quotations_gross_total_nonnegative check (gross_total >= 0),
  add constraint quotations_discount_total_valid check (discount_total >= 0 and discount_total <= gross_total),
  add constraint quotations_pre_tax_total_valid check (pre_tax_total = gross_total - discount_total),
  add constraint quotations_vat_total_nonnegative check (vat_total >= 0),
  add constraint quotations_grand_total_valid check (grand_total = pre_tax_total + vat_total),
  add constraint quotations_withholding_total_nonnegative check (withholding_tax_total >= 0),
  add constraint quotations_amount_due_valid check (amount_due = grand_total - withholding_tax_total and amount_due >= 0);

alter table public.quotation_items
  drop constraint if exists quotation_items_discount_amount_check,
  drop constraint if exists quotation_items_vat_rate_check,
  drop column sku,
  drop column discount_type,
  drop column discount_value,
  drop column document_discount_allocation,
  drop column gross_amount,
  drop column taxable_amount,
  drop column vat_amount,
  drop column line_total,
  drop column created_at,
  drop column updated_at,
  add constraint quotation_items_discount_amount_valid
    check (discount_amount >= 0 and discount_amount <= round(quantity * unit_price, 2)),
  add constraint quotation_items_vat_rate_valid check (vat_rate between 0 and 100),
  add constraint quotation_items_vat_treatment_rate_valid
    check (vat_treatment = 'taxable' or vat_rate = 0);

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
  if not private.has_quotation_permission() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;
  if jsonb_array_length(p_payload -> 'items') not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;

  select
    sum(item.gross),
    sum(item.discount),
    sum(item.gross - item.discount),
    sum(case when item.vat_treatment = 'taxable'
      then round((item.gross - item.discount) * item.vat_rate / 100, 2)
      else 0 end)
  into v_expected_gross, v_expected_discount, v_expected_pre_tax, v_expected_vat
  from (
    select
      round((value ->> 'quantity')::numeric(12,3) * (value ->> 'unit_price')::numeric(14,2), 2) as gross,
      (value ->> 'discount_amount')::numeric(14,2) as discount,
      value ->> 'vat_treatment' as vat_treatment,
      (value ->> 'vat_rate')::numeric(5,2) as vat_rate
    from jsonb_array_elements(p_payload -> 'items')
  ) item;
  v_expected_grand := v_expected_pre_tax + v_expected_vat;
  v_expected_withholding := round(
    v_expected_pre_tax * coalesce(nullif(p_payload ->> 'withholding_tax_rate', '')::numeric(5,2), 0) / 100,
    2
  );
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
      id, document_number, issue_date, valid_until, validity_days, reference,
      subject, seller_snapshot, customer_snapshot, gross_total, discount_total,
      pre_tax_total, vat_total, grand_total, withholding_tax_rate,
      withholding_tax_total, amount_due, public_notes, internal_notes,
      created_by, updated_by
    ) values (
      v_id, v_document_number, (p_payload ->> 'issue_date')::date,
      (p_payload ->> 'valid_until')::date,
      nullif(p_payload ->> 'validity_days', '')::integer,
      coalesce(p_payload ->> 'reference', ''), coalesce(p_payload ->> 'subject', ''),
      p_payload -> 'seller_snapshot', p_payload -> 'customer_snapshot',
      (p_payload #>> '{totals,grossTotal}')::numeric,
      (p_payload #>> '{totals,discountTotal}')::numeric,
      (p_payload #>> '{totals,preTaxTotal}')::numeric,
      (p_payload #>> '{totals,vatTotal}')::numeric,
      (p_payload #>> '{totals,grandTotal}')::numeric,
      nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
      (p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
      (p_payload #>> '{totals,amountDue}')::numeric,
      coalesce(p_payload ->> 'public_notes', ''),
      coalesce(p_payload ->> 'internal_notes', ''), auth.uid(), auth.uid()
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
      updated_by = auth.uid(), updated_at = now()
    where quotations.id = v_id and quotations.deleted_at is null
    returning quotations.document_number into v_document_number;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception using errcode = 'P0002', message = 'Quotation not found';
    end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.quotation_items (
      quotation_id, position, name, description, quantity, unit, unit_price,
      discount_amount, vat_treatment, vat_rate
    ) values (
      v_id, (v_item ->> 'position')::integer, v_item ->> 'name',
      coalesce(v_item ->> 'description', ''), (v_item ->> 'quantity')::numeric,
      nullif(v_item ->> 'unit', ''), (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'discount_amount')::numeric, v_item ->> 'vat_treatment',
      (v_item ->> 'vat_rate')::numeric
    );
  end loop;
  return query select v_id, v_document_number;
end;
$$;

create or replace function private.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', q.id,
    'document_number', q.document_number,
    'issue_date', q.issue_date,
    'valid_until', q.valid_until,
    'validity_days', q.validity_days,
    'reference', q.reference,
    'subject', q.subject,
    'seller_snapshot', q.seller_snapshot,
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
        'id', i.id,
        'position', i.position,
        'name', i.name,
        'description', i.description,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'discount_amount', i.discount_amount,
        'vat_treatment', i.vat_treatment,
        'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i
      where i.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null;
$$;
