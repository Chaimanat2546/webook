import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateQuotation,
  formatThaiBahtText,
  type QuotationCalculationInput,
} from "../lib/quotation-calculator.ts";

function baseInput(overrides: Partial<QuotationCalculationInput> = {}): QuotationCalculationInput {
  return {
    documentDiscountType: null,
    documentDiscountValue: "0",
    items: [{
      description: "",
      discountType: null,
      discountValue: "0",
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "บริการ",
      position: 1,
      quantity: "2",
      sku: "",
      unit: "งาน",
      unitPrice: "10000.00",
      vatRate: "7.00",
      vatTreatment: "taxable",
    }],
    priceMode: "vat_exclusive",
    ...overrides,
  };
}

describe("quotation calculator", () => {
  it("calculates VAT-exclusive item totals", () => {
    const result = calculateQuotation(baseInput());
    assert.equal(result.subtotal, "20000.00");
    assert.equal(result.taxableTotal, "20000.00");
    assert.equal(result.vatTotal, "1400.00");
    assert.equal(result.grandTotal, "21400.00");
  });

  it("extracts VAT from VAT-inclusive prices", () => {
    const result = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0], quantity: "1", unitPrice: "10700.00" }],
      priceMode: "vat_inclusive",
    }));
    assert.equal(result.taxableTotal, "10000.00");
    assert.equal(result.vatTotal, "700.00");
    assert.equal(result.grandTotal, "10700.00");
  });

  it("supports item and document percent discounts", () => {
    const result = calculateQuotation(baseInput({
      documentDiscountType: "percent",
      documentDiscountValue: "10",
      items: [{ ...baseInput().items[0], discountType: "percent", discountValue: "10" }],
    }));
    assert.equal(result.itemDiscountTotal, "2000.00");
    assert.equal(result.documentDiscountTotal, "1800.00");
    assert.equal(result.taxableTotal, "16200.00");
    assert.equal(result.vatTotal, "1134.00");
    assert.equal(result.grandTotal, "17334.00");
  });

  it("supports fixed item and document discounts", () => {
    const result = calculateQuotation(baseInput({
      documentDiscountType: "amount",
      documentDiscountValue: "500.00",
      items: [{ ...baseInput().items[0], discountType: "amount", discountValue: "500.00" }],
    }));
    assert.equal(result.itemDiscountTotal, "500.00");
    assert.equal(result.documentDiscountTotal, "500.00");
    assert.equal(result.taxableTotal, "19000.00");
    assert.equal(result.vatTotal, "1330.00");
    assert.equal(result.grandTotal, "20330.00");
  });

  it("allocates a fixed discount without losing a satang", () => {
    const result = calculateQuotation(baseInput({
      documentDiscountType: "amount",
      documentDiscountValue: "0.01",
      items: ["a", "b", "c"].map((id, index) => ({
        ...baseInput().items[0], id, position: index + 1, quantity: "1", unitPrice: "1.00",
      })),
    }));
    assert.deepEqual(
      result.lines.map((line) => line.documentDiscountAllocation),
      ["0.01", "0.00", "0.00"],
    );
    assert.equal(result.documentDiscountTotal, "0.01");
  });

  it("rounds a half-satang quantity-price product up", () => {
    const result = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0], quantity: "0.001", unitPrice: "5.00" }],
    }));
    assert.equal(result.subtotal, "0.01");
  });

  it("rounds a half-satang percent discount up", () => {
    const result = calculateQuotation(baseInput({
      documentDiscountType: "percent",
      documentDiscountValue: "50.00",
      items: [{ ...baseInput().items[0], quantity: "1", unitPrice: "0.01" }],
    }));
    assert.equal(result.documentDiscountTotal, "0.01");
  });

  it("rounds half-satang VAT at the exclusive and inclusive boundaries", () => {
    const exclusive = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0], quantity: "1", unitPrice: "0.01", vatRate: "50.00" }],
    }));
    const inclusive = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0], quantity: "1", unitPrice: "0.01", vatRate: "100.00" }],
      priceMode: "vat_inclusive",
    }));
    assert.equal(exclusive.vatTotal, "0.01");
    assert.equal(inclusive.taxableTotal, "0.01");
    assert.equal(inclusive.vatTotal, "0.00");
  });

  it("distinguishes zero-rated, exempt, and no-VAT lines", () => {
    const result = calculateQuotation(baseInput({
      items: [
        { ...baseInput().items[0], id: "zero", position: 1, vatRate: "0.00" },
        { ...baseInput().items[0], id: "exempt", position: 2, vatRate: "0.00", vatTreatment: "exempt" },
        { ...baseInput().items[0], id: "none", position: 3, vatRate: "0.00", vatTreatment: "none" },
      ],
    }));
    assert.equal(result.vatTotal, "0.00");
    assert.deepEqual(result.lines.map((line) => line.vatTreatment), ["taxable", "exempt", "none"]);
    assert.deepEqual(result.vatSummary.map((row) => `${row.vatTreatment}:${row.vatRate}`), [
      "taxable:0.00", "exempt:0.00", "none:0.00",
    ]);
  });

  it("summarizes mixed VAT rates separately", () => {
    const result = calculateQuotation(baseInput({
      items: [
        { ...baseInput().items[0], id: "seven", position: 1, quantity: "1", unitPrice: "100.00" },
        { ...baseInput().items[0], id: "zero", position: 2, quantity: "1", unitPrice: "200.00", vatRate: "0.00" },
      ],
    }));
    assert.deepEqual(result.vatSummary, [
      { taxableAmount: "100.00", vatAmount: "7.00", vatRate: "7.00", vatTreatment: "taxable" },
      { taxableAmount: "200.00", vatAmount: "0.00", vatRate: "0.00", vatTreatment: "taxable" },
    ]);
  });

  it("rejects invalid money and discounts", () => {
    assert.throws(() => calculateQuotation(baseInput({ items: [{ ...baseInput().items[0], quantity: "0" }] })), /Quantity must be greater than zero/);
    assert.throws(() => calculateQuotation(baseInput({ items: [{
      ...baseInput().items[0], discountType: "amount", discountValue: "30000",
    }] })), /Discount cannot exceed item gross/);
  });

  it("formats Thai baht text", () => {
    assert.equal(formatThaiBahtText("0.00"), "ศูนย์บาทถ้วน");
    assert.equal(formatThaiBahtText("21.00"), "ยี่สิบเอ็ดบาทถ้วน");
    assert.equal(formatThaiBahtText("1000001.25"), "หนึ่งล้านหนึ่งบาทยี่สิบห้าสตางค์");
  });
});
