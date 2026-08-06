import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260806040000_accept_quotation_layout_schema_v2.sql",
  "utf8",
);
const repository = readFileSync("server/repositories/quotations.ts", "utf8");

describe("quotation layout schema version 2 save boundary", () => {
  it("accepts the theme-enabled schema in the database save wrapper", () => {
    assert.match(migration, /v_schema_version <> 2/);
    assert.match(migration, /revision\.layout_schema_version = v_schema_version/);
    assert.match(migration, /revision\.layout_config = v_layout/);
    assert.match(migration, /document_template_snapshot = v_template/);
  });

  it("returns the current schema version after publishing a layout", () => {
    assert.match(repository, /QUOTATION_LAYOUT_SCHEMA_VERSION/);
    assert.match(repository, /schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION/);
    assert.doesNotMatch(repository, /schemaVersion: 1,/);
  });
});
