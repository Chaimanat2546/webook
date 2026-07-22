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
    delete from private.quotation_payment_asset_config where singleton;
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
