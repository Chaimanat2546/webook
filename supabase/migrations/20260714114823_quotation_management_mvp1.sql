create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.quotation_company_profiles (id smallint primary key default 1 check (id = 1), seller_name text not null default '', address text not null default '', tax_id text not null default '', office_type text not null default 'head_office' check (office_type in ('head_office', 'branch')), branch_number text not null default '', phone text not null default '', email text not null default '', website text not null default '', contact_name text not null default '', contact_phone text not null default '', contact_email text not null default '', logo_url text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.quotations (
  id uuid primary key default gen_random_uuid(), document_number text not null unique, issue_date date not null, valid_until date not null, validity_days integer check (validity_days is null or validity_days between 0 and 36500), reference text not null default '', subject text not null default '', currency text not null default 'THB' check (currency = 'THB'), price_mode text not null check (price_mode in ('vat_exclusive', 'vat_inclusive')), seller_snapshot jsonb not null, customer_snapshot jsonb not null, document_discount_type text check (document_discount_type is null or document_discount_type in ('amount', 'percent')), document_discount_value numeric(14,4) not null default 0 check (document_discount_value >= 0), subtotal numeric(14,2) not null check (subtotal >= 0), item_discount_total numeric(14,2) not null check (item_discount_total >= 0), document_discount_total numeric(14,2) not null check (document_discount_total >= 0), taxable_total numeric(14,2) not null check (taxable_total >= 0), vat_total numeric(14,2) not null check (vat_total >= 0), grand_total numeric(14,2) not null check (grand_total >= 0), public_notes text not null default '', internal_notes text not null default '', created_by uuid not null default auth.uid(), updated_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz, constraint quotations_valid_dates check (valid_until >= issue_date)
);
create table public.quotation_items (
 id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade, position integer not null check (position > 0), sku text not null default '', name text not null, description text not null default '', quantity numeric(12,3) not null check (quantity > 0), unit text not null, unit_price numeric(14,2) not null check (unit_price >= 0), discount_type text check (discount_type is null or discount_type in ('amount', 'percent')), discount_value numeric(14,4) not null default 0 check (discount_value >= 0), gross_amount numeric(14,2) not null check (gross_amount >= 0), discount_amount numeric(14,2) not null check (discount_amount >= 0), document_discount_allocation numeric(14,2) not null check (document_discount_allocation >= 0), vat_treatment text not null check (vat_treatment in ('taxable', 'exempt', 'none')), vat_rate numeric(5,2) not null check (vat_rate between 0 and 100), taxable_amount numeric(14,2) not null check (taxable_amount >= 0), vat_amount numeric(14,2) not null check (vat_amount >= 0), line_total numeric(14,2) not null check (line_total >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (quotation_id, position)
);
create table private.quotation_number_counters (issue_date date primary key, last_value integer not null check (last_value > 0));
create index quotations_active_updated_idx on public.quotations (updated_at desc) where deleted_at is null;
create index quotations_active_document_idx on public.quotations (document_number) where deleted_at is null;
create index quotation_items_quotation_position_idx on public.quotation_items (quotation_id, position);
alter table public.quotation_company_profiles enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
grant select, insert, update on public.quotation_company_profiles to authenticated;
grant select on public.quotations, public.quotation_items to authenticated;

create or replace function private.has_quotation_permission() returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.users where coalesce(users.allow_tools, '{}'::jsonb) @> '{"allow_quotation": true}'::jsonb and (users.uid = auth.uid() or users.email = auth.jwt() ->> 'email'));
$$;
create or replace function private.next_quotation_number(p_issue_date date) returns text language plpgsql security definer set search_path = pg_catalog, private as $$
declare v_running integer;
begin
 insert into private.quotation_number_counters (issue_date, last_value) values (p_issue_date, 1) on conflict (issue_date) do update set last_value = private.quotation_number_counters.last_value + 1 returning last_value into v_running;
 return 'QO-' || to_char(p_issue_date, 'YYYYMMDD') || '-' || case when v_running < 10000 then lpad(v_running::text, 4, '0') else v_running::text end;
end;
$$;
create policy "Quotation users can manage the company profile" on public.quotation_company_profiles for all to authenticated using ((select private.has_quotation_permission())) with check ((select private.has_quotation_permission()));
create policy "Quotation users can read active quotations" on public.quotations for select to authenticated using (deleted_at is null and (select private.has_quotation_permission()));
create policy "Quotation users can read active quotation items" on public.quotation_items for select to authenticated using ((select private.has_quotation_permission()) and exists (select 1 from public.quotations where quotations.id = quotation_items.quotation_id and quotations.deleted_at is null));

create function private.save_quotation(p_payload jsonb) returns table (id uuid, document_number text) language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_id uuid; v_document_number text; v_item jsonb; v_updated integer;
begin
 if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
 v_id := nullif(p_payload ->> 'id', '')::uuid;
 if v_id is null then
  v_id := gen_random_uuid(); v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
  insert into public.quotations (id,document_number,issue_date,valid_until,validity_days,reference,subject,currency,price_mode,seller_snapshot,customer_snapshot,document_discount_type,document_discount_value,subtotal,item_discount_total,document_discount_total,taxable_total,vat_total,grand_total,public_notes,internal_notes,created_by,updated_by) values (v_id,v_document_number,(p_payload ->> 'issue_date')::date,(p_payload ->> 'valid_until')::date,nullif(p_payload ->> 'validity_days','')::integer,coalesce(p_payload ->> 'reference',''),coalesce(p_payload ->> 'subject',''),p_payload ->> 'currency',p_payload ->> 'price_mode',p_payload -> 'seller_snapshot',p_payload -> 'customer_snapshot',nullif(p_payload ->> 'document_discount_type',''),(p_payload ->> 'document_discount_value')::numeric,(p_payload #>> '{totals,subtotal}')::numeric,(p_payload #>> '{totals,itemDiscountTotal}')::numeric,(p_payload #>> '{totals,documentDiscountTotal}')::numeric,(p_payload #>> '{totals,taxableTotal}')::numeric,(p_payload #>> '{totals,vatTotal}')::numeric,(p_payload #>> '{totals,grandTotal}')::numeric,coalesce(p_payload ->> 'public_notes',''),coalesce(p_payload ->> 'internal_notes',''),auth.uid(),auth.uid());
 else
  update public.quotations set issue_date=(p_payload ->> 'issue_date')::date,valid_until=(p_payload ->> 'valid_until')::date,validity_days=nullif(p_payload ->> 'validity_days','')::integer,reference=coalesce(p_payload ->> 'reference',''),subject=coalesce(p_payload ->> 'subject',''),currency=p_payload ->> 'currency',price_mode=p_payload ->> 'price_mode',seller_snapshot=p_payload -> 'seller_snapshot',customer_snapshot=p_payload -> 'customer_snapshot',document_discount_type=nullif(p_payload ->> 'document_discount_type',''),document_discount_value=(p_payload ->> 'document_discount_value')::numeric,subtotal=(p_payload #>> '{totals,subtotal}')::numeric,item_discount_total=(p_payload #>> '{totals,itemDiscountTotal}')::numeric,document_discount_total=(p_payload #>> '{totals,documentDiscountTotal}')::numeric,taxable_total=(p_payload #>> '{totals,taxableTotal}')::numeric,vat_total=(p_payload #>> '{totals,vatTotal}')::numeric,grand_total=(p_payload #>> '{totals,grandTotal}')::numeric,public_notes=coalesce(p_payload ->> 'public_notes',''),internal_notes=coalesce(p_payload ->> 'internal_notes',''),updated_by=auth.uid(),updated_at=now() where quotations.id=v_id and quotations.deleted_at is null returning quotations.document_number into v_document_number;
  get diagnostics v_updated = row_count; if v_updated = 0 then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if; delete from public.quotation_items where quotation_id = v_id;
 end if;
 for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
  insert into public.quotation_items (quotation_id,position,sku,name,description,quantity,unit,unit_price,discount_type,discount_value,gross_amount,discount_amount,document_discount_allocation,vat_treatment,vat_rate,taxable_amount,vat_amount,line_total) values (v_id,(v_item ->> 'position')::integer,coalesce(v_item ->> 'sku',''),v_item ->> 'name',coalesce(v_item ->> 'description',''),(v_item ->> 'quantity')::numeric,v_item ->> 'unit',(v_item ->> 'unit_price')::numeric,nullif(v_item ->> 'discount_type',''),(v_item ->> 'discount_value')::numeric,(v_item ->> 'gross_amount')::numeric,(v_item ->> 'discount_amount')::numeric,(v_item ->> 'document_discount_allocation')::numeric,v_item ->> 'vat_treatment',(v_item ->> 'vat_rate')::numeric,(v_item ->> 'taxable_amount')::numeric,(v_item ->> 'vat_amount')::numeric,(v_item ->> 'line_total')::numeric);
 end loop;
 return query select v_id, v_document_number;
end;
$$;
create or replace function private.soft_delete_quotation(p_id uuid) returns uuid language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_deleted_id uuid;
begin
 if not private.has_quotation_permission() then raise exception using errcode = '42501', message = 'Unauthorized'; end if;
 update public.quotations set deleted_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id and deleted_at is null returning id into v_deleted_id;
 if v_deleted_id is null then raise exception using errcode = 'P0002', message = 'Quotation not found'; end if; return v_deleted_id;
end;
$$;
create function public.save_quotation(p_payload jsonb) returns table (id uuid, document_number text) language sql security invoker set search_path = pg_catalog, public as $$ select * from private.save_quotation(p_payload); $$;
create function public.soft_delete_quotation(p_id uuid) returns uuid language sql security invoker set search_path = pg_catalog, public as $$ select private.soft_delete_quotation(p_id); $$;
create function public.list_quotations(p_search text default '',p_page integer default 1,p_page_size integer default 20) returns table (id uuid,document_number text,issue_date date,valid_until date,customer_name text,grand_total numeric,updated_at timestamptz,total_count bigint) language sql stable security invoker set search_path = pg_catalog, public as $$
 select quotations.id,quotations.document_number,quotations.issue_date,quotations.valid_until,coalesce(quotations.customer_snapshot ->> 'name',''),quotations.grand_total,quotations.updated_at,count(*) over () from public.quotations where quotations.deleted_at is null and (nullif(trim(p_search),'') is null or quotations.document_number ilike '%' || trim(p_search) || '%' or quotations.reference ilike '%' || trim(p_search) || '%' or quotations.subject ilike '%' || trim(p_search) || '%' or coalesce(quotations.customer_snapshot ->> 'name','') ilike '%' || trim(p_search) || '%') order by quotations.updated_at desc, quotations.id desc limit least(greatest(p_page_size, 1), 100) offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100);
$$;
revoke all on function private.has_quotation_permission() from public;
revoke all on function private.next_quotation_number(date) from public;
revoke all on function private.save_quotation(jsonb) from public;
revoke all on function private.soft_delete_quotation(uuid) from public;
revoke all on function public.save_quotation(jsonb) from public, anon;
revoke all on function public.soft_delete_quotation(uuid) from public, anon;
revoke all on function public.list_quotations(text, integer, integer) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_quotation_permission() to authenticated;
grant execute on function private.save_quotation(jsonb) to authenticated;
grant execute on function private.soft_delete_quotation(uuid) to authenticated;
grant execute on function public.save_quotation(jsonb) to authenticated;
grant execute on function public.soft_delete_quotation(uuid) to authenticated;
grant execute on function public.list_quotations(text, integer, integer) to authenticated;
