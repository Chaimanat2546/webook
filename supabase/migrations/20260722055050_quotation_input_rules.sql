create or replace function private.next_quotation_number(p_issue_date date)
returns text
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_running integer;
begin
  insert into private.quotation_number_counters (issue_date, last_value)
  values (p_issue_date, 1)
  on conflict (issue_date) do update
    set last_value = private.quotation_number_counters.last_value + 1
  returning last_value into v_running;

  return 'QO-' || to_char(p_issue_date, 'YYYYMMDD') ||
    case when v_running < 10000
      then lpad(v_running::text, 4, '0')
      else v_running::text
    end;
end;
$$;

revoke all on function private.next_quotation_number(date) from public;

alter table public.quotation_company_profiles
  drop constraint if exists quotation_company_profiles_office_type_check,
  add constraint quotation_company_profiles_office_type_valid
    check (office_type in ('head_office', 'branch', 'unspecified')) not valid,
  add constraint quotation_company_profiles_tax_id_valid
    check (tax_id ~ '^[0-9]{13}$') not valid,
  add constraint quotation_company_profiles_branch_number_valid
    check (office_type <> 'branch' or btrim(branch_number) <> '') not valid;

alter table public.quotations
  add constraint quotations_snapshot_input_rules_valid check (
    jsonb_typeof(seller_snapshot) = 'object'
    and jsonb_typeof(customer_snapshot) = 'object'
    and coalesce(seller_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(customer_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(seller_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and coalesce(customer_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and (
      seller_snapshot ->> 'officeType' <> 'branch'
      or btrim(coalesce(seller_snapshot ->> 'branchNumber', '')) <> ''
    )
    and (
      customer_snapshot ->> 'officeType' <> 'branch'
      or btrim(coalesce(customer_snapshot ->> 'branchNumber', '')) <> ''
    )
  ) not valid;

alter table public.quotation_items
  drop constraint if exists quotation_items_vat_treatment_check,
  drop constraint if exists quotation_items_vat_rate_valid,
  drop constraint if exists quotation_items_vat_treatment_rate_valid,
  add constraint quotation_items_vat_treatment_valid
    check (vat_treatment in ('taxable', 'none')) not valid,
  add constraint quotation_items_vat_treatment_rate_valid
    check (
      (vat_treatment = 'taxable' and vat_rate in (0, 7))
      or (vat_treatment = 'none' and vat_rate = 0)
    ) not valid;
