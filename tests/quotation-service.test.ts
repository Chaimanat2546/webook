import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addQuotationCalendarDays,
  getBangkokCalendarDate,
} from "../lib/quotation-dates.ts";
import { emptyCertificationSnapshot } from "../lib/quotation-certification.ts";
import {
  QUOTATION_DOCUMENT_DISPLAY_DEFAULTS,
  quotationDocumentDisplayClearImpact,
} from "../lib/quotation-document-display.ts";
import {
  DEFAULT_QUOTATION_TEMPLATE,
  isQuotationTemplate,
  normalizeQuotationTemplate,
} from "../lib/quotation-template.ts";
import { canonicalQuotationLayoutSnapshot } from "../lib/quotation-layout.ts";
import {
  prepareQuotationPayload as prepareQuotationPayloadWithCatalog,
  prepareSellerSnapshot,
  QuotationValidationError,
  emptyQuotationPayload,
} from "../server/services/quotations.ts";
import type { QuotationPayload } from "../lib/quotation-types.ts";

const itemNames = [
  "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 1/2)",
  "ค่าที่พัก (ลูกค้าชำระเงินครั้งที่ 2/2)",
  "ค่าที่พัก (ลูกค้าชำระเงินเต็มจำนวน)",
  "ค่าบริการ",
  "ประกันความเสียหาย",
] as const;

function prepareQuotationPayload(value: unknown) {
  return prepareQuotationPayloadWithCatalog(value, itemNames);
}

function validPayload(): QuotationPayload {
  return {
    certification: emptyCertificationSnapshot(),
    documentDisplay: { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS },
    customer: { address: "Customer address", branchNumber: "", name: "Customer", officeType: "head_office", taxId: "0200000000000" },
    id: null,
    internalNotes: "",
    issueDate: "2026-07-14",
    items: [{ description: "", discountAmount: "0", id: "123e4567-e89b-42d3-a456-426614174001", name: "ค่าบริการ", position: 1, quantity: "1", unit: "job", unitPrice: "10000.00", vatRate: "7.00", vatTreatment: "taxable" }],
    layout: { ...canonicalQuotationLayoutSnapshot("current"), sourceId: "123e4567-e89b-42d3-a456-426614174099" },
    paymentMethods: [],
    publicNotes: "",
    reference: "",
    seller: { address: "Seller address", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "seller@example.com", logoUrl: "", name: "Seller", officeType: "head_office", phone: "020000001", taxId: "0100000000000", website: "" },
    subject: "Photography",
    template: "current",
    validUntil: "2026-07-29",
    validityDays: "15",
    withholdingTaxRate: null,
  };
}

function promptPay(qrMode: "auto_promptpay" | "upload", qrImageUrl = "") {
  return {
    accountName: "Pool Villa",
    accountNumber: "",
    accountType: "" as const,
    bankCode: "",
    bankId: null,
    bankLogoUrl: "",
    bankName: "",
    customBankLogoUrl: "",
    customBankName: "",
    id: "123e4567-e89b-42d3-a456-426614174002",
    instructions: "",
    position: 1,
    promptPayId: "0812345678",
    providerName: "",
    qrImageUrl,
    qrMode,
    type: "promptpay" as const,
  };
}

describe("quotation service", () => {
  it("accepts only the fixed quotation template catalogue", () => {
    for (const value of ["current", "hospitality", "corporate"]) {
      assert.equal(isQuotationTemplate(value), true);
    }
    for (const value of ["", "CURRENT", "custom", null, 1, {}]) {
      assert.equal(isQuotationTemplate(value), false);
    }
    assert.equal(normalizeQuotationTemplate(undefined), DEFAULT_QUOTATION_TEMPLATE);
    assert.equal(normalizeQuotationTemplate("corporate"), "corporate");
    assert.throws(
      () => normalizeQuotationTemplate("custom"),
      /Invalid quotation template snapshot/,
    );
  });

  it("persists a validated quotation template snapshot", () => {
    const payload = validPayload();
    payload.template = "hospitality";
    payload.layout = {
      ...canonicalQuotationLayoutSnapshot("hospitality"),
      sourceId: "123e4567-e89b-42d3-a456-426614174099",
    };
    const prepared = prepareQuotationPayload(payload);
    assert.equal(prepared.payload.template, "hospitality");
    assert.equal(prepared.rpcPayload.document_template_snapshot, "hospitality");
  });

  it("rejects an unsupported quotation template", () => {
    assert.throws(
      () => prepareQuotationPayload({ ...validPayload(), template: "custom" }),
      (error: unknown) =>
        error instanceof QuotationValidationError
        && error.fieldErrors.template === "เทมเพลตใบเสนอราคาไม่ถูกต้อง",
    );
  });

  it("rejects an incomplete document display snapshot", () => {
    const payload = validPayload();
    payload.documentDisplay = { reference: true } as QuotationPayload["documentDisplay"];
    assert.throws(
      () => prepareQuotationPayload(payload),
      (error: unknown) =>
        error instanceof QuotationValidationError
        && error.fieldErrors.documentDisplay === "รูปแบบเอกสารไม่ถูกต้อง",
    );
  });

  it("clears disabled document values but preserves certification source data", () => {
    const payload = validPayload();
    payload.reference = "REF-1";
    payload.publicNotes = "Public note";
    payload.certification.issuer.name = "Issuer";
    payload.withholdingTaxRate = "3";
    payload.documentDisplay = Object.fromEntries(
      Object.keys(QUOTATION_DOCUMENT_DISPLAY_DEFAULTS).map((key) => [key, false]),
    ) as QuotationPayload["documentDisplay"];

    const result = prepareQuotationPayload(payload);
    assert.equal(result.payload.reference, "");
    assert.equal(result.payload.publicNotes, "");
    assert.equal(result.payload.items[0]?.discountAmount, "0");
    assert.equal(result.payload.items[0]?.unit, "");
    assert.equal(result.payload.items[0]?.vatTreatment, "none");
    assert.equal(result.payload.withholdingTaxRate, null);
    assert.equal(result.payload.certification.issuer.name, "Issuer");
    assert.deepEqual(
      quotationDocumentDisplayClearImpact(payload, payload.documentDisplay),
      ["reference", "notes", "unit", "tax", "withholdingTax"],
    );
  });

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

  it("includes the saved bank account type in the quotation snapshot payload", () => {
    const payload = validPayload();
    payload.paymentMethods = [{
      ...promptPay("upload"),
      accountNumber: "1234567890",
      accountType: "savings",
      bankCode: "KBANK",
      bankId: "123e4567-e89b-42d3-a456-426614174003",
      bankName: "Kasikornbank",
      qrMode: "none",
      type: "bank_transfer",
    }];

    const prepared = prepareQuotationPayload(payload);
    assert.equal(prepared.rpcPayload.payment_methods[0]!.account_type, "savings");
  });

  it("trims office and VAT enum strings before validation", () => {
    const payload = validPayload();
    const input = {
      ...payload,
      customer: { ...payload.customer, branchNumber: "002", officeType: " branch " },
      items: [{ ...payload.items[0]!, vatRate: "0", vatTreatment: " taxable " }],
      seller: { ...payload.seller, branchNumber: "001", officeType: " branch " },
    };
    const result = prepareQuotationPayload(input);
    assert.equal(result.payload.seller.officeType, "branch");
    assert.equal(result.payload.customer.officeType, "branch");
    assert.equal(result.payload.items[0]!.vatTreatment, "taxable");
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

  it("rejects invalid date values", () => {
    const payload = validPayload();
    payload.validityDays = "";
    payload.validUntil = "2026-07-13";
    assert.throws(() => prepareQuotationPayload(payload), (error) => error instanceof QuotationValidationError && error.fieldErrors.validUntil === "วันที่ใช้ได้ถึงต้องไม่น้อยกว่าวันที่ออกเอกสาร");
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

  it("creates discount-off and VAT-off item defaults", () => {
    const payload = emptyQuotationPayload(validPayload().seller, new Date("2026-07-13T18:00:00.000Z"));
    assert.equal(payload.issueDate, "2026-07-14");
    assert.equal(payload.validityDays, "7");
    assert.equal(payload.validUntil, "2026-07-21");
    assert.equal(payload.template, "current");
    assert.equal(payload.items[0]!.discountAmount, "0");
    assert.equal(payload.items[0]!.vatTreatment, "none");
    assert.equal(payload.items[0]!.vatRate, "0");
    assert.deepEqual(payload.certification, emptyCertificationSnapshot());
  });

  it("copies an explicit certification snapshot into a new quotation", () => {
    const certification = {
      approver: { name: "Approver", position: "Director", signatureUrl: "" },
      companyStampUrl: "",
      issuer: { name: "Issuer", position: "Sales", signatureUrl: "" },
    };

    const payload = emptyQuotationPayload(
      validPayload().seller,
      new Date("2026-07-13T18:00:00.000Z"),
      certification,
    );

    assert.deepEqual(payload.certification, certification);
  });

  it("accepts only a fixed item discount not above gross", () => {
    const valid = validPayload();
    valid.items[0]!.discountAmount = "500.00";
    assert.equal(prepareQuotationPayload(valid).payload.items[0]!.discountAmount, "500.00");

    valid.items[0]!.discountAmount = "10000.01";
    assert.throws(
      () => prepareQuotationPayload(valid),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["items.0.discountAmount"]),
    );
  });

  it("accepts only 7%, 0%, and no VAT", () => {
    for (const [vatTreatment, vatRate] of [["taxable", "7"], ["taxable", "0"], ["none", "0"]] as const) {
      const value = validPayload();
      value.items[0] = { ...value.items[0]!, vatRate, vatTreatment };
      assert.doesNotThrow(() => prepareQuotationPayload(value));
    }

    for (const [vatTreatment, vatRate] of [["taxable", "1"], ["exempt", "0"], ["none", "7"]] as const) {
      const value = validPayload();
      value.items[0] = { ...value.items[0]!, vatRate, vatTreatment };
      assert.throws(
        () => prepareQuotationPayload(value),
        (error) => error instanceof QuotationValidationError
          && Boolean(error.fieldErrors[`items.0.${vatTreatment === "exempt" ? "vatTreatment" : "vatRate"}`]),
      );
    }
  });

  it("rejects item names outside the database catalogue", () => {
    const value = validPayload();
    value.items[0]!.name = "รายการอื่น";
    assert.throws(
      () => prepareQuotationPayload(value),
      (error) => error instanceof QuotationValidationError
        && error.fieldErrors["items.0.name"] === "กรุณาเลือกชื่อรายการจากรายการที่กำหนด",
    );
  });

  it("requires exact 13-digit seller and customer tax IDs", () => {
    for (const taxId of ["", "123456789012", "12345678901234", "123456789012A"]) {
      const value = validPayload();
      value.seller.taxId = taxId;
      value.customer.taxId = taxId;
      assert.throws(() => prepareQuotationPayload(value), (error) =>
        error instanceof QuotationValidationError
          && Boolean(error.fieldErrors["seller.taxId"])
          && Boolean(error.fieldErrors["customer.taxId"]),
      );
    }
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

  it("requires quantity but permits an empty unit", () => {
    const withEmptyUnit = validPayload();
    withEmptyUnit.items[0]!.unit = "";
    const prepared = prepareQuotationPayload(withEmptyUnit);
    assert.equal(prepared.payload.items[0]!.unit, "");
    assert.equal(prepared.rpcPayload.items[0]!.unit, null);

    const withoutQuantity = validPayload();
    withoutQuantity.items[0]!.quantity = "";
    assert.throws(
      () => prepareQuotationPayload(withoutQuantity),
      (error) => error instanceof QuotationValidationError && Boolean(error.fieldErrors["items.0.quantity"]),
    );
  });

  it("requires branch numbers only for branch offices", () => {
    const branch = validPayload();
    branch.seller.officeType = "branch";
    branch.seller.branchNumber = "";
    branch.customer.officeType = "branch";
    branch.customer.branchNumber = "";
    assert.throws(() => prepareQuotationPayload(branch), (error) => {
      assert.equal(error instanceof QuotationValidationError, true);
      return error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["seller.branchNumber"])
        && Boolean(error.fieldErrors["customer.branchNumber"]);
    });

    const headOffice = validPayload();
    headOffice.seller.branchNumber = "99999";
    headOffice.customer.branchNumber = "88888";
    const prepared = prepareQuotationPayload(headOffice);
    assert.equal(prepared.payload.seller.branchNumber, "");
    assert.equal(prepared.payload.customer.branchNumber, "");
  });

  it("supports unspecified offices without branch numbers", () => {
    const value = validPayload();
    value.seller.officeType = "unspecified";
    value.seller.branchNumber = "001";
    value.customer.officeType = "unspecified";
    value.customer.branchNumber = "002";

    const prepared = prepareQuotationPayload(value);
    assert.equal(prepared.payload.seller.officeType, "unspecified");
    assert.equal(prepared.payload.seller.branchNumber, "");
    assert.equal(prepared.payload.customer.officeType, "unspecified");
    assert.equal(prepared.payload.customer.branchNumber, "");
  });

  it("keeps only quotation customer fields and persists the subject", () => {
    const input = {
      ...validPayload(),
      customer: {
        ...validPayload().customer,
        contactName: "remove",
        email: "remove@example.test",
        phone: "remove",
        serviceLocation: "remove",
        shippingAddress: "remove",
      },
      subject: "งานบ้านพัก 3 คืน",
    };

    const prepared = prepareQuotationPayload(input);
    assert.deepEqual(prepared.payload.customer, {
      address: "Customer address",
      branchNumber: "",
      name: "Customer",
      officeType: "head_office",
      taxId: "0200000000000",
    });
    assert.equal(prepared.payload.subject, "งานบ้านพัก 3 คืน");
    assert.equal(prepared.rpcPayload.subject, "งานบ้านพัก 3 คืน");
  });

  it("validates an enabled withholding percentage", () => {
    assert.throws(
      () => prepareQuotationPayload({ ...validPayload(), withholdingTaxRate: "100.01" }),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors.withholdingTaxRate),
    );
  });

  it("rejects an automatic PromptPay QR above the wire amount limit", () => {
    const payload = validPayload();
    payload.items[0] = { ...payload.items[0]!, unitPrice: "10000000000", vatRate: "0", vatTreatment: "none" };
    payload.paymentMethods = [promptPay("auto_promptpay")];

    assert.throws(
      () => prepareQuotationPayload(payload),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["paymentMethods.0.qrMode"]),
    );
  });

  it("requires a positive amount due for automatic PromptPay", () => {
    const payload = validPayload();
    payload.items[0] = { ...payload.items[0]!, vatRate: "0", vatTreatment: "none" };
    payload.withholdingTaxRate = "100";
    payload.paymentMethods = [promptPay("auto_promptpay")];

    assert.throws(
      () => prepareQuotationPayload(payload),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["paymentMethods.0.qrMode"]),
    );
  });

  it("accepts the automatic PromptPay maximum and an uploaded QR at zero", () => {
    const maximum = validPayload();
    maximum.items[0] = { ...maximum.items[0]!, unitPrice: "9999999999.99", vatRate: "0", vatTreatment: "none" };
    maximum.paymentMethods = [promptPay("auto_promptpay")];
    assert.equal(prepareQuotationPayload(maximum).calculation.amountDue, "9999999999.99");

    const uploaded = validPayload();
    uploaded.items[0] = { ...uploaded.items[0]!, vatRate: "0", vatTreatment: "none" };
    uploaded.withholdingTaxRate = "100";
    uploaded.paymentMethods = [promptPay("upload", "/quotations/payment-assets/123e4567-e89b-42d3-a456-426614174099.png")];
    assert.equal(prepareQuotationPayload(uploaded).calculation.amountDue, "0.00");
  });
});
