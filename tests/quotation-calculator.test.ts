import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateQuotation,
  formatThaiBahtText,
  type QuotationCalculationInput,
} from "../lib/quotation-calculator.ts";

function baseInput(
  overrides: Partial<QuotationCalculationInput> = {},
): QuotationCalculationInput {
  return {
    items: [{
      description: "",
      discountAmount: "500.00",
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "บริการ",
      position: 1,
      quantity: "2",
      unit: "งาน",
      unitPrice: "10000.00",
      vatRate: "7.00",
      vatTreatment: "taxable",
    }],
    withholdingTaxRate: null,
    ...overrides,
  };
}

describe("quotation calculator", () => {
  it("calculates fixed item discount, pre-tax value, VAT, and grand total", () => {
    const result = calculateQuotation(baseInput());
    assert.equal(result.lines[0]!.grossAmount, "20000.00");
    assert.equal(result.lines[0]!.preTaxAmount, "19500.00");
    assert.equal(result.lines[0]!.vatAmount, "1365.00");
    assert.equal(result.lines[0]!.lineTotal, "20865.00");
    assert.equal(result.grossTotal, "20000.00");
    assert.equal(result.discountTotal, "500.00");
    assert.equal(result.preTaxTotal, "19500.00");
    assert.equal(result.vatTotal, "1365.00");
    assert.equal(result.grandTotal, "20865.00");
  });

  it("calculates withholding from the pre-tax total", () => {
    const result = calculateQuotation(baseInput({ withholdingTaxRate: "3.00" }));
    assert.equal(result.withholdingTaxTotal, "585.00");
    assert.equal(result.amountDue, "20280.00");
  });

  it("keeps exempt and no-VAT items at zero VAT", () => {
    const result = calculateQuotation(baseInput({
      items: [
        { ...baseInput().items[0]!, id: "exempt", vatRate: "0", vatTreatment: "exempt" },
        { ...baseInput().items[0]!, id: "none", vatRate: "0", vatTreatment: "none" },
      ],
    }));
    assert.equal(result.vatTotal, "0.00");
    assert.deepEqual(result.lines.map((line) => line.preTaxAmount), ["19500.00", "19500.00"]);
  });

  it("rejects a fixed discount above the item gross", () => {
    assert.throws(
      () => calculateQuotation(baseInput({
        items: [{ ...baseInput().items[0]!, discountAmount: "20000.01" }],
      })),
      /Discount cannot exceed item gross/,
    );
  });

  it("ignores withholding when its rate is null", () => {
    const result = calculateQuotation(baseInput({ withholdingTaxRate: null }));
    assert.equal(result.withholdingTaxTotal, "0.00");
    assert.equal(result.amountDue, result.grandTotal);
  });

  it("rounds a half-satang quantity-price product up", () => {
    const result = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0]!, discountAmount: "0", quantity: "0.001", unitPrice: "5.00" }],
    }));
    assert.equal(result.grossTotal, "0.01");
  });

  it("rounds half-satang VAT at the exclusive boundary", () => {
    const result = calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0]!, discountAmount: "0", quantity: "1", unitPrice: "0.01", vatRate: "50.00" }],
    }));
    assert.equal(result.vatTotal, "0.01");
  });

  it("rejects invalid numeric values", () => {
    assert.throws(
      () => calculateQuotation(baseInput({ items: [{ ...baseInput().items[0]!, quantity: "0" }] })),
      /Quantity must be greater than zero/,
    );
  });

  it("formats Thai baht text", () => {
    assert.equal(formatThaiBahtText("0.00"), "ศูนย์บาทถ้วน");
    assert.equal(formatThaiBahtText("21.00"), "ยี่สิบเอ็ดบาทถ้วน");
    assert.equal(formatThaiBahtText("1000001.25"), "หนึ่งล้านหนึ่งบาทยี่สิบห้าสตางค์");
  });
});
