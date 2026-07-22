import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  certificationSnapshotToJson,
  emptyCertificationSnapshot,
  updateCertificationSigner,
  type CertificationSnapshot,
} from "../lib/quotation-certification.ts";
import {
  prepareQuotationPayload,
  QuotationValidationError,
} from "../server/services/quotations.ts";

const validPayload = () => ({
  certification: {
    approver: { name: "  ผู้อนุมัติ  ", position: "กรรมการ", signatureUrl: "" },
    companyStampUrl: "",
    issuer: { name: "  ผู้ออกเอกสาร  ", position: "ฝ่ายขาย", signatureUrl: "" },
  },
  customer: { address: "Customer address", branchNumber: "", name: "Customer", officeType: "head_office", taxId: "0200000000000" },
  id: null,
  internalNotes: "",
  issueDate: "2026-07-20",
  items: [{ description: "", discountAmount: "0", id: crypto.randomUUID(), name: "Room", position: 1, quantity: "1", unit: "คืน", unitPrice: "1000", vatRate: "0", vatTreatment: "none" }],
  paymentMethods: [],
  publicNotes: "",
  reference: "",
  seller: { address: "Seller address", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "", logoUrl: "", name: "Seller", officeType: "head_office", phone: "", taxId: "0100000000000", website: "" },
  subject: "",
  validUntil: "2026-08-04",
  validityDays: "15",
  withholdingTaxRate: null,
});

describe("quotation certification", () => {
  it("creates independent empty values and nullable database JSON", () => {
    const first = emptyCertificationSnapshot();
    const second = emptyCertificationSnapshot();
    first.issuer.name = "changed";
    assert.equal(second.issuer.name, "");
    assert.deepEqual(certificationSnapshotToJson(second), {
      approver: { name: null, position: null, signature_url: null },
      company_stamp_url: null,
      issuer: { name: null, position: null, signature_url: null },
    });
  });

  it("trims certification and includes it in the transactional payload", () => {
    const prepared = prepareQuotationPayload(validPayload());
    assert.equal(prepared.payload.certification.issuer.name, "ผู้ออกเอกสาร");
    assert.equal(prepared.rpcPayload.certification_snapshot.issuer.name, "ผู้ออกเอกสาร");
    assert.equal(prepared.rpcPayload.certification_snapshot.approver.signature_url, null);
  });

  it("rejects overlong certification fields", () => {
    const value = validPayload();
    value.certification.issuer.name = "x".repeat(201);
    assert.throws(
      () => prepareQuotationPayload(value),
      (error) => error instanceof QuotationValidationError
        && error.fieldErrors["certification.issuer.name"] === "ข้อมูลยาวเกินกำหนด",
    );
  });

  it("applies a completed upload to the latest signer state", () => {
    const uploadCompletion = (current: CertificationSnapshot) => updateCertificationSigner(current, "issuer", { signatureUrl: "https://media.example/signature.png" });
    const editedWhileUploading = updateCertificationSigner(emptyCertificationSnapshot(), "issuer", { name: "แก้ไขล่าสุด" });
    const completed = uploadCompletion(editedWhileUploading);

    assert.equal(completed.issuer.name, "แก้ไขล่าสุด");
    assert.equal(completed.issuer.signatureUrl, "https://media.example/signature.png");
  });
});
