create or replace function private.save_quotation_with_payments(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_profile_id uuid;
  v_submitted_profile_id uuid;
  v_saved record;
  v_method jsonb;
  v_bank public.banks%rowtype;
  v_position integer := 1;
  v_methods jsonb := coalesce(p_payload -> 'payment_methods', '[]'::jsonb);
  v_amount_due numeric;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  if jsonb_typeof(v_methods) is distinct from 'array' or jsonb_array_length(v_methods) > 20 then
    raise exception using errcode = '22023', message = 'Payment methods must be an array of at most 20 rows';
  end if;
  if exists (select 1 from jsonb_array_elements(v_methods) rows group by value ->> 'id' having count(*) > 1) then
    raise exception using errcode = '22023', message = 'Payment method IDs must be unique';
  end if;
  for v_method in select value from jsonb_array_elements(v_methods) loop perform private.validate_quotation_payment_method(v_method); end loop;
  select profile.id into v_profile_id
  from public.quotation_company_profiles profile
  where profile.user_id = auth.uid();
  if v_profile_id is null then raise exception using errcode = '23514', message = 'Seller profile not found'; end if;
  v_submitted_profile_id := nullif(p_payload ->> 'company_profile_id', '')::uuid;
  if v_submitted_profile_id is not null and v_submitted_profile_id <> v_profile_id then
    raise exception using errcode = '42501', message = 'Seller profile does not belong to current user';
  end if;
  select * into v_saved from private.save_quotation(p_payload);
  update public.quotations set company_profile_id = v_profile_id
  where quotations.id = v_saved.id and quotations.created_by = auth.uid() and quotations.deleted_at is null and quotations.company_profile_id is distinct from v_profile_id;
  select quotations.amount_due into v_amount_due from public.quotations
  where quotations.id = v_saved.id and quotations.company_profile_id = v_profile_id and quotations.created_by = auth.uid() and quotations.deleted_at is null;
  if v_amount_due is null then raise exception using errcode = '42501', message = 'Quotation seller profile does not belong to current user'; end if;
  if exists (select 1 from jsonb_array_elements(v_methods) row where row ->> 'qr_mode' = 'auto_promptpay')
    and (v_amount_due <= 0 or v_amount_due > 9999999999.99) then
    raise exception using errcode = '22023', message = 'Automatic PromptPay amount is out of range';
  end if;
  delete from public.quotation_payment_methods where quotation_id = v_saved.id;
  for v_method in select value from jsonb_array_elements(v_methods) loop
    select * into v_bank from public.banks where banks.id = nullif(v_method ->> 'bank_id', '')::uuid;
    insert into public.quotation_payment_methods (
      id, quotation_id, type, bank_code, bank_name, bank_logo_url, custom_bank_name,
      custom_bank_logo_url, account_number, account_name, promptpay_id, provider_name,
      instructions, qr_mode, qr_image_url, position
    ) values (
      (v_method ->> 'id')::uuid, v_saved.id, v_method ->> 'type',
      coalesce(v_bank.code, case when v_method ->> 'type' = 'bank_transfer' then v_method ->> 'bank_code' end, ''),
      coalesce(v_bank.name, v_method ->> 'custom_bank_name', ''),
      coalesce(v_bank.logo_path, case when coalesce(v_method ->> 'bank_logo_url', '') ~ '^/quotation/banks/[a-z0-9-]+\.svg$' then v_method ->> 'bank_logo_url' end, ''),
      coalesce(v_method ->> 'custom_bank_name', ''), coalesce(v_method ->> 'custom_bank_logo_url', ''),
      coalesce(v_method ->> 'account_number', ''), coalesce(v_method ->> 'account_name', ''),
      regexp_replace(coalesce(v_method ->> 'promptpay_id', ''), '\D', '', 'g'),
      coalesce(v_method ->> 'provider_name', ''), coalesce(v_method ->> 'instructions', ''),
      coalesce(v_method ->> 'qr_mode', 'none'), coalesce(v_method ->> 'qr_image_url', ''), v_position
    );
    v_position := v_position + 1;
  end loop;
  return query select v_saved.id, v_saved.document_number;
end;
$$;

revoke all on function private.save_quotation_with_payments(jsonb) from public;
grant execute on function private.save_quotation_with_payments(jsonb) to authenticated;
