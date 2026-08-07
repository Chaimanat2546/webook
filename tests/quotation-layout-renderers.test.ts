import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const corporate = readFileSync("components/admin/quotations/templates/quotation-document-corporate.tsx", "utf8");
const current = readFileSync("components/admin/quotations/templates/quotation-document-current.tsx", "utf8");
const hospitality = readFileSync("components/admin/quotations/templates/quotation-document-hospitality.tsx", "utf8");

describe("quotation template layout renderers", () => {
  it("uses a compact summary when Current is placed in a narrow column", () => {
    assert.match(current, /const compactSummary = \(summaryBlock\?\.span \?\? 12\) <= 6/);
    assert.match(current, /compactSummary \? \(/);
    assert.match(current, /className="break-words text-slate-600"/);
  });

  it("uses the configured grid zones for Corporate blocks", () => {
    assert.match(corporate, /data-layout-zone="body"/);
    assert.match(corporate, /data-layout-zone="settlement"/);
    assert.match(corporate, /data-layout-block="publicNotes"/);
  });

  it("keeps new-template settlement summaries wide for every document snapshot", () => {
    const renderer = readFileSync("lib/quotation-layout-renderer.ts", "utf8");
    assert.match(renderer, /\$\{summaryIsLeft \? 1 : 8\} \/ span 5/);
    assert.match(renderer, /\$\{summaryIsLeft \? 6 : 1\} \/ span 7/);
  });

  it("uses the configured grid zones for Hospitality blocks", () => {
    assert.match(hospitality, /data-layout-zone="body"/);
    assert.match(hospitality, /data-layout-zone="settlement"/);
    assert.match(hospitality, /data-layout-block="publicNotes"/);
    assert.match(hospitality, /data-layout-block="documentMetadata"[\s\S]*?data-document-metadata/);
  });
});
