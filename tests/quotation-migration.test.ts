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

describe("quotation migration", () => {
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
});
