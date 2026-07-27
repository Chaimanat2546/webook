import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const runUpgradeTests = process.env.RUN_QUOTATION_MIGRATION_UPGRADE_TESTS === "1";
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_webook";
const migrations = new URL("../supabase/migrations/", import.meta.url);
const baselineNames = [
  "20260714114823_quotation_management_mvp1.sql",
  "20260715063655_quotation_mvp1_editor_refinement.sql",
  "20260716032355_quotation_workbench_totals_public_share.sql",
  "20260716064749_quotation_item_options_schema_cleanup.sql",
];
const baselineSql = baselineNames.map((name) => readFileSync(new URL(name, migrations), "utf8"));
const upgradeSql = readFileSync(
  new URL("20260718090000_quotation_user_payment_methods.sql", migrations),
  "utf8",
);
const catalogueMigrationName = readdirSync(migrations)
  .find((name) => name.endsWith("_quotation_item_catalog.sql"));
assert.ok(catalogueMigrationName, "quotation item catalogue migration must exist");
const catalogueSql = readFileSync(new URL(catalogueMigrationName, migrations), "utf8");
const bootstrapSql = `
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table auth.users (id uuid primary key, email text);
create table public.users (uid uuid, email text, allow_tools jsonb);
create table public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);`;

function docker(args: string[], input?: string, succeeds = true) {
  const result = spawnSync("docker", args, { encoding: "utf8", input });
  if (succeeds) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, "command unexpectedly succeeded");
  return `${result.stdout}\n${result.stderr}`;
}

function sql(database: string, source: string, succeeds = true) {
  return docker([
    "exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database,
  ], source, succeeds);
}

function withLegacyDatabase(run: (database: string) => void) {
  const database = `quotation_upgrade_${randomUUID().replaceAll("-", "")}`;
  docker(["exec", container, "createdb", "-U", "postgres", database]);
  try {
    sql(database, bootstrapSql);
    for (const migration of baselineSql) sql(database, migration);
    run(database);
  } finally {
    docker(["exec", container, "dropdb", "--if-exists", "-U", "postgres", database]);
  }
}

function authUser(id: string, email: string) {
  return `
insert into auth.users (id, email) values ('${id}', '${email}');
insert into public.users (uid, email, allow_tools)
values ('${id}', '${email}', '{"allow_quotation": true}');`;
}

const legacyProfile = `
insert into public.quotation_company_profiles (
  id, seller_name, address, tax_id, office_type, branch_number, phone, email,
  website, contact_name, contact_phone, contact_email, logo_url
) values (
  1, 'Legacy seller', 'Legacy address', '0100000000000', 'head_office', '',
  '020000000', 'seller@example.com', 'https://example.com', '', '', '', ''
);`;

function quotation(owner: string, id: string, itemId: string, documentNumber: string, sellerName: string) {
  return `
insert into public.quotations (
  id, document_number, issue_date, valid_until, reference, subject,
  seller_snapshot, customer_snapshot, gross_total, discount_total,
  pre_tax_total, vat_total, grand_total, withholding_tax_rate,
  withholding_tax_total, amount_due, public_notes, internal_notes,
  created_by, updated_by
) values (
  '${id}', '${documentNumber}', '2026-07-18', '2026-08-02', '', 'Legacy work',
  '{"name":"${sellerName}","address":"Snapshot address","taxId":"999","officeType":"branch","branchNumber":"001","phone":"0123","email":"snapshot@example.com","website":"","contactName":"","contactPhone":"","contactEmail":"","logoUrl":""}',
  '{"name":"Customer"}', 100, 0, 100, 7, 107, 0, 0, 107, '', '',
  '${owner}', '${owner}'
);
insert into public.quotation_items (
  id, quotation_id, position, name, description, quantity, unit, unit_price,
  discount_amount, vat_treatment, vat_rate
) values ('${itemId}', '${id}', 1, 'Item', '', 1, null, 100, 0, 'taxable', 7);`;
}

function applyUpgrade(database: string, succeeds = true) {
  return sql(database, `begin;\n${upgradeSql}\ncommit;`, succeeds);
}

describe("quotation ownership migration legacy upgrade", { skip: !runUpgradeTests }, () => {
  it("preserves legacy item names while enforcing the catalogue for new rows", () => {
    withLegacyDatabase((database) => {
      sql(database, authUser("11111111-1111-1111-1111-111111111111", "one@example.com")
        + legacyProfile
        + quotation("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "aaaaaaaa-0000-0000-0000-000000000001", "QO-20260718-0001", "Snapshot seller"));
      sql(database, catalogueSql);
      sql(database, "do $$ begin if (select name from public.quotation_items where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 'Item' then raise exception 'legacy item name changed'; end if; end $$;");
      const rejected = sql(database, `insert into public.quotation_items (
        id, quotation_id, position, name, description, quantity, unit,
        unit_price, discount_amount, vat_treatment, vat_rate
      ) values (
        'aaaaaaaa-0000-0000-0000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'รายการอื่น', '', 1, null,
        100, 0, 'none', 0
      );`, false);
      assert.match(rejected, /quotation_items_name_catalog_fk|foreign key/i);
      sql(database, `insert into public.quotation_items (
        id, quotation_id, position, name, description, quantity, unit,
        unit_price, discount_amount, vat_treatment, vat_rate
      ) values (
        'aaaaaaaa-0000-0000-0000-000000000003',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'ค่าบริการ', '', 1, null,
        100, 0, 'none', 0
      );`);
    });
  });

  it("clones a singleton profile for two owners and preserves quotation data", () => {
    withLegacyDatabase((database) => {
      sql(database, [
        authUser("11111111-1111-1111-1111-111111111111", "one@example.com"),
        authUser("22222222-2222-2222-2222-222222222222", "two@example.com"),
        legacyProfile,
        quotation("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "aaaaaaaa-0000-0000-0000-000000000001", "QO-20260718-0001", "Snapshot one"),
        quotation("22222222-2222-2222-2222-222222222222", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "bbbbbbbb-0000-0000-0000-000000000001", "QO-20260718-0002", "Snapshot two"),
        "insert into private.quotation_number_counters values ('2026-07-18', 2);",
      ].join("\n"));
      applyUpgrade(database);
      sql(database, `do $$ begin
        if (select count(*) from public.quotations) <> 2 then raise exception 'quotations lost'; end if;
        if (select count(*) from public.quotation_items) <> 2 then raise exception 'items lost'; end if;
        if (select count(*) from public.quotation_company_profiles) <> 2 then raise exception 'profiles not cloned'; end if;
        if (select last_value from private.quotation_number_counters where issue_date = '2026-07-18') <> 2 then raise exception 'counter changed'; end if;
        if exists (select 1 from public.quotation_company_profiles where seller_name <> 'Legacy seller') then raise exception 'profile data changed'; end if;
        if exists (select 1 from public.quotations q join public.quotation_company_profiles p on p.id = q.company_profile_id where p.user_id <> q.created_by) then raise exception 'owner mismatch'; end if;
        if (select string_agg(document_number, ',' order by document_number) from public.quotations) <> 'QO-20260718-0001,QO-20260718-0002' then raise exception 'document numbers changed'; end if;
      end $$;`);
    });
  });

  it("creates a missing owner profile from the latest seller snapshot", () => {
    withLegacyDatabase((database) => {
      sql(database, authUser("11111111-1111-1111-1111-111111111111", "one@example.com")
        + quotation("11111111-1111-1111-1111-111111111111", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "aaaaaaaa-0000-0000-0000-000000000001", "QO-20260718-0001", "Snapshot seller"));
      applyUpgrade(database);
      sql(database, `do $$ begin
        if not exists (select 1 from public.quotation_company_profiles where user_id = '11111111-1111-1111-1111-111111111111' and seller_name = 'Snapshot seller' and address = 'Snapshot address' and office_type = 'branch' and branch_number = '001') then raise exception 'snapshot profile missing'; end if;
        if exists (select 1 from public.quotations q join public.quotation_company_profiles p on p.id = q.company_profile_id where p.user_id <> q.created_by) then raise exception 'owner mismatch'; end if;
      end $$;`);
    });
  });

  it("rejects a missing auth owner and rolls the migration back", () => {
    withLegacyDatabase((database) => {
      sql(database, legacyProfile
        + quotation("33333333-3333-3333-3333-333333333333", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "aaaaaaaa-0000-0000-0000-000000000001", "QO-20260718-0001", "Orphan seller")
        + "insert into private.quotation_number_counters values ('2026-07-18', 1);");
      assert.match(applyUpgrade(database, false), /Quotation owner has no matching auth user/i);
      sql(database, `do $$ begin
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quotation_company_profiles' and column_name = 'user_id') then raise exception 'partial profile migration persisted'; end if;
        if (select count(*) from public.quotations) <> 1 or (select count(*) from public.quotation_items) <> 1 then raise exception 'legacy rows changed'; end if;
        if (select last_value from private.quotation_number_counters where issue_date = '2026-07-18') <> 1 then raise exception 'counter changed'; end if;
      end $$;`);
    });
  });

  for (const eligibleCount of [0, 1, 2]) {
    it(`${eligibleCount === 1 ? "assigns" : "rejects"} a profile without quotations when ${eligibleCount} eligible users exist`, () => {
      withLegacyDatabase((database) => {
        let fixture = legacyProfile;
        for (let index = 1; index <= eligibleCount; index += 1) {
          const digit = String(index).repeat(8);
          fixture += authUser(`${digit}-${digit.slice(0, 4)}-${digit.slice(0, 4)}-${digit.slice(0, 4)}-${digit}${digit.slice(0, 4)}`, `${index}@example.com`);
        }
        sql(database, fixture);
        if (eligibleCount === 1) {
          applyUpgrade(database);
          sql(database, "do $$ begin if (select count(*) from public.quotation_company_profiles where user_id is not null) <> 1 then raise exception 'profile not assigned'; end if; end $$;");
        } else {
          assert.match(applyUpgrade(database, false), /Legacy seller profile has no unambiguous auth user/i);
          sql(database, "do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quotation_company_profiles' and column_name = 'user_id') then raise exception 'partial migration persisted'; end if; end $$;");
        }
      });
    });
  }
});
