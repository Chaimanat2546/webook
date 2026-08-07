import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "supabase/migrations/20260805190000_add_quotation_template_theme_color.sql",
  "utf8",
);

describe("quotation theme migration", () => {
  it("upgrades revisions and quotation snapshots to schema version two", () => {
    assert.match(source, /'schemaVersion', 2/);
    assert.match(source, /'themeColor'/);
    assert.match(source, /document_layout_schema_version_snapshot = 2/);
    assert.match(source, /layout_schema_version = 2/);
  });

  it("validates one six-digit hex color and publishes immutable revisions", () => {
    assert.match(source, /\^#\[0-9A-Fa-f\]\{6\}\$/);
    assert.match(source, /private\.is_quotation_layout/);
    assert.match(source, /v_revision_number := v_template\.current_revision_number \+ 1/);
  });
});
