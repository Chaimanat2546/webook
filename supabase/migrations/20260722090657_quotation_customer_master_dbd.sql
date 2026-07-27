create table public.quotation_customers (
  id uuid primary key default gen_random_uuid(),
  customer_type text not null check (customer_type in ('juristic', 'individual')),
  tax_id text not null unique check (tax_id ~ '^[0-9]{13}$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text not null check (char_length(btrim(address)) between 1 and 2000),
  office_type text not null default 'unspecified'
    check (office_type in ('head_office', 'branch', 'unspecified')),
  branch_number text not null default ''
    check (char_length(branch_number) <= 200 and (office_type <> 'branch' or btrim(branch_number) <> '')),
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  contact_phone text not null default '' check (char_length(contact_phone) <= 200),
  contact_email text not null default '' check (
    char_length(contact_email) <= 200
    and (contact_email = '' or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  dbd_name text check (dbd_name is null or char_length(btrim(dbd_name)) between 1 and 200),
  dbd_address text check (dbd_address is null or char_length(btrim(dbd_address)) between 1 and 2000),
  dbd_status text check (dbd_status is null or char_length(btrim(dbd_status)) between 1 and 200),
  dbd_verified_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_customers_dbd_complete check (
    (dbd_name is null and dbd_address is null and dbd_status is null and dbd_verified_at is null)
    or (
      customer_type = 'juristic'
      and dbd_name is not null
      and dbd_address is not null
      and dbd_status is not null
      and dbd_verified_at is not null
    )
  )
);

create index quotation_customers_active_name_idx
  on public.quotation_customers (is_active, lower(name), updated_at desc);

create or replace function private.touch_quotation_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger quotation_customers_touch
before update on public.quotation_customers
for each row execute function private.touch_quotation_customer();

alter table public.quotation_customers enable row level security;
revoke all privileges on table public.quotation_customers from public, anon, authenticated;
grant select, insert, update on table public.quotation_customers to authenticated;

create policy "Quotation users manage shared customers"
on public.quotation_customers
for all
to authenticated
using ((select private.has_quotation_permission()))
with check ((select private.has_quotation_permission()));

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
    c.id,
    c.customer_type,
    c.tax_id,
    c.name,
    c.address,
    c.office_type,
    c.branch_number,
    c.contact_name,
    c.contact_phone,
    c.contact_email,
    c.dbd_name,
    c.dbd_address,
    c.dbd_status,
    c.dbd_verified_at,
    c.is_active,
    c.updated_at,
    count(*) over ()
  from public.quotation_customers c
  where c.is_active = p_active
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

revoke all on function public.list_quotation_customers(integer, integer, text, boolean)
  from public, anon;
grant execute on function public.list_quotation_customers(integer, integer, text, boolean)
  to authenticated;
