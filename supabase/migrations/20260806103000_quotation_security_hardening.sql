-- Keep customer masters isolated to the seller that owns them.  Earlier
-- releases treated this table as a shared catalogue, which leaked customer
-- details between independent seller accounts.
alter table public.quotation_customers
  add column if not exists owner_id uuid;

update public.quotation_customers
set owner_id = created_by
where owner_id is null;

alter table public.quotation_customers
  alter column owner_id set not null;

drop index if exists public.quotation_customers_individual_tax_id_uidx;
drop index if exists public.quotation_customers_juristic_main_tax_id_uidx;
drop index if exists public.quotation_customers_juristic_branch_uidx;

create unique index quotation_customers_owner_individual_tax_id_uidx
  on public.quotation_customers (owner_id, tax_id)
  where customer_type = 'individual';

create unique index quotation_customers_owner_juristic_main_tax_id_uidx
  on public.quotation_customers (owner_id, tax_id)
  where customer_type = 'juristic' and office_type <> 'branch';

create unique index quotation_customers_owner_juristic_branch_uidx
  on public.quotation_customers (owner_id, tax_id, branch_number)
  where customer_type = 'juristic' and office_type = 'branch';

drop policy if exists "Quotation users read shared customers" on public.quotation_customers;
create policy "Quotation users read their customers"
on public.quotation_customers
for select
to authenticated
using (
  (select private.has_quotation_permission())
  and owner_id = auth.uid()
);

create or replace function public.list_quotation_customers(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default '',
  p_active boolean default true
)
returns table (
  id uuid,
  customer_type text,
  tax_id text,
  name text,
  address text,
  office_type text,
  branch_number text,
  contact_name text,
  contact_phone text,
  contact_email text,
  dbd_name text,
  dbd_address text,
  dbd_status text,
  dbd_verified_at timestamptz,
  is_active boolean,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id, c.customer_type, c.tax_id, c.name, c.address, c.office_type,
    c.branch_number, c.contact_name, c.contact_phone, c.contact_email,
    c.dbd_name, c.dbd_address, c.dbd_status, c.dbd_verified_at,
    c.is_active, c.updated_at, count(*) over ()
  from public.quotation_customers c
  where c.owner_id = auth.uid()
    and c.is_active = p_active
    and (
      nullif(btrim(p_search), '') is null
      or c.name ilike '%' || btrim(p_search) || '%'
      or c.tax_id ilike '%' || btrim(p_search) || '%'
      or c.contact_name ilike '%' || btrim(p_search) || '%'
      or c.contact_phone ilike '%' || btrim(p_search) || '%'
      or c.contact_email ilike '%' || btrim(p_search) || '%'
    )
  order by c.updated_at desc, c.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100);
$$;

-- Publishing is a write capability, so it must honour entitlement changes in
-- the same way as all other quotation mutations.
create or replace function public.publish_quotation_document_template_layout(
  p_template_key text,
  p_expected_revision_number bigint,
  p_layout_config jsonb
)
returns table (template_id uuid, revision_number bigint, layout_config jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template record;
  v_revision_number bigint;
begin
  if not private.has_quotation_permission()
    or auth.uid() is null
    or p_template_key not in ('current', 'hospitality', 'corporate') then
    raise exception using errcode = '42501', message = 'Quotation layout publication denied';
  end if;
  if not private.is_quotation_layout(p_layout_config, p_template_key) then
    raise exception using errcode = '22023', message = 'Invalid quotation layout';
  end if;

  select id, current_revision_number into v_template
  from public.quotation_document_templates
  where user_id = auth.uid() and template_key = p_template_key
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation layout template not found';
  end if;
  if p_expected_revision_number <> v_template.current_revision_number then
    raise exception using errcode = '40001', message = 'Quotation layout revision conflict';
  end if;

  v_revision_number := v_template.current_revision_number + 1;
  insert into public.quotation_document_template_revisions (
    template_id, revision_number, layout_schema_version, layout_config, created_by
  ) values (v_template.id, v_revision_number, 2, p_layout_config, auth.uid());
  update public.quotation_document_templates
  set current_revision_number = v_revision_number, updated_at = now()
  where id = v_template.id;
  return query select v_template.id, v_revision_number, p_layout_config;
end;
$$;

-- Public links are bearer credentials.  Give them a bounded lifetime and let
-- the document owner rotate a link immediately if it has been shared too far.
alter table public.quotations
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists public_token_revoked_at timestamptz;

alter table public.quotations
  alter column public_token_expires_at set default (now() + interval '30 days');

create or replace function public.rotate_quotation_public_token(p_id uuid)
returns table (public_token uuid, public_token_expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.has_quotation_permission() then
    raise exception using errcode = '42501', message = 'Quotation public link rotation denied';
  end if;
  return query
  update public.quotations q
  set public_token = gen_random_uuid(),
      public_token_expires_at = now() + interval '30 days',
      public_token_revoked_at = null
  where q.id = p_id and q.created_by = auth.uid() and q.deleted_at is null
  returning q.public_token, q.public_token_expires_at;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation public link rotation denied';
  end if;
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
    'valid_until', q.valid_until, 'validity_days', q.validity_days,
    'reference', q.reference, 'subject', q.subject,
    'seller_snapshot', q.seller_snapshot, 'certification_snapshot', q.certification_snapshot,
    'document_display_snapshot', q.document_display_snapshot,
    'document_template_snapshot', q.document_template_snapshot,
    'document_template_revision_snapshot', q.document_template_revision_snapshot,
    'document_layout_schema_version_snapshot', q.document_layout_schema_version_snapshot,
    'document_layout_snapshot', q.document_layout_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')
    ),
    'withholding_tax_rate', q.withholding_tax_rate, 'public_notes', q.public_notes,
    'quotation_items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'position', i.position, 'name', i.name, 'description', i.description,
      'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price,
      'discount_amount', i.discount_amount, 'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate
    ) order by i.position) from public.quotation_items i where i.quotation_id = q.id), '[]'::jsonb),
    'quotation_payment_methods', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'type', p.type, 'position', p.position,
      'bank_code', case when p.type = 'bank_transfer' then p.bank_code else '' end,
      'bank_name', case when p.type = 'bank_transfer' then p.bank_name else '' end,
      'bank_logo_url', case when p.type = 'bank_transfer' then p.bank_logo_url else '' end,
      'custom_bank_name', case when p.type = 'bank_transfer' then p.custom_bank_name else '' end,
      'custom_bank_logo_url', case when p.type = 'bank_transfer' then p.custom_bank_logo_url else '' end,
      'account_number', case when p.type = 'bank_transfer' then p.account_number else '' end,
      'account_type', case when p.type = 'bank_transfer' then p.account_type else '' end,
      'account_name', case when p.type in ('bank_transfer', 'promptpay') then p.account_name else '' end,
      'promptpay_id', case when p.type = 'promptpay' then p.promptpay_id else '' end,
      'provider_name', case when p.type in ('qr_payment', 'other') then p.provider_name else '' end,
      'instructions', p.instructions, 'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end,
      'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end
    ) order by p.position) from public.quotation_payment_methods p where p.quotation_id = q.id), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null
    and q.public_token_revoked_at is null
    and (q.public_token_expires_at is null or q.public_token_expires_at > now());
$$;

revoke all on function public.rotate_quotation_public_token(uuid) from public, anon;
grant execute on function public.rotate_quotation_public_token(uuid) to authenticated;
