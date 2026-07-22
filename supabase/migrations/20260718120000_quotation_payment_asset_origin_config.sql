create table private.quotation_payment_asset_config (
  singleton boolean primary key default true check (singleton),
  origin text not null check (origin ~ '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]+)?$')
);

revoke all on table private.quotation_payment_asset_config from public, anon, authenticated;

create or replace function private.validate_quotation_payment_asset_url(p_url text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(btrim(p_url), '') = ''
    or exists (
      select 1
      from private.quotation_payment_asset_config
      where p_url like origin || '/quotations/payment-assets/%'
        and substring(p_url from char_length(origin) + 1) ~ '^/quotations/payment-assets/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
    )
$$;

revoke all on function private.validate_quotation_payment_asset_url(text) from public;
grant execute on function private.validate_quotation_payment_asset_url(text) to authenticated;

create or replace function public.configure_quotation_payment_asset_origin(p_origin text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  if p_origin is null or btrim(p_origin) !~ '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]+)?$' then
    raise exception using errcode = '22023', message = 'Invalid media Worker origin';
  end if;
  insert into private.quotation_payment_asset_config (singleton, origin)
  values (true, btrim(p_origin))
  on conflict (singleton) do update set origin = excluded.origin;
end;
$$;

revoke all on function public.configure_quotation_payment_asset_origin(text) from public, anon, authenticated;
grant execute on function public.configure_quotation_payment_asset_origin(text) to service_role;
