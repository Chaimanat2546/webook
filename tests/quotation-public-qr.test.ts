import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QuotationCalculation } from "../lib/quotation-calculator.ts";
import { buildQuotationDocumentViewModel } from "../lib/quotation-document-view.ts";
import { getQuotationPublicOrigin } from "../lib/env.ts";
import {
  buildQuotationPublicUrl,
  createQuotationPublicQrDataUrl,
} from "../lib/quotation-public-qr.ts";
import type { QuotationPayload } from "../lib/quotation-types.ts";

describe("quotation Public QR", () => {
  it("builds the exact token URL without inheriting an origin path", () => {
    assert.equal(
      buildQuotationPublicUrl("https://example.com/admin/quotations", "123e4567-e89b-42d3-a456-426614174000"),
      "https://example.com/q/123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("builds the token destination only from the configured HTTPS origin", () => {
    const origin = getQuotationPublicOrigin("https://quotes.example.com/");
    assert.equal(
      origin ? buildQuotationPublicUrl(origin, "123e4567-e89b-42d3-a456-426614174000") : "",
      "https://quotes.example.com/q/123e4567-e89b-42d3-a456-426614174000",
    );
    assert.equal(getQuotationPublicOrigin("http://attacker.example"), null);
  });

  it("generates a PNG Data URL", async () => {
    const value = await createQuotationPublicQrDataUrl("https://example.com/q/123e4567-e89b-42d3-a456-426614174000");
    assert.match(value, /^data:image\/png;base64,/);
  });

  it("builds the shared display model once with sorted payments and safe QR fallback", () => {
    const calculation: QuotationCalculation = {
      amountDue: "21.00",
      discountTotal: "0.00",
      grandTotal: "21.00",
      grossTotal: "21.00",
      lines: [],
      preTaxTotal: "21.00",
      vatTotal: "0.00",
      withholdingTaxTotal: "0.00",
    };
    const payload = {
      certification: {
        approver: { name: "", position: "", signatureUrl: "" },
        companyStampUrl: "",
        issuer: { name: "", position: "", signatureUrl: "" },
      },
      customer: { address: "", branchNumber: "", name: "ลูกค้า", officeType: "head_office", taxId: "" },
      id: "quotation-id",
      internalNotes: "private",
      issueDate: "2026-07-20",
      items: [],
      paymentMethods: [
        { accountName: "", accountNumber: "", accountType: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", id: "second", instructions: "", position: 2, promptPayId: "bad", providerName: "", qrImageUrl: "", qrMode: "auto_promptpay", type: "promptpay" },
        { accountName: "", accountNumber: "", accountType: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", id: "first", instructions: "", position: 1, promptPayId: "", providerName: "", qrImageUrl: "https://media.example/qr.png", qrMode: "upload", type: "qr_payment" },
      ],
      publicNotes: "",
      reference: "",
      seller: { address: "", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "ผู้ขาย", officeType: "head_office", phone: "", taxId: "", website: "" },
      subject: "",
      validUntil: "2026-07-30",
      validityDays: "10",
      withholdingTaxRate: null,
    } satisfies QuotationPayload;

    const model = buildQuotationDocumentViewModel({
      calculation,
      documentNumber: "QO-1",
      payload,
      publicQrDataUrl: "data:image/png;base64,public",
    });

    assert.equal(model.amountInWords, "ยี่สิบเอ็ดบาทถ้วน");
    assert.equal(model.issueDate, "20/07/2026");
    assert.equal(model.validUntil, "30/07/2026");
    assert.deepEqual(model.paymentMethods.map(({ id }) => id), ["first", "second"]);
    assert.equal(model.paymentMethods[0]?.qrSource, "https://media.example/qr.png");
    assert.equal(model.paymentMethods[1]?.qrSource, "");
  });
});
