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

  it("writes the template and layout snapshot together after the base quotation save", () => {
    const fix = readFileSync("supabase/migrations/20260805170000_fix_quotation_layout_snapshot_save_order.sql", "utf8");
    assert.match(fix, /document_template_revision_snapshot drop not null/);
    assert.match(fix, /document_layout_snapshot drop not null/);
    assert.match(fix, /set document_template_snapshot = v_template,[\s\S]*document_layout_snapshot = v_layout/);
  });

  it("writes layout snapshots in the initial base-row insert", () => {
    const fix = readFileSync(
      "supabase/migrations/20260806173000_save_quotation_layout_snapshot_before_insert.sql",
      "utf8",
    );
    assert.match(fix, /create or replace function private\.save_quotation\(p_payload jsonb\)/i);
    assert.match(fix, /insert into public\.quotations \([\s\S]*document_template_snapshot,[\s\S]*document_layout_snapshot/i);
    assert.match(fix, /p_payload ->> 'document_template_snapshot'[\s\S]*p_payload -> 'document_layout_snapshot'/i);
  });
});
