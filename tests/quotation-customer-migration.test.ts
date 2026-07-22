import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const name = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((entry) => entry.endsWith("_quotation_customer_master_dbd.sql"));
assert.ok(name, "customer migration must be created by the Supabase CLI");
const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

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
});
