revoke insert, update on table public.quotation_customers from authenticated;
grant select on table public.quotation_customers to authenticated;
grant select, insert, update on table public.quotation_customers to service_role;

drop policy "Quotation users manage shared customers"
  on public.quotation_customers;

create policy "Quotation users read shared customers"
on public.quotation_customers
for select
to authenticated
using ((select private.has_quotation_permission()));

create or replace function private.touch_quotation_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  return new;
end;
$$;
