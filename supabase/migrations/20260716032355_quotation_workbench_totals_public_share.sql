alter table public.quotations
  add column public_token uuid not null default gen_random_uuid(),
  add column withholding_tax_rate numeric(5,2)
    check (withholding_tax_rate is null or withholding_tax_rate between 0 and 100),
  add column withholding_tax_total numeric(14,2) not null default 0
    check (withholding_tax_total >= 0),
  add column amount_due numeric(14,2) not null default 0
    check (amount_due >= 0),
  add constraint quotations_public_token_key unique (public_token);

update public.quotations
set amount_due = grand_total,
    customer_snapshot = customer_snapshot - array[
      'contactName', 'contact_name', 'phone', 'email',
      'shippingAddress', 'shipping_address',
      'serviceLocation', 'service_location'
    ]::text[];

create or replace function private.save_quotation(p_payload jsonb) returns table (id uuid, document_number text) language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_id uuid; v_document_number text; v_item jsonb; v_updated integer;
begin
 if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
 v_id := nullif(p_payload ->> 'id', '')::uuid;
 if v_id is null then
  v_id := gen_random_uuid(); v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
  insert into public.quotations (id,document_number,issue_date,valid_until,validity_days,reference,subject,currency,price_mode,seller_snapshot,customer_snapshot,document_discount_type,document_discount_value,subtotal,item_discount_total,document_discount_total,taxable_total,vat_total,grand_total,withholding_tax_rate,withholding_tax_total,amount_due,public_notes,internal_notes,created_by,updated_by) values (v_id,v_document_number,(p_payload ->> 'issue_date')::date,(p_payload ->> 'valid_until')::date,nullif(p_payload ->> 'validity_days','')::integer,coalesce(p_payload ->> 'reference',''),coalesce(p_payload ->> 'subject',''),p_payload ->> 'currency',p_payload ->> 'price_mode',p_payload -> 'seller_snapshot',p_payload -> 'customer_snapshot',nullif(p_payload ->> 'document_discount_type',''),(p_payload ->> 'document_discount_value')::numeric,(p_payload #>> '{totals,subtotal}')::numeric,(p_payload #>> '{totals,itemDiscountTotal}')::numeric,(p_payload #>> '{totals,documentDiscountTotal}')::numeric,(p_payload #>> '{totals,taxableTotal}')::numeric,(p_payload #>> '{totals,vatTotal}')::numeric,(p_payload #>> '{totals,grandTotal}')::numeric,nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,(p_payload #>> '{totals,withholdingTaxTotal}')::numeric,(p_payload #>> '{totals,amountDue}')::numeric,coalesce(p_payload ->> 'public_notes',''),coalesce(p_payload ->> 'internal_notes',''),auth.uid(),auth.uid());
 else
  update public.quotations set issue_date=(p_payload ->> 'issue_date')::date,valid_until=(p_payload ->> 'valid_until')::date,validity_days=nullif(p_payload ->> 'validity_days','')::integer,reference=coalesce(p_payload ->> 'reference',''),subject=coalesce(p_payload ->> 'subject',''),currency=p_payload ->> 'currency',price_mode=p_payload ->> 'price_mode',seller_snapshot=p_payload -> 'seller_snapshot',customer_snapshot=p_payload -> 'customer_snapshot',document_discount_type=nullif(p_payload ->> 'document_discount_type',''),document_discount_value=(p_payload ->> 'document_discount_value')::numeric,subtotal=(p_payload #>> '{totals,subtotal}')::numeric,item_discount_total=(p_payload #>> '{totals,itemDiscountTotal}')::numeric,document_discount_total=(p_payload #>> '{totals,documentDiscountTotal}')::numeric,taxable_total=(p_payload #>> '{totals,taxableTotal}')::numeric,vat_total=(p_payload #>> '{totals,vatTotal}')::numeric,grand_total=(p_payload #>> '{totals,grandTotal}')::numeric,withholding_tax_rate=nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,withholding_tax_total=(p_payload #>> '{totals,withholdingTaxTotal}')::numeric,amount_due=(p_payload #>> '{totals,amountDue}')::numeric,public_notes=coalesce(p_payload ->> 'public_notes',''),internal_notes=coalesce(p_payload ->> 'internal_notes',''),updated_by=auth.uid(),updated_at=now() where quotations.id=v_id and quotations.deleted_at is null returning quotations.document_number into v_document_number;
  get diagnostics v_updated = row_count; if v_updated = 0 then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if; delete from public.quotation_items where quotation_id = v_id;
 end if;
 for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
  insert into public.quotation_items (quotation_id,position,sku,name,description,quantity,unit,unit_price,discount_type,discount_value,gross_amount,discount_amount,document_discount_allocation,vat_treatment,vat_rate,taxable_amount,vat_amount,line_total) values (v_id,(v_item ->> 'position')::integer,coalesce(v_item ->> 'sku',''),v_item ->> 'name',coalesce(v_item ->> 'description',''),(v_item ->> 'quantity')::numeric,v_item ->> 'unit',(v_item ->> 'unit_price')::numeric,nullif(v_item ->> 'discount_type',''),(v_item ->> 'discount_value')::numeric,(v_item ->> 'gross_amount')::numeric,(v_item ->> 'discount_amount')::numeric,(v_item ->> 'document_discount_allocation')::numeric,v_item ->> 'vat_treatment',(v_item ->> 'vat_rate')::numeric,(v_item ->> 'taxable_amount')::numeric,(v_item ->> 'vat_amount')::numeric,(v_item ->> 'line_total')::numeric);
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
    'currency', q.currency,
    'price_mode', q.price_mode,
    'seller_snapshot', q.seller_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', q.customer_snapshot ->> 'customer_name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', q.customer_snapshot ->> 'tax_id', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', q.customer_snapshot ->> 'office_type', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', q.customer_snapshot ->> 'branch_number', '')
    ),
    'document_discount_type', q.document_discount_type,
    'document_discount_value', q.document_discount_value,
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
        'discount_type', i.discount_type,
        'discount_value', i.discount_value,
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

create or replace function public.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select private.get_public_quotation(p_token);
$$;

revoke all on function private.get_public_quotation(uuid) from public;
revoke all on function public.get_public_quotation(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.get_public_quotation(uuid) to anon, authenticated;
grant execute on function public.get_public_quotation(uuid) to anon, authenticated;
