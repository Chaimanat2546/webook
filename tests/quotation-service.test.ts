import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addQuotationCalendarDays,
  getBangkokCalendarDate,
} from "../lib/quotation-dates.ts";
import {
  prepareQuotationPayload,
  prepareSellerSnapshot,
  QuotationValidationError,
  emptyQuotationPayload,
} from "../server/services/quotations.ts";
import type { QuotationPayload } from "../lib/quotation-types.ts";

function validPayload(): QuotationPayload {
  return {
    currency: "THB",
    customer: { address: "Customer address", branchNumber: "", contactName: "", email: "customer@example.com", name: "Customer", officeType: "head_office", phone: "020000000", serviceLocation: "", shippingAddress: "", taxId: "" },
    documentDiscountType: null,
    documentDiscountValue: "0",
    id: null,
    internalNotes: "",
    issueDate: "2026-07-14",
    items: [{ description: "", discountType: null, discountValue: "0", id: "123e4567-e89b-42d3-a456-426614174001", name: "Service", position: 1, quantity: "1", sku: "", unit: "job", unitPrice: "10000.00", vatRate: "7.00", vatTreatment: "taxable" }],
    priceMode: "vat_exclusive",
    publicNotes: "",
    reference: "",
    seller: { address: "Seller address", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "seller@example.com", logoUrl: "", name: "Seller", officeType: "head_office", phone: "020000001", taxId: "0100000000000", website: "" },
    subject: "Photography",
    validUntil: "2026-07-29",
    validityDays: "15",
  };
}

describe("quotation service", () => {
  it("uses Bangkok dates and calendar-day validity", () => {
    assert.equal(getBangkokCalendarDate(new Date("2026-07-13T18:00:00.000Z")), "2026-07-14");
    assert.equal(addQuotationCalendarDays("2026-07-14", 15), "2026-07-29");
  });

  it("normalizes and recalculates a valid payload", () => {
    const result = prepareQuotationPayload(validPayload());
    assert.equal(result.payload.customer.name, "Customer");
    assert.equal(result.calculation.grandTotal, "10700.00");
    assert.equal(result.amountInWords, "หนึ่งหมื่นเจ็ดร้อยบาทถ้วน");
  });

  it("trims enum and currency strings before validation", () => {
    const payload = validPayload();
    const input = {
      ...payload,
      currency: " THB ",
      customer: { ...payload.customer, officeType: " branch " },
      documentDiscountType: " amount ",
      items: [{ ...payload.items[0]!, discountType: " percent ", discountValue: "10", vatTreatment: " exempt " }],
      priceMode: " vat_inclusive ",
      seller: { ...payload.seller, officeType: " branch " },
    };
    const result = prepareQuotationPayload(input);
    assert.equal(result.payload.currency, "THB");
    assert.equal(result.payload.seller.officeType, "branch");
    assert.equal(result.payload.customer.officeType, "branch");
    assert.equal(result.payload.priceMode, "vat_inclusive");
    assert.equal(result.payload.documentDiscountType, "amount");
    assert.equal(result.payload.items[0]!.discountType, "percent");
    assert.equal(result.payload.items[0]!.vatTreatment, "exempt");
  });

  it("requires seller, customer, dates, and at least one valid item", () => {
    const payload = validPayload();
    payload.seller.name = "";
    payload.customer.address = "";
    payload.items[0]!.name = "";
    assert.throws(() => prepareQuotationPayload(payload), (error) => {
      assert.equal(error instanceof QuotationValidationError, true);
      if (!(error instanceof QuotationValidationError)) return false;
      assert.equal(error.fieldErrors["seller.name"], "กรุณากรอกชื่อผู้ขาย");
      assert.equal(error.fieldErrors["customer.address"], "กรุณากรอกที่อยู่ลูกค้า");
      assert.equal(error.fieldErrors["items.0.name"], "กรุณากรอกชื่อรายการ");
      return true;
    });
  });

  it("rejects invalid date and email values", () => {
    const payload = validPayload();
    payload.validityDays = "";
    payload.validUntil = "2026-07-13";
    payload.customer.email = "bad-email";
    assert.throws(() => prepareQuotationPayload(payload), (error) => error instanceof QuotationValidationError && error.fieldErrors.validUntil === "วันที่ใช้ได้ถึงต้องไม่น้อยกว่าวันที่ออกเอกสาร" && error.fieldErrors["customer.email"] === "รูปแบบอีเมลลูกค้าไม่ถูกต้อง");
  });

  it("recomputes valid-until in validity-days mode", () => {
    const payload = validPayload();
    payload.issueDate = "2026-07-20";
    payload.validityDays = "10";
    payload.validUntil = "2099-01-01";
    const result = prepareQuotationPayload(payload);
    assert.equal(result.payload.validUntil, "2026-07-30");
    assert.equal(result.rpcPayload.validity_days, 10);
  });

  it("does not trust submitted calculation fields", () => {
    const payload = { ...validPayload(), grandTotal: "1.00" };
    const result = prepareQuotationPayload(payload);
    assert.equal(result.calculation.grandTotal, "10700.00");
  });

  it("creates a Bangkok-dated empty payload", () => {
    const payload = emptyQuotationPayload(validPayload().seller, new Date("2026-07-13T18:00:00.000Z"));
    assert.equal(payload.issueDate, "2026-07-14");
    assert.equal(payload.validUntil, "2026-07-29");
    assert.equal(payload.items.length, 1);
  });

  it("rejects percent discounts over 100 while keeping amount discounts monetary", () => {
    const payload = validPayload();
    payload.items[0]!.discountType = "percent";
    payload.items[0]!.discountValue = "100.01";
    payload.documentDiscountType = "percent";
    payload.documentDiscountValue = "101";
    assert.throws(() => prepareQuotationPayload(payload), (error) => {
      assert.equal(error instanceof QuotationValidationError, true);
      if (!(error instanceof QuotationValidationError)) return false;
      assert.ok(error.fieldErrors["items.0.discountValue"]);
      assert.ok(error.fieldErrors.documentDiscountValue);
      return true;
    });
  });

  it("returns field errors for malformed nested customer, seller, and item values", () => {
    for (const [field, payload] of [
      ["customer", { ...validPayload(), customer: null }],
      ["seller", { ...validPayload(), seller: null }],
      ["items.0", { ...validPayload(), items: [null] }],
    ] as const) {
      assert.throws(() => prepareQuotationPayload(payload), (error) => {
        assert.equal(error instanceof QuotationValidationError, true);
        return error instanceof QuotationValidationError && Boolean(error.fieldErrors[field]);
      });
    }
  });

  it("rejects non-array, empty, and oversized items before parsing them", () => {
    for (const items of [null, [], Array.from({ length: 101 }, () => validPayload().items[0])]) {
      assert.throws(() => prepareQuotationPayload({ ...validPayload(), items }), (error) =>
        error instanceof QuotationValidationError && Boolean(error.fieldErrors.items),
      );
    }
  });

  it("rejects calendar additions beyond the four-digit ISO year", () => {
    assert.throws(() => addQuotationCalendarDays("9999-12-31", 1), /Invalid quotation date or validity days/);
  });

  it("returns seller field errors instead of raw errors for malformed seller snapshots", () => {
    for (const seller of [null, [], "seller"]) {
      assert.throws(() => prepareSellerSnapshot(seller), (error) =>
        error instanceof QuotationValidationError && Boolean(error.fieldErrors.seller),
      );
    }
  });

  it("returns a user-safe field error for a malformed root payload", () => {
    assert.throws(() => prepareQuotationPayload(null), (error) =>
      error instanceof QuotationValidationError && Boolean(error.fieldErrors._form),
    );
  });

  it("rejects arbitrarily long zero-padded validity days", () => {
    const payload = validPayload();
    payload.validityDays = `${"0".repeat(100_000)}1`;
    assert.throws(() => prepareQuotationPayload(payload), (error) =>
      error instanceof QuotationValidationError && Boolean(error.fieldErrors.validityDays),
    );
  });
});
