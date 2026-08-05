import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalQuotationLayout,
  isQuotationLayoutConfig,
  normalizeQuotationLayout,
  QUOTATION_LAYOUT_SCHEMA_VERSION,
} from "../lib/quotation-layout.ts";

describe("quotation layout", () => {
  it("creates one validated canonical layout for every fixed template", () => {
    for (const template of ["current", "hospitality", "corporate"] as const) {
      const layout = canonicalQuotationLayout(template);
      assert.equal(layout.schemaVersion, QUOTATION_LAYOUT_SCHEMA_VERSION);
      assert.equal(isQuotationLayoutConfig(layout, template), true);
      assert.ok(layout.blocks.some((block) => block.id === "items"));
      assert.ok(layout.blocks.some((block) => block.id === "certification"));
    }
  });

  it("rejects unallowlisted blocks, overlapping rows, and missing required blocks", () => {
    const layout = canonicalQuotationLayout("current");
    assert.equal(isQuotationLayoutConfig({ ...layout, blocks: layout.blocks.filter((block) => block.id !== "items") }, "current"), false);
    assert.equal(isQuotationLayoutConfig({ ...layout, blocks: [...layout.blocks, { id: "rawHtml", zone: "body", column: 1, order: 99, span: 12 }] }, "current"), false);
    assert.equal(isQuotationLayoutConfig({ ...layout, blocks: layout.blocks.map((block) => block.id === "customer" ? { ...block, column: 1, order: 20, span: 12 } : block) }, "current"), false);
  });

  it("returns a defensive canonical layout when a stored layout is invalid", () => {
    const normalized = normalizeQuotationLayout({ schemaVersion: 1, blocks: [] }, "hospitality");
    assert.deepEqual(normalized, canonicalQuotationLayout("hospitality"));
  });
});
