import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalQuotationLayout,
  isQuotationLayoutConfig,
  normalizeQuotationLayout,
  quotationLayoutBlockRowSpan,
  quotationLayoutBlockRow,
  quotationLayoutZonesInDocumentOrder,
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

  it("compacts non-overlapping blocks into the same visual row after reordering", () => {
    const layout = canonicalQuotationLayout("hospitality");
    const reordered = {
      ...layout,
      blocks: layout.blocks.map((block) => block.id === "seller" ? { ...block, order: 20 } : block),
    };
    assert.equal(quotationLayoutBlockRow(reordered, "documentMetadata"), 1);
    assert.equal(quotationLayoutBlockRow(reordered, "seller"), 1);
    assert.equal(quotationLayoutBlockRow(reordered, "paymentMethods"), 1);
    assert.equal(quotationLayoutBlockRow(reordered, "publicNotes"), 2);
  });

  it("keeps every template summary two rows tall", () => {
    assert.equal(quotationLayoutBlockRowSpan("current", "summary"), 2);
    assert.equal(quotationLayoutBlockRowSpan("corporate", "summary"), 2);
    assert.equal(quotationLayoutBlockRowSpan("hospitality", "summary"), 2);
  });

  it("stores document-section order in the existing validated block orders", () => {
    const layout = canonicalQuotationLayout("current");
    const sectionOrder = ["settlement", "header", "certification", "body"] as const;
    const reordered = {
      ...layout,
      blocks: layout.blocks.map((block) => ({
        ...block,
        order: (sectionOrder.indexOf(block.zone as typeof sectionOrder[number]) + 1) * 100
          + (block.order - 10),
      })),
    };

    assert.equal(isQuotationLayoutConfig(reordered, "current"), true);
    assert.deepEqual(
      quotationLayoutZonesInDocumentOrder(reordered),
      sectionOrder,
    );
  });

  it("gives the two newer templates a wider settlement summary", () => {
    for (const template of ["corporate", "hospitality"] as const) {
      const layout = canonicalQuotationLayout(template);
      assert.equal(layout.blocks.find((block) => block.id === "summary")?.span, 5);
      assert.equal(layout.blocks.find((block) => block.id === "paymentMethods")?.span, 7);
    }
  });
});
