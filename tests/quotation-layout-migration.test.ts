import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const filename = readdirSync("supabase/migrations").find((value) =>
  value.endsWith("_quotation_layout_management_mvp2.sql"),
);

assert.ok(filename, "quotation layout MVP 2 migration must exist");

const sql = readFileSync(`supabase/migrations/${filename}`, "utf8");

describe("quotation layout MVP 2 migration", () => {
  it("creates owner-scoped logical templates and immutable revisions", () => {
    assert.match(sql, /create table public\.quotation_document_templates/i);
    assert.match(sql, /unique \(user_id, template_key\)/i);
    assert.match(sql, /create table public\.quotation_document_template_revisions/i);
    assert.match(sql, /primary key \(template_id, revision_number\)/i);
    assert.match(sql, /current_revision_number bigint not null check \(current_revision_number > 0\)/i);
  });

  it("backs up every quotation with a validated layout snapshot and source revision", () => {
    assert.match(sql, /document_template_source_id uuid/i);
    assert.match(sql, /document_template_revision_snapshot bigint/i);
    assert.match(sql, /document_layout_schema_version_snapshot integer/i);
    assert.match(sql, /document_layout_snapshot jsonb/i);
    assert.match(sql, /private\.is_quotation_layout/i);
    assert.match(sql, /private\.ensure_quotation_document_templates/i);
  });

  it("uses row locks, owner checks, RLS, and a permission-scoped publish RPC", () => {
    assert.match(sql, /for update/i);
    assert.match(sql, /auth\.uid\(\)/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /publish_quotation_document_template_layout/i);
    assert.match(sql, /revoke all on table public\.quotation_document_templates from anon, authenticated/i);
    assert.doesNotMatch(sql, /drop table|truncate|delete from/i);
  });
});
