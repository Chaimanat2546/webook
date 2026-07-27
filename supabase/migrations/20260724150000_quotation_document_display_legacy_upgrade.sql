-- Preserve seven-flag values from the earlier draft and close the legacy RPC bypass.
alter table public.quotation_company_profiles
  drop constraint if exists quotation_company_profiles_document_display_defaults_valid,
  drop constraint if exists quotation_company_profiles_office_type_valid,
  drop constraint if exists quotation_company_profiles_tax_id_valid,
  drop constraint if exists quotation_company_profiles_branch_number_valid;

update public.quotation_company_profiles
set document_display_defaults = document_display_defaults || jsonb_build_object(
  'certificationDate', true,
  'certificationName', true,
  'certificationQr', true
)
where jsonb_typeof(document_display_defaults) = 'object'
  and document_display_defaults ?& array[
    'discount', 'notes', 'preTax', 'reference', 'tax', 'unit', 'withholdingTax'
  ]
  and document_display_defaults
    - 'discount' - 'notes' - 'preTax' - 'reference' - 'tax' - 'unit'
    - 'withholdingTax' = '{}'::jsonb
  and not exists (
    select 1 from jsonb_each(document_display_defaults) entry
    where jsonb_typeof(entry.value) <> 'boolean'
  );

alter table public.quotation_company_profiles
  add constraint quotation_company_profiles_office_type_valid
    check (office_type in ('head_office', 'branch', 'unspecified')) not valid,
  add constraint quotation_company_profiles_tax_id_valid
    check (tax_id ~ '^[0-9]{13}$') not valid,
  add constraint quotation_company_profiles_branch_number_valid
    check (office_type <> 'branch' or btrim(branch_number) <> '') not valid,
  add constraint quotation_company_profiles_document_display_defaults_valid
    check (private.is_quotation_document_display(document_display_defaults))
    not valid;

alter table public.quotation_company_profiles
  validate constraint quotation_company_profiles_document_display_defaults_valid;

alter table public.quotations
  drop constraint if exists quotations_document_display_snapshot_valid,
  drop constraint if exists quotations_snapshot_input_rules_valid;

update public.quotations
set document_display_snapshot = document_display_snapshot || jsonb_build_object(
  'certificationDate', true,
  'certificationName', true,
  'certificationQr', true
)
where jsonb_typeof(document_display_snapshot) = 'object'
  and document_display_snapshot ?& array[
    'discount', 'notes', 'preTax', 'reference', 'tax', 'unit', 'withholdingTax'
  ]
  and document_display_snapshot
    - 'discount' - 'notes' - 'preTax' - 'reference' - 'tax' - 'unit'
    - 'withholdingTax' = '{}'::jsonb
  and not exists (
    select 1 from jsonb_each(document_display_snapshot) entry
    where jsonb_typeof(entry.value) <> 'boolean'
  );

alter table public.quotations
  add constraint quotations_snapshot_input_rules_valid check (
    jsonb_typeof(seller_snapshot) = 'object'
    and jsonb_typeof(customer_snapshot) = 'object'
    and coalesce(seller_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(customer_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(seller_snapshot ->> 'officeType', '')
      in ('head_office', 'branch', 'unspecified')
    and coalesce(customer_snapshot ->> 'officeType', '')
      in ('head_office', 'branch', 'unspecified')
    and (
      seller_snapshot ->> 'officeType' <> 'branch'
      or btrim(coalesce(seller_snapshot ->> 'branchNumber', '')) <> ''
    )
    and (
      customer_snapshot ->> 'officeType' <> 'branch'
      or btrim(coalesce(customer_snapshot ->> 'branchNumber', '')) <> ''
    )
  ) not valid,
  add constraint quotations_document_display_snapshot_valid
    check (private.is_quotation_document_display(document_display_snapshot))
    not valid;

alter table public.quotations
  validate constraint quotations_document_display_snapshot_valid;

create or replace function public.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select *
  from private.save_quotation_with_document_display(p_payload);
$$;

revoke all on function public.save_quotation(jsonb) from public, anon;
grant execute on function public.save_quotation(jsonb) to authenticated;
