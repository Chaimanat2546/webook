do $$
declare
  v_eligible_owner_count integer;
begin
  if exists (
    select 1
    from public.quotations q
    left join auth.users auth_user on auth_user.id = q.created_by
    where auth_user.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Quotation owner has no matching auth user';
  end if;

  if exists (select 1 from public.quotation_company_profiles)
    and not exists (select 1 from public.quotations) then
    select count(distinct auth_user.id)
    into v_eligible_owner_count
    from auth.users auth_user
    join public.users app_user
      on app_user.uid = auth_user.id
      or (app_user.uid is null and app_user.email = auth_user.email)
    where coalesce(app_user.allow_tools, '{}'::jsonb)
      @> '{"allow_quotation": true}'::jsonb;

    if v_eligible_owner_count <> 1 then
      raise exception using
        errcode = '23514',
        message = 'Legacy seller profile has no unambiguous auth user';
    end if;
  end if;
end;
$$;

alter table public.quotation_company_profiles
  drop constraint if exists quotation_company_profiles_id_check;
alter table public.quotation_company_profiles alter column id drop default;
alter table public.quotation_company_profiles alter column id type uuid using gen_random_uuid();
alter table public.quotation_company_profiles alter column id set default gen_random_uuid();
alter table public.quotation_company_profiles
  add column user_id uuid references auth.users(id) on delete cascade;

with quotation_owners as (
  select distinct q.created_by as user_id
  from public.quotations q
), eligible_owners as (
  select distinct auth_user.id as user_id
  from auth.users auth_user
  join public.users app_user
    on app_user.uid = auth_user.id
    or (app_user.uid is null and app_user.email = auth_user.email)
  where coalesce(app_user.allow_tools, '{}'::jsonb)
    @> '{"allow_quotation": true}'::jsonb
), chosen_owner as (
  select min(owner.user_id::text)::uuid as user_id
  from (
    select user_id from quotation_owners
    union all
    select user_id from eligible_owners
    where not exists (select 1 from quotation_owners)
  ) owner
)
update public.quotation_company_profiles profile
set user_id = chosen_owner.user_id
from chosen_owner;

with quotation_owners as (
  select distinct q.created_by as user_id
  from public.quotations q
), template_profile as (
  select profile.*
  from public.quotation_company_profiles profile
  order by profile.created_at, profile.id
  limit 1
)
insert into public.quotation_company_profiles (
  id, user_id, seller_name, address, tax_id, office_type, branch_number,
  phone, email, website, contact_name, contact_phone, contact_email,
  logo_url, created_at, updated_at
)
select
  gen_random_uuid(), owner.user_id,
  coalesce(nullif(template.seller_name, ''), latest.seller_snapshot ->> 'name', ''),
  coalesce(nullif(template.address, ''), latest.seller_snapshot ->> 'address', ''),
  coalesce(nullif(template.tax_id, ''), latest.seller_snapshot ->> 'taxId', ''),
  case
    when coalesce(nullif(template.office_type, ''), latest.seller_snapshot ->> 'officeType') = 'branch'
      then 'branch'
    else 'head_office'
  end,
  coalesce(nullif(template.branch_number, ''), latest.seller_snapshot ->> 'branchNumber', ''),
  coalesce(nullif(template.phone, ''), latest.seller_snapshot ->> 'phone', ''),
  coalesce(nullif(template.email, ''), latest.seller_snapshot ->> 'email', ''),
  coalesce(nullif(template.website, ''), latest.seller_snapshot ->> 'website', ''),
  coalesce(nullif(template.contact_name, ''), latest.seller_snapshot ->> 'contactName', ''),
  coalesce(nullif(template.contact_phone, ''), latest.seller_snapshot ->> 'contactPhone', ''),
  coalesce(nullif(template.contact_email, ''), latest.seller_snapshot ->> 'contactEmail', ''),
  coalesce(nullif(template.logo_url, ''), latest.seller_snapshot ->> 'logoUrl', ''),
  coalesce(template.created_at, now()), coalesce(template.updated_at, now())
from quotation_owners owner
left join template_profile template on true
left join lateral (
  select q.seller_snapshot
  from public.quotations q
  where q.created_by = owner.user_id
  order by q.updated_at desc, q.id desc
  limit 1
) latest on true
where not exists (
  select 1
  from public.quotation_company_profiles existing
  where existing.user_id = owner.user_id
);

alter table public.quotation_company_profiles
  alter column user_id set default auth.uid(),
  alter column user_id set not null,
  add constraint quotation_company_profiles_user_id_key unique (user_id);

create or replace function private.current_quotation_company_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select id
  from public.quotation_company_profiles
  where user_id = auth.uid()
$$;

alter table public.quotations
  add column company_profile_id uuid references public.quotation_company_profiles(id) on delete restrict;

update public.quotations q
set company_profile_id = profile.id
from public.quotation_company_profiles profile
where profile.user_id = q.created_by;

do $$
begin
  if exists (select 1 from public.quotations where company_profile_id is null) then
    raise exception using
      errcode = '23514',
      message = 'Quotation has no seller profile after ownership backfill';
  end if;
end;
$$;

alter table public.quotations
  alter column company_profile_id set default private.current_quotation_company_profile_id(),
  alter column company_profile_id set not null;

alter table public.banks
  add column if not exists code text unique,
  add column if not exists logo_path text not null default '';

insert into public.banks (name, code, logo_path, sort_order) values
  ('ธนาคารกรุงเทพ', '002', '/quotation/banks/bbl.svg', 10),
  ('ธนาคารกสิกรไทย', '004', '/quotation/banks/kbank.svg', 20),
  ('ธนาคารกรุงไทย', '006', '/quotation/banks/ktb.svg', 30),
  ('ธนาคารทหารไทยธนชาต', '011', '/quotation/banks/ttb.svg', 40),
  ('ธนาคารไทยพาณิชย์', '014', '/quotation/banks/scb.svg', 50),
  ('ธนาคารซีไอเอ็มบีไทย', '022', '/quotation/banks/cimbt.svg', 60),
  ('ธนาคารยูโอบี', '024', '/quotation/banks/uobt.svg', 70),
  ('ธนาคารกรุงศรีอยุธยา', '025', '/quotation/banks/bay.svg', 80),
  ('ธนาคารออมสิน', '030', '/quotation/banks/gsb.svg', 90),
  ('ธนาคารอาคารสงเคราะห์', '033', '/quotation/banks/ghb.svg', 100),
  ('ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', '034', '/quotation/banks/baac.svg', 110),
  ('ธนาคารอิสลามแห่งประเทศไทย', '066', '/quotation/banks/ibank.svg', 120),
  ('ธนาคารทิสโก้', '067', '/quotation/banks/tisco.svg', 130),
  ('ธนาคารเกียรตินาคินภัทร', '069', '/quotation/banks/kkp.svg', 140),
  ('ธนาคารไทยเครดิต', '071', '/quotation/banks/tcrb.svg', 150),
  ('ธนาคารแลนด์ แอนด์ เฮ้าส์', '073', '/quotation/banks/lh.svg', 160),
  ('ธนาคารอื่น ๆ', 'OTHER', '/quotation/banks/generic-bank.svg', 999)
on conflict (name) do update
set code = excluded.code,
    logo_path = excluded.logo_path,
    sort_order = excluded.sort_order;

drop policy if exists "auth: delete banks" on public.banks;
drop policy if exists "auth: insert banks" on public.banks;
drop policy if exists "auth: update banks" on public.banks;
revoke all privileges on table public.banks from anon, authenticated;
grant select on table public.banks to anon, authenticated;

create table public.quotation_company_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bank_transfer', 'promptpay', 'qr_payment', 'cash', 'other')),
  bank_id uuid references public.banks(id) on delete restrict,
  custom_bank_name text not null default '',
  custom_bank_logo_url text not null default '',
  account_number text not null default '',
  account_name text not null default '',
  promptpay_id text not null default '',
  provider_name text not null default '',
  instructions text not null default '',
  qr_mode text not null default 'none' check (qr_mode in ('none', 'upload', 'auto_promptpay')),
  qr_image_url text not null default '',
  is_default boolean not null default false,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, position)
);

create table public.quotation_payment_methods (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  type text not null check (type in ('bank_transfer', 'promptpay', 'qr_payment', 'cash', 'other')),
  bank_code text not null default '',
  bank_name text not null default '',
  bank_logo_url text not null default '',
  custom_bank_name text not null default '',
  custom_bank_logo_url text not null default '',
  account_number text not null default '',
  account_name text not null default '',
  promptpay_id text not null default '',
  provider_name text not null default '',
  instructions text not null default '',
  qr_mode text not null default 'none' check (qr_mode in ('none', 'upload', 'auto_promptpay')),
  qr_image_url text not null default '',
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quotation_id, position)
);

alter table public.quotation_company_payment_methods enable row level security;
alter table public.quotation_payment_methods enable row level security;
grant select on public.quotation_company_payment_methods, public.quotation_payment_methods to authenticated;

drop policy if exists "Quotation users can manage the company profile" on public.quotation_company_profiles;
drop policy if exists "Quotation users can read active quotations" on public.quotations;
drop policy if exists "Quotation users can read active quotation items" on public.quotation_items;

create policy "Quotation owners manage company profiles" on public.quotation_company_profiles
  for all to authenticated
  using (private.has_quotation_permission() and user_id = (select auth.uid()))
  with check (private.has_quotation_permission() and user_id = (select auth.uid()));
create policy "Quotation owners manage quotations" on public.quotations
  for all to authenticated
  using (private.has_quotation_permission() and created_by = (select auth.uid()) and deleted_at is null)
  with check (private.has_quotation_permission() and created_by = (select auth.uid()));
create policy "Quotation owners read items" on public.quotation_items
  for select to authenticated
  using (private.has_quotation_permission() and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.created_by = auth.uid() and q.deleted_at is null
  ));
create policy "Quotation owners manage payment masters" on public.quotation_company_payment_methods
  for all to authenticated
  using (private.has_quotation_permission() and user_id = (select auth.uid()))
  with check (private.has_quotation_permission() and user_id = (select auth.uid()));
create policy "Quotation owners read payment snapshots" on public.quotation_payment_methods
  for select to authenticated
  using (private.has_quotation_permission() and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.created_by = auth.uid() and q.deleted_at is null
  ));

create or replace function private.validate_quotation_payment_method(p_method jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type text := p_method ->> 'type';
  v_qr_mode text := coalesce(p_method ->> 'qr_mode', 'none');
  v_bank_id uuid := nullif(p_method ->> 'bank_id', '')::uuid;
  v_promptpay_id text := regexp_replace(coalesce(p_method ->> 'promptpay_id', ''), '\\D', '', 'g');
begin
  if jsonb_typeof(p_method) is distinct from 'object'
    or v_type not in ('bank_transfer', 'promptpay', 'qr_payment', 'cash', 'other')
    or v_qr_mode not in ('none', 'upload', 'auto_promptpay')
    or (v_type = 'bank_transfer' and (coalesce(p_method ->> 'account_number', '') = '' or coalesce(p_method ->> 'account_name', '') = '' or (v_bank_id is null and coalesce(p_method ->> 'custom_bank_name', '') = '')))
    or (v_type = 'promptpay' and (length(v_promptpay_id) not in (10, 13) or coalesce(p_method ->> 'account_name', '') = '' or v_qr_mode = 'none'))
    or (v_type = 'qr_payment' and (coalesce(p_method ->> 'provider_name', '') = '' or coalesce(p_method ->> 'qr_image_url', '') = ''))
    or (v_type = 'other' and coalesce(p_method ->> 'provider_name', '') = '')
    or (v_qr_mode = 'upload' and coalesce(p_method ->> 'qr_image_url', '') = '')
    or (v_qr_mode = 'auto_promptpay' and v_type <> 'promptpay')
    or (v_bank_id is not null and not exists (select 1 from public.banks where id = v_bank_id)) then
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
  v_bank public.banks%rowtype;
  v_position integer := 0;
  v_id uuid;
  v_type text;
  v_qr_mode text;
  v_bank_id uuid;
  v_promptpay_id text;
begin
  if not private.has_quotation_permission() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  if jsonb_typeof(p_methods) is distinct from 'array' or jsonb_array_length(p_methods) > 20 then
    raise exception using errcode = '22023', message = 'Payment methods must be an array of at most 20 rows';
  end if;

  delete from public.quotation_company_payment_methods where user_id = auth.uid();
  for v_method in select value from jsonb_array_elements(p_methods) loop
    v_type := v_method ->> 'type';
    v_qr_mode := coalesce(v_method ->> 'qr_mode', 'none');
    v_bank_id := nullif(v_method ->> 'bank_id', '')::uuid;
    v_promptpay_id := regexp_replace(coalesce(v_method ->> 'promptpay_id', ''), '\\D', '', 'g');
    perform private.validate_quotation_payment_method(v_method);
    if v_bank_id is not null then
      select * into v_bank from public.banks where id = v_bank_id;
    end if;
    v_id := coalesce(nullif(v_method ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.quotation_company_payment_methods (
      id, user_id, type, bank_id, custom_bank_name, custom_bank_logo_url,
      account_number, account_name, promptpay_id, provider_name, instructions,
      qr_mode, qr_image_url, is_default, position
    ) values (
      v_id, auth.uid(), v_type, v_bank_id, coalesce(v_method ->> 'custom_bank_name', ''),
      coalesce(v_method ->> 'custom_bank_logo_url', ''), coalesce(v_method ->> 'account_number', ''),
      coalesce(v_method ->> 'account_name', ''), v_promptpay_id, coalesce(v_method ->> 'provider_name', ''),
      coalesce(v_method ->> 'instructions', ''), v_qr_mode, coalesce(v_method ->> 'qr_image_url', ''),
      coalesce((v_method ->> 'is_default')::boolean, false), v_position
    );
    v_position := v_position + 1;
  end loop;
  return query select * from public.quotation_company_payment_methods where user_id = auth.uid() order by position;
end;
$$;

create or replace function private.soft_delete_quotation(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_deleted_id uuid;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  update public.quotations
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where id = p_id and created_by = auth.uid() and deleted_at is null
  returning id into v_deleted_id;
  if v_deleted_id is null then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if;
  return v_deleted_id;
end;
$$;

create or replace function public.list_quotations(p_search text default '', p_page integer default 1, p_page_size integer default 20)
returns table (id uuid, document_number text, issue_date date, valid_until date, customer_name text, grand_total numeric, updated_at timestamptz, total_count bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select q.id, q.document_number, q.issue_date, q.valid_until, coalesce(q.customer_snapshot ->> 'name', ''), q.grand_total, q.updated_at, count(*) over ()
  from public.quotations q
  where q.deleted_at is null
    and q.created_by = auth.uid()
    and (nullif(trim(p_search), '') is null or q.document_number ilike '%' || trim(p_search) || '%' or q.reference ilike '%' || trim(p_search) || '%' or q.subject ilike '%' || trim(p_search) || '%' or coalesce(q.customer_snapshot ->> 'name', '') ilike '%' || trim(p_search) || '%')
  order by q.updated_at desc, q.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100);
$$;

create or replace function private.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_document_number text;
  v_item jsonb;
  v_updated integer;
  v_expected_gross numeric;
  v_expected_discount numeric;
  v_expected_pre_tax numeric;
  v_expected_vat numeric;
  v_expected_grand numeric;
  v_expected_withholding numeric;
  v_expected_due numeric;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' or jsonb_array_length(p_payload -> 'items') not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;
  select sum(item.gross), sum(item.discount), sum(item.gross - item.discount), sum(case when item.vat_treatment = 'taxable' then round((item.gross - item.discount) * item.vat_rate / 100, 2) else 0 end)
  into v_expected_gross, v_expected_discount, v_expected_pre_tax, v_expected_vat
  from (
    select round((value ->> 'quantity')::numeric(12,3) * (value ->> 'unit_price')::numeric(14,2), 2) as gross, (value ->> 'discount_amount')::numeric(14,2) as discount, value ->> 'vat_treatment' as vat_treatment, (value ->> 'vat_rate')::numeric(5,2) as vat_rate
    from jsonb_array_elements(p_payload -> 'items')
  ) item;
  v_expected_grand := v_expected_pre_tax + v_expected_vat;
  v_expected_withholding := round(v_expected_pre_tax * coalesce(nullif(p_payload ->> 'withholding_tax_rate', '')::numeric(5,2), 0) / 100, 2);
  v_expected_due := v_expected_grand - v_expected_withholding;
  if (p_payload #>> '{totals,grossTotal}')::numeric(14,2) is distinct from v_expected_gross
    or (p_payload #>> '{totals,discountTotal}')::numeric(14,2) is distinct from v_expected_discount
    or (p_payload #>> '{totals,preTaxTotal}')::numeric(14,2) is distinct from v_expected_pre_tax
    or (p_payload #>> '{totals,vatTotal}')::numeric(14,2) is distinct from v_expected_vat
    or (p_payload #>> '{totals,grandTotal}')::numeric(14,2) is distinct from v_expected_grand
    or (p_payload #>> '{totals,withholdingTaxTotal}')::numeric(14,2) is distinct from v_expected_withholding
    or (p_payload #>> '{totals,amountDue}')::numeric(14,2) is distinct from v_expected_due then
    raise exception using errcode = '23514', message = 'Quotation totals do not match items';
  end if;
  v_id := nullif(p_payload ->> 'id', '')::uuid;
  if v_id is null then
    v_id := gen_random_uuid();
    v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
    insert into public.quotations (id, document_number, issue_date, valid_until, validity_days, reference, subject, seller_snapshot, customer_snapshot, gross_total, discount_total, pre_tax_total, vat_total, grand_total, withholding_tax_rate, withholding_tax_total, amount_due, public_notes, internal_notes, created_by, updated_by)
    values (v_id, v_document_number, (p_payload ->> 'issue_date')::date, (p_payload ->> 'valid_until')::date, nullif(p_payload ->> 'validity_days', '')::integer, coalesce(p_payload ->> 'reference', ''), coalesce(p_payload ->> 'subject', ''), p_payload -> 'seller_snapshot', p_payload -> 'customer_snapshot', (p_payload #>> '{totals,grossTotal}')::numeric, (p_payload #>> '{totals,discountTotal}')::numeric, (p_payload #>> '{totals,preTaxTotal}')::numeric, (p_payload #>> '{totals,vatTotal}')::numeric, (p_payload #>> '{totals,grandTotal}')::numeric, nullif(p_payload ->> 'withholding_tax_rate', '')::numeric, (p_payload #>> '{totals,withholdingTaxTotal}')::numeric, (p_payload #>> '{totals,amountDue}')::numeric, coalesce(p_payload ->> 'public_notes', ''), coalesce(p_payload ->> 'internal_notes', ''), auth.uid(), auth.uid());
  else
    update public.quotations set issue_date = (p_payload ->> 'issue_date')::date, valid_until = (p_payload ->> 'valid_until')::date, validity_days = nullif(p_payload ->> 'validity_days', '')::integer, reference = coalesce(p_payload ->> 'reference', ''), subject = coalesce(p_payload ->> 'subject', ''), seller_snapshot = p_payload -> 'seller_snapshot', customer_snapshot = p_payload -> 'customer_snapshot', gross_total = (p_payload #>> '{totals,grossTotal}')::numeric, discount_total = (p_payload #>> '{totals,discountTotal}')::numeric, pre_tax_total = (p_payload #>> '{totals,preTaxTotal}')::numeric, vat_total = (p_payload #>> '{totals,vatTotal}')::numeric, grand_total = (p_payload #>> '{totals,grandTotal}')::numeric, withholding_tax_rate = nullif(p_payload ->> 'withholding_tax_rate', '')::numeric, withholding_tax_total = (p_payload #>> '{totals,withholdingTaxTotal}')::numeric, amount_due = (p_payload #>> '{totals,amountDue}')::numeric, public_notes = coalesce(p_payload ->> 'public_notes', ''), internal_notes = coalesce(p_payload ->> 'internal_notes', ''), updated_by = auth.uid(), updated_at = now()
    where quotations.id = v_id and quotations.created_by = auth.uid() and quotations.deleted_at is null
    returning quotations.document_number into v_document_number;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;
  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.quotation_items (quotation_id, position, name, description, quantity, unit, unit_price, discount_amount, vat_treatment, vat_rate)
    values (v_id, (v_item ->> 'position')::integer, v_item ->> 'name', coalesce(v_item ->> 'description', ''), (v_item ->> 'quantity')::numeric, nullif(v_item ->> 'unit', ''), (v_item ->> 'unit_price')::numeric, (v_item ->> 'discount_amount')::numeric, v_item ->> 'vat_treatment', (v_item ->> 'vat_rate')::numeric);
  end loop;
  return query select v_id, v_document_number;
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
  v_position integer := 1;
  v_type text;
  v_qr_mode text;
  v_bank_id uuid;
  v_promptpay_id text;
begin
  if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
  select id into v_profile_id from public.quotation_company_profiles where user_id = auth.uid();
  if v_profile_id is null then raise exception using errcode = '23514', message = 'Seller profile not found'; end if;
  v_submitted_profile_id := nullif(p_payload ->> 'company_profile_id', '')::uuid;
  if v_submitted_profile_id is not null and v_submitted_profile_id <> v_profile_id then
    raise exception using errcode = '42501', message = 'Seller profile does not belong to current user';
  end if;
  if jsonb_typeof(coalesce(p_payload -> 'payment_methods', '[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(p_payload -> 'payment_methods', '[]'::jsonb)) > 20 then
    raise exception using errcode = '22023', message = 'Payment methods must be an array of at most 20 rows';
  end if;
  select * into v_saved from private.save_quotation(p_payload);
  if not exists (select 1 from public.quotations where id = v_saved.id and company_profile_id = v_profile_id and created_by = auth.uid() and deleted_at is null) then
    update public.quotations set company_profile_id = v_profile_id
    where id = v_saved.id and created_by = auth.uid() and deleted_at is null;
  end if;
  if not exists (select 1 from public.quotations where id = v_saved.id and company_profile_id = v_profile_id and created_by = auth.uid() and deleted_at is null) then
    raise exception using errcode = '42501', message = 'Quotation seller profile does not belong to current user';
  end if;
  delete from public.quotation_payment_methods where quotation_id = v_saved.id;
  for v_method in select value from jsonb_array_elements(coalesce(p_payload -> 'payment_methods', '[]'::jsonb)) loop
    v_type := v_method ->> 'type';
    v_qr_mode := coalesce(v_method ->> 'qr_mode', 'none');
    v_bank_id := nullif(v_method ->> 'bank_id', '')::uuid;
    v_promptpay_id := regexp_replace(coalesce(v_method ->> 'promptpay_id', ''), '\\D', '', 'g');
    perform private.validate_quotation_payment_method(v_method);
    select * into v_bank from public.banks where id = v_bank_id;
    insert into public.quotation_payment_methods (id, quotation_id, type, bank_code, bank_name, bank_logo_url, custom_bank_name, custom_bank_logo_url, account_number, account_name, promptpay_id, provider_name, instructions, qr_mode, qr_image_url, position)
    values (coalesce(nullif(v_method ->> 'id', '')::uuid, gen_random_uuid()), v_saved.id, v_type, coalesce(v_bank.code, ''), coalesce(v_bank.name, v_method ->> 'custom_bank_name', ''), coalesce(v_bank.logo_path, v_method ->> 'custom_bank_logo_url', ''), coalesce(v_method ->> 'custom_bank_name', ''), coalesce(v_method ->> 'custom_bank_logo_url', ''), coalesce(v_method ->> 'account_number', ''), coalesce(v_method ->> 'account_name', ''), v_promptpay_id, coalesce(v_method ->> 'provider_name', ''), coalesce(v_method ->> 'instructions', ''), v_qr_mode, coalesce(v_method ->> 'qr_image_url', ''), v_position);
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
    'customer_snapshot', jsonb_build_object('name', coalesce(q.customer_snapshot ->> 'name', ''), 'address', coalesce(q.customer_snapshot ->> 'address', ''), 'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''), 'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'), 'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')),
    'withholding_tax_rate', q.withholding_tax_rate, 'public_notes', q.public_notes,
    'quotation_items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'position', i.position, 'name', i.name, 'description', i.description, 'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price, 'discount_amount', i.discount_amount, 'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate) order by i.position) from public.quotation_items i where i.quotation_id = q.id), '[]'::jsonb),
    'quotation_payment_methods', coalesce((select jsonb_agg(to_jsonb(p) order by p.position) from public.quotation_payment_methods p where p.quotation_id = q.id), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token and q.deleted_at is null;
$$;

create or replace function public.save_quotation_with_payments(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.save_quotation_with_payments(p_payload); $$;
create or replace function public.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.save_quotation_with_payments(p_payload); $$;
create or replace function public.save_quotation_company_payment_methods(p_methods jsonb)
returns setof public.quotation_company_payment_methods
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.save_quotation_company_payment_methods(p_methods); $$;

revoke all on function private.current_quotation_company_profile_id() from public;
revoke all on function private.validate_quotation_payment_method(jsonb) from public;
revoke execute on function private.save_quotation(jsonb) from authenticated;
revoke all on function private.save_quotation_with_payments(jsonb) from public;
revoke all on function private.save_quotation_company_payment_methods(jsonb) from public;
revoke all on function public.save_quotation_with_payments(jsonb) from public, anon;
revoke all on function public.save_quotation_company_payment_methods(jsonb) from public, anon;
grant execute on function private.current_quotation_company_profile_id() to authenticated;
grant execute on function private.save_quotation_with_payments(jsonb) to authenticated;
grant execute on function private.save_quotation_company_payment_methods(jsonb) to authenticated;
grant execute on function public.save_quotation_with_payments(jsonb) to authenticated;
grant execute on function public.save_quotation_company_payment_methods(jsonb) to authenticated;
