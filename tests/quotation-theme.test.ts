import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeQuotationThemeColor,
  QUOTATION_TEMPLATE_THEME_COLORS,
  quotationThemePalette,
} from "../lib/quotation-theme.ts";

describe("quotation template theme", () => {
  it("uses the WeBooks Coastal palette as every template default", () => {
    assert.deepEqual(QUOTATION_TEMPLATE_THEME_COLORS, {
      corporate: "#043D5C",
      current: "#07557A",
      hospitality: "#119A9A",
    });
  });

  it("derives a stable palette from one primary color", () => {
    const palette = quotationThemePalette("#2563eb");
    assert.equal(palette.primary, "#2563EB");
    assert.match(palette.light, /^#[0-9A-F]{6}$/);
    assert.match(palette.border, /^#[0-9A-F]{6}$/);
    assert.equal(palette.contrast, "#FFFFFF");
  });

  it("falls back to the selected template default", () => {
    assert.equal(normalizeQuotationThemeColor("invalid", "hospitality"), "#119A9A");
  });
});
