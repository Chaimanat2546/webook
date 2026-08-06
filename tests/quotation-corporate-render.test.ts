import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

interface CorporateRenderResult {
  hasDiscountColumn: boolean;
  hasSequentialSummary: boolean;
  hasUnitColumn: boolean;
  hasUploadedPng: boolean;
  hasVatColumn: boolean;
  template: boolean;
}

describe("Corporate quotation rendering", () => {
  it("renders hidden item columns without gaps and resolves an uploaded PNG through the production PDF pipeline", () => {
    const output = execFileSync(process.execPath, [
      "--loader", "./tests/tsx-loader.mjs",
      "./tests/fixtures/quotation-corporate-render.mjs",
    ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const result = JSON.parse(output) as CorporateRenderResult;

    assert.equal(result.template, true);
    assert.equal(result.hasUnitColumn, false);
    assert.equal(result.hasDiscountColumn, false);
    assert.equal(result.hasVatColumn, false);
    assert.equal(result.hasSequentialSummary, true);
    assert.equal(result.hasUploadedPng, true);
  });
});
