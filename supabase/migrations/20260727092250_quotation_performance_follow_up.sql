-- Cache the caller identity once per statement while preserving the owner check.
drop policy if exists "Quotation owners read items"
  on public.quotation_items;

create policy "Quotation owners read items"
  on public.quotation_items
  for select
  to authenticated
  using (
    (select private.has_quotation_permission())
    and exists (
      select 1
      from public.quotations q
      where q.id = quotation_items.quotation_id
        and q.created_by = (select auth.uid())
        and q.deleted_at is null
    )
  );

-- Cover the referencing side of foreign keys used by joins and parent updates.
create index quotation_company_payment_methods_bank_id_idx
  on public.quotation_company_payment_methods (bank_id);

create index quotation_items_name_idx
  on public.quotation_items (name);

create index quotations_company_profile_id_idx
  on public.quotations (company_profile_id);
