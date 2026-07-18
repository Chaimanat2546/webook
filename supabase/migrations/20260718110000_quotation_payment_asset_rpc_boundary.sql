create or replace function private.validate_quotation_payment_asset_url(p_url text)
returns boolean
language sql
immutable
as $$
  select coalesce(btrim(p_url), '') = ''
    or p_url ~ '^https://webook-media\.[a-z0-9-]+\.workers\.dev(/[^?#]*)?/quotations/payment-assets/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
$$;

alter table public.quotation_company_payment_methods
  drop constraint if exists quotation_company_payment_methods_trusted_asset_urls,
  add constraint quotation_company_payment_methods_trusted_asset_urls
    check (
      private.validate_quotation_payment_asset_url(custom_bank_logo_url)
      and private.validate_quotation_payment_asset_url(qr_image_url)
    );

alter table public.quotation_payment_methods
  drop constraint if exists quotation_payment_methods_trusted_asset_urls,
  add constraint quotation_payment_methods_trusted_asset_urls
    check (
      private.validate_quotation_payment_asset_url(custom_bank_logo_url)
      and private.validate_quotation_payment_asset_url(qr_image_url)
    );

revoke all on function private.validate_quotation_payment_asset_url(text) from public;
grant execute on function private.validate_quotation_payment_asset_url(text) to authenticated;
