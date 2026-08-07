create table public.quotation_document_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null check (template_key in ('current', 'hospitality', 'corporate')),
  current_revision_number bigint not null check (current_revision_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key)
);

create table public.quotation_document_template_revisions (
  template_id uuid not null references public.quotation_document_templates(id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  layout_schema_version integer not null check (layout_schema_version > 0),
  layout_config jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (template_id, revision_number)
);

create index quotation_document_templates_user_id_idx
  on public.quotation_document_templates(user_id);

create or replace function private.canonical_quotation_layout(p_template_key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_template_key
    when 'current' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"summary","zone":"settlement","column":1,"order":10,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":20,"span":12},{"id":"publicNotes","zone":"settlement","column":1,"order":30,"span":12},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
    when 'hospitality' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":7},{"id":"documentMetadata","zone":"header","column":8,"order":10,"span":5},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12},{"id":"sellerFooter","zone":"footer","column":1,"order":10,"span":12}]}'::jsonb
    when 'corporate' then '{"schemaVersion":1,"blocks":[{"id":"seller","zone":"header","column":1,"order":10,"span":6},{"id":"documentMetadata","zone":"header","column":7,"order":10,"span":6},{"id":"customer","zone":"body","column":1,"order":10,"span":12},{"id":"items","zone":"body","column":1,"order":20,"span":12},{"id":"paymentMethods","zone":"settlement","column":1,"order":10,"span":8},{"id":"summary","zone":"settlement","column":9,"order":10,"span":4},{"id":"publicNotes","zone":"settlement","column":1,"order":20,"span":8},{"id":"certification","zone":"certification","column":1,"order":10,"span":12}]}'::jsonb
  end;
$$;

create or replace function private.is_quotation_layout(p_value jsonb, p_template_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_template_key in ('current', 'hospitality', 'corporate')
    and jsonb_typeof(p_value) = 'object'
    and p_value ?& array['schemaVersion', 'blocks']
    and p_value - 'schemaVersion' - 'blocks' = '{}'::jsonb
    and p_value ->> 'schemaVersion' = '1'
    and jsonb_typeof(p_value -> 'blocks') = 'array'
    and jsonb_array_length(p_value -> 'blocks') = case when p_template_key = 'hospitality' then 9 else 8 end
    and not exists (
      select 1
      from jsonb_array_elements(p_value -> 'blocks') as element(value)
      where jsonb_typeof(element.value) <> 'object'
        or not (element.value ?& array['id', 'zone', 'column', 'order', 'span'])
        or element.value - 'id' - 'zone' - 'column' - 'order' - 'span' <> '{}'::jsonb
        or element.value ->> 'id' not in ('seller', 'documentMetadata', 'customer', 'items', 'summary', 'paymentMethods', 'publicNotes', 'certification', 'sellerFooter')
        or (p_template_key <> 'hospitality' and element.value ->> 'id' = 'sellerFooter')
        or element.value ->> 'zone' not in ('header', 'body', 'settlement', 'footer', 'certification')
        or jsonb_typeof(element.value -> 'column') <> 'number'
        or jsonb_typeof(element.value -> 'order') <> 'number'
        or jsonb_typeof(element.value -> 'span') <> 'number'
        or element.value ->> 'column' !~ '^[1-9][0-9]*$'
        or element.value ->> 'order' !~ '^[1-9][0-9]*$'
        or element.value ->> 'span' !~ '^[1-9][0-9]*$'
        or (element.value ->> 'column')::integer > 12
        or (element.value ->> 'span')::integer > 12
        or (element.value ->> 'column')::integer + (element.value ->> 'span')::integer - 1 > 12
        or (element.value ->> 'order')::integer > 1000
        or mod((element.value ->> 'order')::integer, 10) <> 0
        or case element.value ->> 'id'
          when 'seller' then element.value ->> 'zone' <> 'header' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'documentMetadata' then element.value ->> 'zone' <> 'header' or (element.value ->> 'span')::integer not in (4, 5, 6, 7, 8, 12)
          when 'customer' then element.value ->> 'zone' <> 'body' or (element.value ->> 'span')::integer <> 12
          when 'items' then element.value ->> 'zone' <> 'body' or (element.value ->> 'span')::integer <> 12
          when 'summary' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 6, 8, 12)
          when 'paymentMethods' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 6, 8, 12)
          when 'publicNotes' then element.value ->> 'zone' <> 'settlement' or (element.value ->> 'span')::integer not in (4, 6, 8, 12)
          when 'certification' then element.value ->> 'zone' <> 'certification' or (element.value ->> 'span')::integer <> 12
          when 'sellerFooter' then element.value ->> 'zone' <> 'footer' or (element.value ->> 'span')::integer <> 12
          else true
        end
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_value -> 'blocks') as element(value)
      group by element.value ->> 'id'
      having count(*) <> 1
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_value -> 'blocks') with ordinality as left_block(value, ordinal_position)
      join jsonb_array_elements(p_value -> 'blocks') with ordinality as right_block(value, ordinal_position)
        on left_block.ordinal_position < right_block.ordinal_position
      where left_block.value ->> 'zone' = right_block.value ->> 'zone'
        and left_block.value ->> 'order' = right_block.value ->> 'order'
        and (left_block.value ->> 'column')::integer <= (right_block.value ->> 'column')::integer + (right_block.value ->> 'span')::integer - 1
        and (right_block.value ->> 'column')::integer <= (left_block.value ->> 'column')::integer + (left_block.value ->> 'span')::integer - 1
    );
$$;

create or replace function private.ensure_quotation_document_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template_id uuid;
  v_template_key text;
begin
  foreach v_template_key in array array['current', 'hospitality', 'corporate'] loop
    insert into public.quotation_document_templates (user_id, template_key, current_revision_number)
    values (p_user_id, v_template_key, 1)
    on conflict (user_id, template_key) do nothing
    returning id into v_template_id;

    if found then
      insert into public.quotation_document_template_revisions (
        template_id, revision_number, layout_schema_version, layout_config, created_by
      ) values (
        v_template_id, 1, 1, private.canonical_quotation_layout(v_template_key), p_user_id
      );
    end if;
  end loop;
end;
$$;

select private.ensure_quotation_document_templates(account.user_id)
from (
  select user_id from public.quotation_company_profiles
  union
  select created_by as user_id from public.quotations
) as account;

create or replace function private.provision_quotation_document_templates()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.ensure_quotation_document_templates(new.user_id);
  return new;
end;
$$;

create trigger quotation_company_profiles_provision_document_templates
after insert on public.quotation_company_profiles
for each row execute function private.provision_quotation_document_templates();

alter table public.quotations
  add column document_template_source_id uuid references public.quotation_document_templates(id) on delete set null,
  add column document_template_revision_snapshot bigint,
  add column document_layout_schema_version_snapshot integer,
  add column document_layout_snapshot jsonb;

-- Legacy rows may predate the snapshot input rule and are intentionally kept
-- under a NOT VALID constraint. Re-add that same rule after the backfill so
-- updating the new layout columns does not reject an otherwise preserved legacy row.
alter table public.quotations
  drop constraint if exists quotations_snapshot_input_rules_valid;

update public.quotations quotation
set document_template_source_id = template.id,
    document_template_revision_snapshot = 1,
    document_layout_schema_version_snapshot = 1,
    document_layout_snapshot = revision.layout_config
from public.quotation_document_templates template
join public.quotation_document_template_revisions revision
  on revision.template_id = template.id and revision.revision_number = 1
where template.user_id = quotation.created_by
  and template.template_key = quotation.document_template_snapshot;

alter table public.quotations
  alter column document_template_revision_snapshot set not null,
  alter column document_layout_schema_version_snapshot set not null,
  alter column document_layout_snapshot set not null,
  add constraint quotations_document_template_revision_snapshot_valid
    check (document_template_revision_snapshot > 0),
  add constraint quotations_document_layout_schema_version_snapshot_valid
    check (document_layout_schema_version_snapshot > 0),
  add constraint quotations_document_layout_snapshot_valid
    check (private.is_quotation_layout(document_layout_snapshot, document_template_snapshot));

alter table public.quotations
  add constraint quotations_snapshot_input_rules_valid check (
    jsonb_typeof(seller_snapshot) = 'object'
    and jsonb_typeof(customer_snapshot) = 'object'
    and coalesce(seller_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(customer_snapshot ->> 'taxId', '') ~ '^[0-9]{13}$'
    and coalesce(seller_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and coalesce(customer_snapshot ->> 'officeType', '') in ('head_office', 'branch', 'unspecified')
    and (seller_snapshot ->> 'officeType' <> 'branch' or btrim(coalesce(seller_snapshot ->> 'branchNumber', '')) <> '')
    and (customer_snapshot ->> 'officeType' <> 'branch' or btrim(coalesce(customer_snapshot ->> 'branchNumber', '')) <> '')
  ) not valid;

alter table public.quotation_document_templates enable row level security;
alter table public.quotation_document_template_revisions enable row level security;

create policy "Quotation users read owned document templates"
  on public.quotation_document_templates for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Quotation users read owned document template revisions"
  on public.quotation_document_template_revisions for select to authenticated
  using (exists (
    select 1
    from public.quotation_document_templates template
    where template.id = quotation_document_template_revisions.template_id
      and template.user_id = (select auth.uid())
  ));

revoke all on table public.quotation_document_templates from anon, authenticated;
revoke all on table public.quotation_document_template_revisions from anon, authenticated;
grant select on table public.quotation_document_templates to authenticated;
grant select on table public.quotation_document_template_revisions to authenticated;

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
  if auth.uid() is null or p_template_key not in ('current', 'hospitality', 'corporate') then
    raise exception using errcode = '42501', message = 'Quotation layout publication denied';
  end if;
  if not private.is_quotation_layout(p_layout_config, p_template_key) then
    raise exception using errcode = '22023', message = 'Invalid quotation layout';
  end if;

  select id, current_revision_number
  into v_template
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
  ) values (v_template.id, v_revision_number, 1, p_layout_config, auth.uid());
  update public.quotation_document_templates
  set current_revision_number = v_revision_number, updated_at = now()
  where id = v_template.id;

  return query select v_template.id, v_revision_number, p_layout_config;
end;
$$;

create or replace function private.save_quotation_with_template(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_template text := btrim(coalesce(p_payload ->> 'document_template_snapshot', ''));
  v_source_id uuid := nullif(p_payload ->> 'document_template_source_id', '')::uuid;
  v_revision_number bigint := nullif(p_payload ->> 'document_template_revision_snapshot', '')::bigint;
  v_schema_version integer := nullif(p_payload ->> 'document_layout_schema_version_snapshot', '')::integer;
  v_layout jsonb := p_payload -> 'document_layout_snapshot';
  v_saved record;
begin
  if not private.is_quotation_template(v_template)
    or v_source_id is null
    or v_revision_number is null
    or v_schema_version <> 1
    or not private.is_quotation_layout(v_layout, v_template) then
    raise exception using errcode = '22023', message = 'Invalid quotation document layout snapshot';
  end if;

  perform 1
  from public.quotation_document_templates template
  join public.quotation_document_template_revisions revision
    on revision.template_id = template.id and revision.revision_number = v_revision_number
  where template.id = v_source_id
    and template.user_id = auth.uid()
    and template.template_key = v_template
    and revision.layout_schema_version = v_schema_version
    and revision.layout_config = v_layout;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation document layout snapshot denied';
  end if;

  select * into v_saved from private.save_quotation_with_document_display(p_payload);
  update public.quotations quotation
  set document_template_source_id = v_source_id,
      document_template_revision_snapshot = v_revision_number,
      document_layout_schema_version_snapshot = v_schema_version,
      document_layout_snapshot = v_layout
  where quotation.id = v_saved.id
    and quotation.created_by = auth.uid()
    and quotation.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'Quotation document layout update denied';
  end if;
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
    'valid_until', q.valid_until, 'validity_days', q.validity_days,
    'reference', q.reference, 'subject', q.subject,
    'seller_snapshot', q.seller_snapshot,
    'certification_snapshot', q.certification_snapshot,
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
    'withholding_tax_rate', q.withholding_tax_rate,
    'public_notes', q.public_notes,
    'quotation_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'position', i.position, 'name', i.name,
        'description', i.description, 'quantity', i.quantity, 'unit', i.unit,
        'unit_price', i.unit_price, 'discount_amount', i.discount_amount,
        'vat_treatment', i.vat_treatment, 'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i where i.quotation_id = q.id
    ), '[]'::jsonb),
    'quotation_payment_methods', coalesce((
      select jsonb_agg(jsonb_build_object(
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
        'instructions', p.instructions,
        'qr_mode', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') then p.qr_mode else 'none' end,
        'qr_image_url', case when p.type in ('bank_transfer', 'promptpay', 'qr_payment') and p.qr_mode = 'upload' then p.qr_image_url else '' end
      ) order by p.position)
      from public.quotation_payment_methods p where p.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token and q.deleted_at is null;
$$;

revoke all on function private.canonical_quotation_layout(text) from public, anon;
revoke all on function private.is_quotation_layout(jsonb, text) from public, anon;
revoke all on function private.ensure_quotation_document_templates(uuid) from public, anon;
revoke all on function private.provision_quotation_document_templates() from public, anon;
revoke all on function public.publish_quotation_document_template_layout(text, bigint, jsonb) from public, anon;
grant execute on function public.publish_quotation_document_template_layout(text, bigint, jsonb) to authenticated;
