import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const corporate = readFileSync("components/admin/quotations/templates/quotation-document-corporate.tsx", "utf8");
const hospitality = readFileSync("components/admin/quotations/templates/quotation-document-hospitality.tsx", "utf8");

describe("quotation template layout renderers", () => {
  it("uses the configured grid zones for Corporate blocks", () => {
    assert.match(corporate, /data-layout-zone="body"/);
    assert.match(corporate, /data-layout-zone="settlement"/);
    assert.match(corporate, /data-layout-block="publicNotes"/);
  });

  it("uses the configured grid zones for Hospitality blocks", () => {
    assert.match(hospitality, /data-layout-zone="body"/);
    assert.match(hospitality, /data-layout-zone="settlement"/);
    assert.match(hospitality, /data-layout-block="publicNotes"/);
  });
});
