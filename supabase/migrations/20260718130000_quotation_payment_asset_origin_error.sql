create or replace function private.validate_quotation_payment_asset_url(p_url text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  v_origin text;
begin
  if coalesce(btrim(p_url), '') = '' then
    return true;
  end if;

  select origin
  into v_origin
  from private.quotation_payment_asset_config
  where singleton;

  if v_origin is null then
    raise exception using
      errcode = 'P0001',
      message = 'quotation_payment_asset_origin_not_configured';
  end if;

  return p_url like v_origin || '/quotations/payment-assets/%'
    and substring(p_url from char_length(v_origin) + 1) ~ '^/quotations/payment-assets/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.png$';
end;
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
  if p_origin is null then
    delete from private.quotation_payment_asset_config;
    return;
  end if;
  if btrim(p_origin) !~ '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]+)?$' then
    raise exception using errcode = '22023', message = 'Invalid media Worker origin';
  end if;
  insert into private.quotation_payment_asset_config (singleton, origin)
  values (true, btrim(p_origin))
  on conflict (singleton) do update set origin = excluded.origin;
end;
$$;

revoke all on function public.configure_quotation_payment_asset_origin(text) from public, anon, authenticated;
grant execute on function public.configure_quotation_payment_asset_origin(text) to service_role;
