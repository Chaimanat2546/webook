update public.quotation_customers
set branch_number = btrim(branch_number)
where office_type = 'branch';

update public.quotation_customers
set branch_number = ''
where office_type <> 'branch';

alter table public.quotation_customers
  add constraint quotation_customers_branch_number_canonical check (
    (office_type = 'branch' and branch_number = btrim(branch_number) and branch_number <> '')
    or (office_type <> 'branch' and branch_number = '')
  );

create unique index quotation_customers_individual_tax_id_uidx
  on public.quotation_customers (tax_id)
  where customer_type = 'individual';

create unique index quotation_customers_juristic_main_tax_id_uidx
  on public.quotation_customers (tax_id)
  where customer_type = 'juristic' and office_type <> 'branch';

create unique index quotation_customers_juristic_branch_uidx
  on public.quotation_customers (tax_id, branch_number)
  where customer_type = 'juristic' and office_type = 'branch';

alter table public.quotation_customers
  drop constraint quotation_customers_tax_id_key;
