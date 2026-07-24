-- Keep quotation snapshots writable only through the validated private boundary.
alter table public.quotation_company_profiles
  drop constraint if exists quotation_company_profiles_document_display_defaults_valid;
alter table public.quotations
  drop constraint if exists quotations_document_display_snapshot_valid;

create or replace function private.is_quotation_document_display(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(value) = 'object'
    and value ?& array[
      'certificationDate', 'certificationName', 'certificationQr', 'discount',
      'notes', 'preTax', 'reference', 'tax', 'unit', 'withholdingTax'
    ]
    and value
      - 'certificationDate' - 'certificationName' - 'certificationQr'
      - 'discount' - 'notes' - 'preTax' - 'reference' - 'tax' - 'unit'
      - 'withholdingTax' = '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(value) entry
      where jsonb_typeof(entry.value) <> 'boolean'
    );
$$;

alter table public.quotation_company_profiles
  add constraint quotation_company_profiles_document_display_defaults_valid
  check (private.is_quotation_document_display(document_display_defaults))
  not valid;
alter table public.quotations
  add constraint quotations_document_display_snapshot_valid
  check (private.is_quotation_document_display(document_display_snapshot))
  not valid;

create or replace function private.save_quotation_with_document_display(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_display jsonb := p_payload -> 'document_display_snapshot';
  v_saved record;
begin
  if not private.is_quotation_document_display(v_display) then
    raise exception using
      errcode = '22023',
      message = 'Invalid quotation document display';
  end if;

  select *
  into v_saved
  from private.save_quotation_with_payments(p_payload);

  update public.quotations q
  set document_display_snapshot = v_display
  where q.id = v_saved.id
    and q.created_by = auth.uid()
    and q.deleted_at is null;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Quotation document display update denied';
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
  from private.save_quotation_with_document_display(p_payload);
$$;

revoke all on function private.save_quotation_with_document_display(jsonb)
  from public, anon;
revoke all on function private.is_quotation_document_display(jsonb)
  from public, anon;
revoke all on function public.save_quotation_with_payments(jsonb)
  from public, anon;
grant execute on function private.save_quotation_with_document_display(jsonb)
  to authenticated;
grant execute on function private.is_quotation_document_display(jsonb)
  to authenticated;
grant execute on function public.save_quotation_with_payments(jsonb)
  to authenticated;
