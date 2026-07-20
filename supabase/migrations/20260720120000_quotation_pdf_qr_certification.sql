alter table public.quotation_company_profiles
  add column issuer_name text,
  add column issuer_position text,
  add column issuer_signature_url text,
  add column approver_name text,
  add column approver_position text,
  add column approver_signature_url text,
  add column company_stamp_url text;

alter table public.quotations
  add column certification_snapshot jsonb not null default '{}'::jsonb,
  add constraint quotations_certification_snapshot_object_check
    check (jsonb_typeof(certification_snapshot) = 'object');

create or replace function private.validate_quotation_certification_asset_url(p_url text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_origin text;
  v_path text;
begin
  if coalesce(btrim(p_url), '') = '' then return true; end if;
  select origin into v_origin from private.quotation_payment_asset_config where singleton;
  if v_origin is null or left(p_url, char_length(v_origin) + 1) <> (v_origin || '/') then return false; end if;
  v_path := substring(p_url from char_length(v_origin) + 1);
  return v_path ~* '^/quotations/certification-assets/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$';
end;
$$;

create or replace function private.normalize_quotation_certification(p_value jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_value jsonb := coalesce(p_value, '{}'::jsonb);
  v_issuer jsonb := coalesce(v_value -> 'issuer', '{}'::jsonb);
  v_approver jsonb := coalesce(v_value -> 'approver', '{}'::jsonb);
  v_issuer_signature text := btrim(coalesce(v_issuer ->> 'signature_url', ''));
  v_approver_signature text := btrim(coalesce(v_approver ->> 'signature_url', ''));
  v_stamp text := btrim(coalesce(v_value ->> 'company_stamp_url', ''));
begin
  if jsonb_typeof(v_value) is distinct from 'object'
    or jsonb_typeof(v_issuer) is distinct from 'object'
    or jsonb_typeof(v_approver) is distinct from 'object'
    or char_length(btrim(coalesce(v_issuer ->> 'name', '))) > 200
    or char_length(btrim(coalesce(v_issuer ->> 'position', '))) > 200
    or char_length(v_issuer_signature) > 2048
    or char_length(btrim(coalesce(v_approver ->> 'name', '))) > 200
    or char_length(btrim(coalesce(v_approver ->> 'position', '))) > 200
    or char_length(v_approver_signature) > 2048
    or char_length(v_stamp) > 2048
    or not private.validate_quotation_certification_asset_url(v_issuer_signature)
    or not private.validate_quotation_certification_asset_url(v_approver_signature)
    or not private.validate_quotation_certification_asset_url(v_stamp) then
    raise exception using errcode = '22023', message = 'Invalid quotation certification';
  end if;

  return jsonb_build_object(
    'issuer', jsonb_build_object(
      'name', nullif(btrim(coalesce(v_issuer ->> 'name', '')), ''),
      'position', nullif(btrim(coalesce(v_issuer ->> 'position', '')), ''),
      'signature_url', nullif(v_issuer_signature, '')
    ),
    'approver', jsonb_build_object(
      'name', nullif(btrim(coalesce(v_approver ->> 'name', '')), ''),
      'position', nullif(btrim(coalesce(v_approver ->> 'position', '')), ''),
      'signature_url', nullif(v_approver_signature, '')
    ),
    'company_stamp_url', nullif(v_stamp, '')
  );
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
  v_certification jsonb := private.normalize_quotation_certification(
    p_payload -> 'certification_snapshot'
  );
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
  update public.quotations
  set certification_snapshot = v_certification
  where quotations.id = v_saved.id
    and quotations.created_by = auth.uid()
    and quotations.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation does not belong to current user';
  end if;
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
      custom_bank_logo_url, account_number, account_type, account_name, promptpay_id, provider_name,
      instructions, qr_mode, qr_image_url, position
    ) values (
      (btrim(v_method ->> 'id'))::uuid, v_saved.id, v_type,
      case when v_type = 'bank_transfer' then coalesce(v_bank.code, 'OTHER') else '' end,
      case when v_type = 'bank_transfer' then coalesce(v_bank.name, btrim(coalesce(v_method ->> 'custom_bank_name', ''))) else '' end,
      case when v_type = 'bank_transfer' then coalesce(v_bank.logo_path, case when btrim(coalesce(v_method ->> 'bank_logo_url', '')) ~* '^/quotation/banks/[a-z0-9-]+\.svg$' then btrim(v_method ->> 'bank_logo_url') else '' end) else '' end,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_name', '')) else '' end,
      case when v_type = 'bank_transfer' and v_bank_id is null then btrim(coalesce(v_method ->> 'custom_bank_logo_url', '')) else '' end,
      case when v_type = 'bank_transfer' then btrim(coalesce(v_method ->> 'account_number', '')) else '' end,
      case when v_type = 'bank_transfer' then btrim(coalesce(v_method ->> 'account_type', '')) else '' end,
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

create or replace function private.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', q.id, 'document_number', q.document_number, 'issue_date', q.issue_date,
    'valid_until', q.valid_until, 'validity_days', q.validity_days, 'reference', q.reference,
    'subject', q.subject, 'seller_snapshot', q.seller_snapshot,
    'certification_snapshot', q.certification_snapshot,
    'customer_snapshot', jsonb_build_object('name', coalesce(q.customer_snapshot ->> 'name', ''), 'address', coalesce(q.customer_snapshot ->> 'address', ''), 'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''), 'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'), 'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')),
    'withholding_tax_rate', q.withholding_tax_rate, 'public_notes', q.public_notes,
    'quotation_items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'position', i.position, 'name', i.name, 'description', i.description, 'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price, 'discount_amount', i.discount_amount, 'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate) order by i.position) from public.quotation_items i where i.quotation_id = q.id), '[]'::jsonb),
    'quotation_payment_methods', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'type', p.type, 'position', p.position, 'bank_code', case when p.type = 'bank_transfer' then p.bank_code else '' end, 'bank_name', case when p.type = 'bank_transfer' then p.bank_name else '' end, 'bank_logo_url', case when p.type = 'bank_transfer' then p.bank_logo_url else '' end, 'custom_bank_name', case when p.type = 'bank_transfer' then p.custom_bank_name else '' end, 'custom_bank_logo_url', case when p.type = 'bank_transfer' then p.custom_bank_logo_url else '' end, 'account_number', case when p.type = 'bank_transfer' then p.account_number else '' end, 'account_type', case when p.type = 'bank_transfer' then p.account_type else '' end, 'account_name', case when p.type in ('bank_transfer', 'promptpay') then p.account_name else '' end, 'promptpay_id', case when p.type = 'promptpay' then p.promptpay_id else '' end, 'provider_name', case when p.type in ('qr_payment', 'other') then p.provider_name else '' end, 'instructions', p.instructions, 'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end, 'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end) order by p.position) from public.quotation_payment_methods p where p.quotation_id = q.id), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token and q.deleted_at is null;
$$;

revoke all on function private.validate_quotation_payment_method(jsonb) from public;
revoke all on function private.save_quotation_company_payment_methods(jsonb) from public;
revoke all on function private.save_quotation_with_payments(jsonb) from public;
revoke all on function private.normalize_quotation_certification(jsonb) from public;
revoke all on function private.validate_quotation_certification_asset_url(text) from public;
grant execute on function private.save_quotation_company_payment_methods(jsonb) to authenticated;
grant execute on function private.save_quotation_with_payments(jsonb) to authenticated;
