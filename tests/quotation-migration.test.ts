import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_management_mvp1.sql"));
assert.ok(migrationName, "quotation migration must be created by the Supabase CLI");
const sql = readFileSync(
  new URL(`../supabase/migrations/${migrationName}`, import.meta.url),
  "utf8",
);
const refinementName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_mvp1_editor_refinement.sql"));
assert.ok(refinementName, "quotation editor refinement migration must exist");
const refinementSql = readFileSync(
  new URL(`../supabase/migrations/${refinementName}`, import.meta.url),
  "utf8",
);
const workbenchName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_workbench_totals_public_share.sql"));
assert.ok(workbenchName, "quotation workbench migration must be created by the Supabase CLI");
const workbenchSql = readFileSync(
  new URL(`../supabase/migrations/${workbenchName}`, import.meta.url),
  "utf8",
);
const cleanupName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_item_options_schema_cleanup.sql"));
assert.ok(cleanupName, "quotation schema cleanup migration must be created by the Supabase CLI");
const cleanupSql = readFileSync(
  new URL(`../supabase/migrations/${cleanupName}`, import.meta.url),
  "utf8",
);
const paymentMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_user_payment_methods.sql"));
assert.ok(paymentMigrationName, "quotation user payment migration must exist");
const paymentSql = readFileSync(
  new URL(`../supabase/migrations/${paymentMigrationName}`, import.meta.url),
  "utf8",
);
const paymentAssetBoundaryMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_payment_asset_rpc_boundary.sql"));
assert.ok(paymentAssetBoundaryMigrationName, "quotation payment asset RPC boundary migration must exist");
const paymentAssetBoundarySql = readFileSync(
  new URL(`../supabase/migrations/${paymentAssetBoundaryMigrationName}`, import.meta.url),
  "utf8",
);
const paymentAssetOriginMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_payment_asset_origin_config.sql"));
assert.ok(paymentAssetOriginMigrationName, "quotation payment asset origin configuration migration must exist");
const paymentAssetOriginSql = readFileSync(
  new URL(`../supabase/migrations/${paymentAssetOriginMigrationName}`, import.meta.url),
  "utf8",
);
const paymentAssetOriginErrorMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_payment_asset_origin_error.sql"));
assert.ok(paymentAssetOriginErrorMigrationName, "quotation payment asset origin error migration must exist");
const paymentAssetOriginErrorSql = readFileSync(
  new URL(`../supabase/migrations/${paymentAssetOriginErrorMigrationName}`, import.meta.url),
  "utf8",
);

const securityBoundaryMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_payment_security_boundary.sql"));
assert.ok(securityBoundaryMigrationName, "quotation payment security boundary migration must exist");
const securityBoundarySql = readFileSync(
  new URL(`../supabase/migrations/${securityBoundaryMigrationName}`, import.meta.url),
  "utf8",
);

const finalPaymentBoundaryMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_payment_final_boundary.sql"));
assert.ok(finalPaymentBoundaryMigrationName, "final quotation payment boundary migration must exist");
const finalPaymentBoundarySql = readFileSync(
  new URL(`../supabase/migrations/${finalPaymentBoundaryMigrationName}`, import.meta.url),
  "utf8",
);
const accountTypeMigrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_bank_account_type.sql"));
assert.ok(accountTypeMigrationName, "quotation bank account type migration must exist");
const accountTypeSql = readFileSync(
  new URL(`../supabase/migrations/${accountTypeMigrationName}`, import.meta.url),
  "utf8",
);
const certificationMigrationName = "20260720120000_quotation_pdf_qr_certification.sql";
const certificationSql = readFileSync(
  new URL(`../supabase/migrations/${certificationMigrationName}`, import.meta.url),
  "utf8",
);

describe("quotation migration", () => {
  it("persists certification snapshots through the owner-scoped save and public read RPCs", () => {
    assert.match(certificationSql, /alter table public\.quotation_company_profiles[\s\S]*issuer_name text[\s\S]*approver_name text[\s\S]*company_stamp_url text/i);
    assert.match(certificationSql, /alter table public\.quotations[\s\S]*certification_snapshot jsonb not null default '\{\}'::jsonb/i);
    assert.match(certificationSql, /jsonb_typeof\(certification_snapshot\) = 'object'/i);
    assert.match(certificationSql, /p_payload -> 'certification_snapshot'/i);
    assert.match(certificationSql, /update public\.quotations[\s\S]*certification_snapshot = v_certification/i);
    assert.match(certificationSql, /'certification_snapshot', q\.certification_snapshot/i);
    assert.match(certificationSql, /validate_quotation_certification_asset_url/i);
    assert.match(certificationSql, /quotations\/certification-assets/i);
    assert.doesNotMatch(certificationSql, /drop table|drop column|truncate/i);
  });

  it("persists and validates bank account types at every database boundary", () => {
    assert.match(accountTypeSql, /alter table public\.quotation_company_payment_methods[\s\S]*add column account_type text not null default ''/i);
    assert.match(accountTypeSql, /alter table public\.quotation_payment_methods[\s\S]*add column account_type text not null default ''/i);
    assert.match(accountTypeSql, /account_type[\s\S]*in\s*\(\s*''\s*,\s*'savings'\s*,\s*'current'\s*,\s*'fixed'\s*\)/i);
    assert.match(accountTypeSql, /p_method\s*->>\s*'account_type'/i);
    assert.match(accountTypeSql, /insert into public\.quotation_company_payment_methods[\s\S]*account_type/i);
    assert.match(accountTypeSql, /insert into public\.quotation_payment_methods[\s\S]*account_type/i);
    assert.match(accountTypeSql, /'account_type'[\s\S]*p\.account_type/i);
  });

  it("makes payment snapshots read-only outside the atomic quotation RPC", () => {
    assert.match(finalPaymentBoundarySql, /revoke all privileges on table public\.quotation_payment_methods from anon, authenticated/i);
    assert.match(finalPaymentBoundarySql, /grant select on table public\.quotation_payment_methods to authenticated/i);
    assert.match(finalPaymentBoundarySql, /for select to authenticated/i);
  });

  it("normalizes DB payment values with the same type boundaries as the server", () => {
    assert.match(finalPaymentBoundarySql, /btrim\(coalesce\(p_method ->> 'bank_code'/i);
    assert.match(finalPaymentBoundarySql, /char_length\(btrim\(coalesce\(p_method ->> 'bank_logo_url'/i);
    assert.match(finalPaymentBoundarySql, /\^\/quotation\/banks\/\[a-z0-9-\]\+\\\.svg\$/i);
    assert.match(finalPaymentBoundarySql, /case when v_type = 'bank_transfer'/i);
    assert.match(finalPaymentBoundarySql, /case when v_type = 'promptpay'/i);
    assert.match(finalPaymentBoundarySql, /when v_type = 'qr_payment'/i);
  });
  it("makes payment masters read-only outside their save RPC", () => {
    assert.match(securityBoundarySql, /revoke all privileges on table public\.quotation_company_payment_methods from anon, authenticated/i);
    assert.match(securityBoundarySql, /grant select on table public\.quotation_company_payment_methods to authenticated/i);
    assert.match(securityBoundarySql, /for select to authenticated/i);
    assert.doesNotMatch(securityBoundarySql, /for all to authenticated[\s\S]*quotation_company_payment_methods/i);
  });

  it("serializes explicit type-appropriate public payment fields", () => {
    assert.match(securityBoundarySql, /jsonb_build_object\('id', p\.id/i);
    assert.doesNotMatch(securityBoundarySql, /to_jsonb\(p\)/i);
    assert.doesNotMatch(securityBoundarySql, /internal_notes.*quotation_payment_methods/i);
    assert.match(securityBoundarySql, /case when p\.type = 'bank_transfer'/i);
    assert.match(securityBoundarySql, /case when p\.type = 'promptpay'/i);
  });

  it("uses ordinary PostgreSQL regex semantics for payment assets and PromptPay", () => {
    assert.match(securityBoundarySql, /\}\\\.png\$'/i);
    assert.match(securityBoundarySql, /regexp_replace\([^;]+, '\\D', '', 'g'\)/i);
  });
  it("creates the MVP 1 tables without later-MVP scope", () => {
    assert.match(sql, /create table public\.quotation_company_profiles/i);
    assert.match(sql, /create table public\.quotations/i);
    assert.match(sql, /create table public\.quotation_items/i);
    assert.match(sql, /currency text not null default 'THB'/i);
    assert.doesNotMatch(sql, /amount_in_words/i);
    assert.doesNotMatch(sql, /quotation_(installments|payment_methods|signatures)/i);
  });

  it("uses dedicated permission-gated RLS", () => {
    assert.match(sql, /enable row level security/gi);
    assert.match(sql, /allow_quotation/);
    assert.match(sql, /users\.uid = auth\.uid\(\)/);
    assert.match(sql, /users\.email = auth\.jwt\(\) ->> 'email'/);
    assert.doesNotMatch(sql, /grant .* to anon/i);
  });

  it("numbers and saves quotations atomically", () => {
    assert.match(sql, /quotation_number_counters/);
    assert.match(sql, /QO-/);
    assert.match(sql, new RegExp("on conflict \\(issue_date\\).*do update", "is"));
    assert.match(sql, new RegExp("when v_running < 10000 then lpad.*else v_running::text", "is"));
    assert.match(sql, /create function private\.save_quotation/i);
    assert.match(sql, /create function public\.save_quotation/i);
    assert.match(sql, /create function public\.soft_delete_quotation/i);
  });

  it("keeps search and pagination in the database", () => {
    assert.match(sql, /create function public\.list_quotations/i);
    assert.match(sql, /count\(\*\) over \(\)/i);
    assert.match(sql, /limit least\(greatest\(p_page_size, 1\), 100\)/i);
  });

  it("allows quotation item units to be empty without changing quantity", () => {
    assert.match(refinementSql, /alter table public\.quotation_items\s+alter column unit drop not null/i);
    assert.doesNotMatch(refinementSql, /alter column quantity drop not null/i);
    assert.doesNotMatch(refinementSql, /drop column subject/i);
  });

  it("persists public totals and exposes only a token-scoped public read", () => {
    assert.match(workbenchSql, /public_token uuid not null default gen_random_uuid\(\)/i);
    assert.match(workbenchSql, /withholding_tax_rate numeric\(5,2\)/i);
    assert.match(workbenchSql, /withholding_tax_total numeric\(14,2\)/i);
    assert.match(workbenchSql, /amount_due numeric\(14,2\)/i);
    assert.match(workbenchSql, /customer_snapshot\s*=\s*customer_snapshot\s*-\s*array\[/i);
    assert.match(workbenchSql, /private\.get_public_quotation/i);
    assert.match(workbenchSql, /public\.get_public_quotation/i);
    assert.match(workbenchSql, /grant execute on function public\.get_public_quotation\(uuid\) to anon, authenticated/i);
    assert.doesNotMatch(workbenchSql, /grant select on (?:public\.)?(?:quotations|quotation_items) to anon/i);
    const publicReadSql = workbenchSql.slice(
      workbenchSql.indexOf("create or replace function private.get_public_quotation"),
      workbenchSql.indexOf("create or replace function public.get_public_quotation"),
    );
    assert.doesNotMatch(publicReadSql, /internal_notes/i);
  });

  it("resets only quotation data and installs the compact schema", () => {
    assert.match(cleanupSql, /truncate table public\.quotations cascade/i);
    assert.match(cleanupSql, /truncate table private\.quotation_number_counters/i);
    assert.doesNotMatch(cleanupSql, /truncate table public\.quotation_company_profiles/i);
    for (const column of ["currency", "price_mode", "document_discount_type", "document_discount_value", "document_discount_total"]) {
      assert.match(cleanupSql, new RegExp(`drop column ${column}`, "i"));
    }
    assert.match(cleanupSql, /rename column subtotal to gross_total/i);
    assert.match(cleanupSql, /rename column item_discount_total to discount_total/i);
    assert.match(cleanupSql, /rename column taxable_total to pre_tax_total/i);
    for (const column of ["sku", "discount_type", "discount_value", "document_discount_allocation", "gross_amount", "taxable_amount", "vat_amount", "line_total", "created_at", "updated_at"]) {
      assert.match(cleanupSql, new RegExp(`drop column ${column}`, "i"));
    }
    assert.match(cleanupSql, /discount_amount <= round\(quantity \* unit_price, 2\)/i);
    assert.match(cleanupSql, /vat_treatment = 'taxable' or vat_rate = 0/i);
    assert.match(cleanupSql, /create or replace function private\.save_quotation/i);
    assert.match(cleanupSql, /create or replace function private\.get_public_quotation/i);
    const replacementFunctions = cleanupSql.slice(
      cleanupSql.indexOf("create or replace function private.save_quotation"),
    );
    assert.doesNotMatch(replacementFunctions, /document_discount|price_mode|currency/i);
  });

  it("isolates seller and payment data by account and saves payment snapshots atomically", () => {
    assert.doesNotMatch(paymentSql, /truncate\s+table/i);
    assert.match(paymentSql, /quotation owner has no matching auth user/i);
    assert.match(paymentSql, /select distinct q\.created_by[\s\S]*from public\.quotations q/i);
    assert.match(paymentSql, /insert into public\.quotation_company_profiles[\s\S]*from quotation_owners/i);
    assert.match(paymentSql, /update public\.quotations q[\s\S]*set company_profile_id = profile\.id[\s\S]*profile\.user_id = q\.created_by/i);
    assert.doesNotMatch(paymentSql, /truncate\s+table\s+private\.quotation_number_counters/i);
    assert.match(paymentSql, /add column user_id uuid references auth\.users\(id\)/i);
    assert.match(paymentSql, /alter column user_id set not null[\s\S]*unique \(user_id\)/i);
    assert.match(paymentSql, /create table public\.quotation_company_payment_methods/i);
    assert.match(paymentSql, /create table public\.quotation_payment_methods/i);
    assert.match(paymentSql, /add column company_profile_id uuid references public\.quotation_company_profiles/i);
    assert.match(paymentSql, /alter column company_profile_id set not null/i);
    assert.match(paymentSql, /created_by = \(select auth\.uid\(\)\)/i);
    assert.match(paymentSql, /private\.has_quotation_permission\(\)/i);
    assert.match(paymentSql, /save_quotation_with_payments/i);
    assert.match(paymentSql, /quotation_payment_methods[\s\S]*order by p\.position/i);
  });

  it("keeps the trusted bank catalogue read-only and the inner save RPC private", () => {
    for (const policy of ["auth: delete banks", "auth: insert banks", "auth: update banks"]) {
      assert.match(paymentSql, new RegExp(`drop policy if exists "${policy}" on public\\.banks`, "i"));
    }
    assert.match(paymentSql, /revoke all privileges on table public\.banks from anon, authenticated/i);
    assert.match(paymentSql, /grant select on table public\.banks to anon, authenticated/i);
    assert.doesNotMatch(paymentSql, /grant\s+(?:all privileges|truncate)\s+on table public\.banks/i);
    assert.match(paymentSql, /revoke execute on function private\.save_quotation\(jsonb\) from authenticated/i);
  });

  it("rejects external payment media in direct master and snapshot RPC saves", () => {
    assert.match(paymentAssetBoundarySql, /create or replace function private\.validate_quotation_payment_asset_url\(p_url text\)/i);
    assert.match(paymentAssetBoundarySql, new RegExp("quotations/payment-assets/.*png", "i"));
    assert.match(paymentAssetBoundarySql, /custom_bank_logo_url/i);
    assert.match(paymentAssetBoundarySql, /qr_image_url/i);
    assert.match(paymentAssetBoundarySql, /alter table public\.quotation_company_payment_methods[\s\S]*check\s*\(\s*private\.validate_quotation_payment_asset_url/i);
    assert.match(paymentAssetBoundarySql, /alter table public\.quotation_payment_methods[\s\S]*check\s*\(\s*private\.validate_quotation_payment_asset_url/i);
  });

  it("binds payment media validation to one private configured origin", () => {
    assert.match(paymentAssetOriginSql, /create table private\.quotation_payment_asset_config/i);
    assert.match(paymentAssetOriginSql, /create or replace function private\.validate_quotation_payment_asset_url\(p_url text\)/i);
    assert.match(paymentAssetOriginSql, /security definer/i);
    assert.match(paymentAssetOriginSql, /from private\.quotation_payment_asset_config/i);
    assert.match(paymentAssetOriginSql, /create or replace function public\.configure_quotation_payment_asset_origin/i);
    assert.match(paymentAssetOriginSql, /auth\.role\(\) <> 'service_role'/i);
    assert.match(paymentAssetOriginSql, /revoke all on function public\.configure_quotation_payment_asset_origin/i);
    assert.match(paymentAssetOriginSql, /grant execute on function public\.configure_quotation_payment_asset_origin\(text\) to service_role/i);
  });

  it("raises a stable setup error only for non-empty payment assets without an origin", () => {
    assert.match(paymentAssetOriginErrorSql, /create or replace function private\.validate_quotation_payment_asset_url\(p_url text\)/i);
    assert.match(paymentAssetOriginErrorSql, /coalesce\(btrim\(p_url\), ''\) = ''/i);
    assert.match(paymentAssetOriginErrorSql, /errcode = 'P0001'/i);
    assert.match(paymentAssetOriginErrorSql, /message = 'quotation_payment_asset_origin_not_configured'/i);
    assert.match(paymentAssetOriginErrorSql, /create or replace function public\.configure_quotation_payment_asset_origin/i);
    assert.match(paymentAssetOriginErrorSql, /if p_origin is null then[\s\S]*delete from private\.quotation_payment_asset_config/i);
  });
});
