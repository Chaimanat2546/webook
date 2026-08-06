import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const filename = readdirSync("supabase/migrations").find((value) =>
  value.endsWith("_quotation_document_templates_mvp1.sql"),
);

assert.ok(filename, "quotation template migration must exist");

const sql = readFileSync(`supabase/migrations/${filename}`, "utf8");

describe("quotation template migration", () => {
  it("adds fixed current defaults without destructive changes", () => {
    assert.match(
      sql,
      /quotation_company_profiles[\s\S]*document_template_default text not null default 'current'/i,
    );
    assert.match(
      sql,
      /quotations[\s\S]*document_template_snapshot text not null default 'current'/i,
    );
    assert.match(sql, /in \('current', 'hospitality', 'corporate'\)/i);
    assert.doesNotMatch(sql, /drop table|truncate|delete from/i);
  });

  it("validates owner defaults and quotation snapshots at database boundaries", () => {
    assert.match(sql, /private\.is_quotation_template/i);
    assert.match(sql, /private\.save_quotation_with_template/i);
    assert.match(sql, /p_payload ->> 'document_template_snapshot'/i);
    assert.match(sql, /created_by = auth\.uid\(\)/i);
    assert.match(sql, /'document_template_snapshot', q\.document_template_snapshot/i);
  });

  it("uses explicit grants and keeps the public save wrapper permission-scoped", () => {
    assert.match(sql, /grant select \(document_template_default\)/i);
    assert.match(sql, /grant update \(document_template_default\)/i);
    assert.match(
      sql,
      /revoke all on function public\.save_quotation_with_payments\(jsonb\) from public, anon/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.save_quotation_with_payments\(jsonb\) to authenticated/i,
    );
  });
});
