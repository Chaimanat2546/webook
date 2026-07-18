revoke all privileges on table public.quotation_payment_methods from anon, authenticated;
grant select on table public.quotation_payment_methods to authenticated;

drop policy if exists "Quotation owners read payment snapshots" on public.quotation_payment_methods;
create policy "Quotation owners read payment snapshots" on public.quotation_payment_methods
  for select to authenticated
  using (
    private.has_quotation_permission()
    and exists (
      select 1 from public.quotations q
      where q.id = quotation_id
        and q.created_by = (select auth.uid())
        and q.deleted_at is null
    )
  );

create or replace function private.validate_quotation_payment_method(p_method jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_type text := btrim(coalesce(p_method ->> 'type', ''));
  v_qr_mode text := btrim(coalesce(p_method ->> 'qr_mode', 'none'));
  v_bank_id_text text := btrim(coalesce(p_method ->> 'bank_id', ''));
  v_bank_id uuid;
  v_promptpay_id text := regexp_replace(coalesce(p_method ->> 'promptpay_id', ''), '\D', '', 'g');
  v_bank_logo_url text := btrim(coalesce(p_method ->> 'bank_logo_url', ''));
begin
  if jsonb_typeof(p_method) is distinct from 'object'
    or btrim(coalesce(p_method ->> 'id', '')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or v_type not in ('bank_transfer', 'promptpay', 'qr_payment', 'cash', 'other')
    or v_qr_mode not in ('none', 'upload', 'auto_promptpay')
    or char_length(btrim(coalesce(p_method ->> 'instructions', ''))) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end if;

  if v_bank_id_text <> '' then
    if v_bank_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'Invalid payment method';
    end if;
    v_bank_id := v_bank_id_text::uuid;
  end if;

  if v_type = 'bank_transfer' then
    if char_length(btrim(coalesce(p_method ->> 'account_name', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'account_number', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'bank_code', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'bank_name', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'bank_logo_url', ''))) > 2048
      or char_length(btrim(coalesce(p_method ->> 'custom_bank_name', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'custom_bank_logo_url', ''))) > 2048
      or btrim(coalesce(p_method ->> 'account_name', '')) = ''
      or btrim(coalesce(p_method ->> 'account_number', '')) = ''
      or (v_bank_id is null and btrim(coalesce(p_method ->> 'custom_bank_name', '')) = '')
      or (v_bank_id is not null and not exists (select 1 from public.banks where id = v_bank_id))
      or (v_bank_logo_url <> '' and v_bank_logo_url !~* '^/quotation/banks/[a-z0-9-]+\.svg$')
      or (v_bank_id is null and not private.validate_quotation_payment_asset_url(btrim(coalesce(p_method ->> 'custom_bank_logo_url', ''))))
      or (v_qr_mode = 'upload' and (
        btrim(coalesce(p_method ->> 'qr_image_url', '')) = ''
        or char_length(btrim(coalesce(p_method ->> 'qr_image_url', ''))) > 2048
        or not private.validate_quotation_payment_asset_url(btrim(coalesce(p_method ->> 'qr_image_url', '')))
      )) then
      raise exception using errcode = '22023', message = 'Invalid payment method';
    end if;
  elsif v_type = 'promptpay' then
    if char_length(btrim(coalesce(p_method ->> 'account_name', ''))) > 200
      or char_length(btrim(coalesce(p_method ->> 'promptpay_id', ''))) > 200
      or btrim(coalesce(p_method ->> 'account_name', '')) = ''
      or length(v_promptpay_id) not in (10, 13)
      or v_qr_mode not in ('upload', 'auto_promptpay')
      or (v_qr_mode = 'upload' and (
        btrim(coalesce(p_method ->> 'qr_image_url', '')) = ''
        or char_length(btrim(coalesce(p_method ->> 'qr_image_url', ''))) > 2048
        or not private.validate_quotation_payment_asset_url(btrim(coalesce(p_method ->> 'qr_image_url', '')))
      )) then
      raise exception using errcode = '22023', message = 'Invalid payment method';
    end if;
  elsif v_type = 'qr_payment' then
    if char_length(btrim(coalesce(p_method ->> 'provider_name', ''))) > 200
      or btrim(coalesce(p_method ->> 'provider_name', '')) = ''
      or btrim(coalesce(p_method ->> 'qr_image_url', '')) = ''
      or char_length(btrim(coalesce(p_method ->> 'qr_image_url', ''))) > 2048
      or not private.validate_quotation_payment_asset_url(btrim(coalesce(p_method ->> 'qr_image_url', ''))) then
      raise exception using errcode = '22023', message = 'Invalid payment method';
    end if;
  elsif v_type = 'other' and (
    char_length(btrim(coalesce(p_method ->> 'provider_name', ''))) > 200
    or btrim(coalesce(p_method ->> 'provider_name', '')) = ''
  ) then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end if;
end;
$$;

create or replace function private.save_quotation_company_payment_methods(p_methods jsonb)
returns setof public.quotation_company_payment_methods
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_method jsonb;
  v_type text;
  v_bank_id uuid;
  v_qr_mode text;
  v_position integer := 1;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  if jsonb_typeof(p_methods) is distinct from 'array' or jsonb_array_length(p_methods) > 20 then
    raise exception using errcode = '22023', message = 'Payment methods must be an array of at most 20 rows';
  end if;
  if exists (select 1 from jsonb_array_elements(p_methods) rows group by value ->> 'id' having count(*) > 1) then
    raise exception using errcode = '22023', message = 'Payment method IDs must be unique';
  end if;
  for v_method in select value from jsonb_array_elements(p_methods) loop perform private.validate_quotation_payment_method(v_method); end loop;
  delete from public.quotation_company_payment_methods where user_id = auth.uid();
  for v_method in select value from jsonb_array_elements(p_methods) loop
    v_type := btrim(v_method ->> 'type');
    v_bank_id := case when v_type = 'bank_transfer' then nullif(btrim(coalesce(v_method ->> 'bank_id', '')), '')::uuid end;
    v_qr_mode := case
      when v_type = 'promptpay' then btrim(coalesce(v_method ->> 'qr_mode', 'none'))
      when v_type = 'qr_payment' then 'upload'
      when v_type = 'bank_transfer' and btrim(coalesce(v_method ->> 'qr_mode', 'none')) = 'upload' then 'upload'
      else 'none'
    end;
    insert into public.quotation_company_payment_methods (
      id, user_id, type, bank_id, custom_bank_name, custom_bank_logo_url, account_number,
      account_name, promptpay_id, provider_name, instructions, qr_mode, qr_image_url, is_default, position
    ) values (
      (btrim(v_method ->> 'id'))::uuid, auth.uid(), v_type, v_bank_id,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_name', '')) else '' end,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_logo_url', '')) else '' end,
      case when v_type = 'bank_transfer' then btrim(coalesce(v_method ->> 'account_number', '')) else '' end,
      case when v_type in ('bank_transfer', 'promptpay') then btrim(coalesce(v_method ->> 'account_name', '')) else '' end,
      case when v_type = 'promptpay' then regexp_replace(coalesce(v_method ->> 'promptpay_id', ''), '\D', '', 'g') else '' end,
      case when v_type in ('qr_payment', 'other') then btrim(coalesce(v_method ->> 'provider_name', '')) else '' end,
      btrim(coalesce(v_method ->> 'instructions', '')), v_qr_mode,
      case when v_qr_mode = 'upload' then btrim(coalesce(v_method ->> 'qr_image_url', '')) else '' end,
      coalesce((v_method ->> 'is_default')::boolean, false), v_position
    );
    v_position := v_position + 1;
  end loop;
  return query select * from public.quotation_company_payment_methods where user_id = auth.uid() order by position;
end;
$$;

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
  v_bank_id uuid;
  v_type text;
  v_qr_mode text;
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
  select profile.id into v_profile_id from public.quotation_company_profiles profile where profile.user_id = auth.uid();
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
  if exists (select 1 from jsonb_array_elements(v_methods) row where btrim(row ->> 'type') = 'promptpay' and btrim(row ->> 'qr_mode') = 'auto_promptpay')
    and (v_amount_due <= 0 or v_amount_due > 9999999999.99) then
    raise exception using errcode = '22023', message = 'Automatic PromptPay amount is out of range';
  end if;
  delete from public.quotation_payment_methods where quotation_id = v_saved.id;
  for v_method in select value from jsonb_array_elements(v_methods) loop
    v_type := btrim(v_method ->> 'type');
    v_bank_id := case when v_type = 'bank_transfer' then nullif(btrim(coalesce(v_method ->> 'bank_id', '')), '')::uuid end;
    select * into v_bank from public.banks where banks.id = v_bank_id;
    v_qr_mode := case
      when v_type = 'promptpay' then btrim(coalesce(v_method ->> 'qr_mode', 'none'))
      when v_type = 'qr_payment' then 'upload'
      when v_type = 'bank_transfer' and btrim(coalesce(v_method ->> 'qr_mode', 'none')) = 'upload' then 'upload'
      else 'none'
    end;
    insert into public.quotation_payment_methods (
      id, quotation_id, type, bank_code, bank_name, bank_logo_url, custom_bank_name,
      custom_bank_logo_url, account_number, account_name, promptpay_id, provider_name,
      instructions, qr_mode, qr_image_url, position
    ) values (
      (btrim(v_method ->> 'id'))::uuid, v_saved.id, v_type,
      case when v_type = 'bank_transfer' then coalesce(v_bank.code, 'OTHER') else '' end,
      case when v_type = 'bank_transfer' then coalesce(v_bank.name, btrim(coalesce(v_method ->> 'custom_bank_name', ''))) else '' end,
      case when v_type = 'bank_transfer' then coalesce(v_bank.logo_path, case when btrim(coalesce(v_method ->> 'bank_logo_url', '')) ~* '^/quotation/banks/[a-z0-9-]+\.svg$' then btrim(v_method ->> 'bank_logo_url') else '' end) else '' end,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_name', '')) else '' end,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_logo_url', '')) else '' end,
      case when v_type = 'bank_transfer' then btrim(coalesce(v_method ->> 'account_number', '')) else '' end,
      case when v_type in ('bank_transfer', 'promptpay') then btrim(coalesce(v_method ->> 'account_name', '')) else '' end,
      case when v_type = 'promptpay' then regexp_replace(coalesce(v_method ->> 'promptpay_id', ''), '\D', '', 'g') else '' end,
      case when v_type in ('qr_payment', 'other') then btrim(coalesce(v_method ->> 'provider_name', '')) else '' end,
      btrim(coalesce(v_method ->> 'instructions', '')), v_qr_mode,
      case when v_qr_mode = 'upload' then btrim(coalesce(v_method ->> 'qr_image_url', '')) else '' end,
      v_position
    );
    v_position := v_position + 1;
  end loop;
  return query select v_saved.id, v_saved.document_number;
end;
$$;

revoke all on function private.validate_quotation_payment_method(jsonb) from public;
revoke all on function private.save_quotation_company_payment_methods(jsonb) from public;
revoke all on function private.save_quotation_with_payments(jsonb) from public;
grant execute on function private.save_quotation_company_payment_methods(jsonb) to authenticated;
grant execute on function private.save_quotation_with_payments(jsonb) to authenticated;
