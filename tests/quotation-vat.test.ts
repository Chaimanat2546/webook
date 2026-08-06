import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeQuotationVatChoices } from "../lib/quotation-vat.ts";
import { QUOTATION_DOCUMENT_DISPLAY_DEFAULTS } from "../lib/quotation-document-display.ts";
import { canonicalQuotationLayoutSnapshot } from "../lib/quotation-layout.ts";
import type { QuotationPayload } from "../lib/quotation-types.ts";

function payload(): QuotationPayload {
  return {
    certification: {
      approver: { name: "", position: "", signatureUrl: "" },
      companyStampUrl: "",
      issuer: { name: "", position: "", signatureUrl: "" },
    },
    documentDisplay: { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS },
    customer: { address: "Customer", branchNumber: "", name: "Customer", officeType: "head_office", taxId: "0200000000000" },
    id: "quotation-id",
    internalNotes: "",
    issueDate: "2026-07-22",
    items: [
      { description: "", discountAmount: "0", id: "one", name: "Legacy taxable", position: 1, quantity: "1", unit: "", unitPrice: "100", vatRate: "5", vatTreatment: "taxable" },
      { description: "", discountAmount: "0", id: "two", name: "Legacy exempt", position: 2, quantity: "1", unit: "", unitPrice: "100", vatRate: "0", vatTreatment: "exempt" },
      { description: "", discountAmount: "0", id: "three", name: "Zero rated", position: 3, quantity: "1", unit: "", unitPrice: "100", vatRate: "0", vatTreatment: "taxable" },
    ],
    layout: { ...canonicalQuotationLayoutSnapshot("current"), sourceId: "123e4567-e89b-42d3-a456-426614174099" },
    paymentMethods: [],
    publicNotes: "",
    reference: "",
    seller: { address: "Seller", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "Seller", officeType: "head_office", phone: "", taxId: "0100000000000", website: "" },
    subject: "",
    template: "current",
    validUntil: "2026-08-06",
    validityDays: "15",
    withholdingTaxRate: null,
  };
}

describe("quotation VAT editor normalization", () => {
  it("normalizes only the editable copy and leaves the saved snapshot unchanged", () => {
    const saved = payload();
    const editable = normalizeQuotationVatChoices(saved);

    assert.deepEqual(editable.items.map(({ vatRate, vatTreatment }) => ({ vatRate, vatTreatment })), [
      { vatRate: "7", vatTreatment: "taxable" },
      { vatRate: "0", vatTreatment: "none" },
      { vatRate: "0", vatTreatment: "taxable" },
    ]);
    assert.equal(saved.items[0]?.vatRate, "5");
    assert.equal(saved.items[1]?.vatTreatment, "exempt");
  });
});
