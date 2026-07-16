import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatBaht,
  formatMoney,
  normalizeMoneyInput,
} from "../lib/quotation-money.ts";

describe("quotation money presentation", () => {
  it("groups exact decimal strings without floating point", () => {
    assert.equal(formatMoney("0"), "0.00");
    assert.equal(formatMoney("19900"), "19,900.00");
    assert.equal(formatMoney("19900.5"), "19,900.50");
    assert.equal(formatMoney("999999999999.99"), "999,999,999,999.99");
    assert.equal(formatBaht("19900.5"), "19,900.50 บาท");
  });

  it("normalizes only valid grouped or ungrouped money input", () => {
    assert.equal(normalizeMoneyInput("19900"), "19900");
    assert.equal(normalizeMoneyInput("19,900.50"), "19900.50");
    assert.equal(normalizeMoneyInput(""), "");
    assert.equal(normalizeMoneyInput("1,00"), null);
    assert.equal(normalizeMoneyInput("19,900.123"), null);
    assert.equal(normalizeMoneyInput("19,900x"), null);
  });
});
