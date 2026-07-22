import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const name = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((entry) => entry.endsWith("_quotation_customer_master_dbd.sql"));
assert.ok(name, "customer migration must be created by the Supabase CLI");
const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const allSql = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .filter((entry) => entry.endsWith(".sql"))
  .map((entry) => readFileSync(new URL(`../supabase/migrations/${entry}`, import.meta.url), "utf8"))
  .join("\n");

describe("quotation customer migration", () => {
  it("creates the shared customer boundary", () => {
    assert.match(sql, /create table public\.quotation_customers/i);
    assert.match(sql, /tax_id text not null unique/i);
    assert.match(sql, /tax_id ~ '\^\[0-9\]\{13\}\$'/i);
    assert.match(sql, /quotation_customers_dbd_complete/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all .* from public, anon, authenticated/i);
    assert.match(sql, /grant select, insert, update .* to authenticated/i);
    assert.doesNotMatch(sql, /grant delete .* authenticated/i);
    assert.match(sql, /private\.has_quotation_permission\(\)/i);
    assert.match(sql, /create trigger quotation_customers_touch/i);
    assert.match(sql, /create or replace function public\.list_quotation_customers/i);
    assert.doesNotMatch(sql, /^\s*(?:drop table|truncate)\b/im);
  });

  it("keeps browser sessions read-only and reserves mutations for server persistence", () => {
    assert.match(allSql, /revoke\s+insert\s*,\s*update\s+on\s+table\s+public\.quotation_customers\s+from\s+authenticated/i);
    assert.match(allSql, /drop policy\s+"Quotation users manage shared customers"/i);
    assert.match(allSql, /for select[\s\S]*private\.has_quotation_permission\(\)/i);
    assert.match(allSql, /coalesce\(auth\.uid\(\),\s*new\.updated_by,\s*old\.updated_by\)/i);
  });

  it("allows distinct juristic branches while keeping each customer identity unique", () => {
    const branchMigration = readdirSync(new URL("../supabase/migrations/", import.meta.url))
      .find((entry) => entry.endsWith("_quotation_customer_branch_identity.sql"));
    assert.ok(branchMigration, "branch identity migration must exist");
    const branchSql = readFileSync(
      new URL(`../supabase/migrations/${branchMigration}`, import.meta.url),
      "utf8",
    );

    assert.match(branchSql, /drop constraint quotation_customers_tax_id_key/i);
    assert.match(branchSql, /quotation_customers_individual_tax_id_uidx/i);
    assert.match(branchSql, /quotation_customers_juristic_main_tax_id_uidx/i);
    assert.match(branchSql, /quotation_customers_juristic_branch_uidx/i);
    assert.match(branchSql, /unique index[\s\S]*\(tax_id, branch_number\)/i);
    assert.doesNotMatch(branchSql, /where[^;]*is_active/i);
  });
});
