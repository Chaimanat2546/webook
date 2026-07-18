import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePayload, payloadFor } from "thai-qr-payment";

import {
  MAX_PAYMENT_METHODS,
  normalizePaymentPositions,
  paymentMethodListState,
} from "../lib/quotation-payment-methods.ts";
import {
  prepareCompanyPaymentMethods,
  preparePaymentMethods,
} from "../server/services/quotation-payment-methods.ts";
import { QuotationValidationError } from "../server/services/quotations.ts";

const bank = {
  accountName: "Pool Villa Pattaya",
  accountNumber: "137-1-17528-4",
  bankCode: "004",
  bankId: "123e4567-e89b-42d3-a456-426614174000",
  bankLogoUrl: "/quotation/banks/kbank.svg",
  bankName: "Kasikornbank",
  customBankLogoUrl: "",
  customBankName: "",
  id: "123e4567-e89b-42d3-a456-426614174001",
  instructions: "",
  position: 9,
  promptPayId: "",
  providerName: "",
  qrImageUrl: "",
  qrMode: "none" as const,
  type: "bank_transfer" as const,
};

describe("quotation payment methods", () => {
  it("builds a valid amount-bound PromptPay payload", () => {
    const payload = payloadFor({ recipient: "0812345678", amount: 50 });
    const parsed = parsePayload(payload);

    assert.equal(payload, "00020101021229370016A000000677010111011300668123456785303764540550.005802TH63045197");
    assert.equal(parsed.crc.valid, true);
    assert.equal(parsed.currency, "764");
    assert.equal(parsed.amount, 50);
    assert.equal(parsed.merchant?.kind, "promptpay");
    assert.equal(parsed.merchant?.recipient, "0812345678");
  });

  it("uses the payload API type field for a national ID", () => {
    const payload = payloadFor({
      amount: 50,
      recipient: "1234567890123",
      type: "nationalId",
    });
    const parsed = parsePayload(payload);

    assert.equal(parsed.crc.valid, true);
    assert.equal(parsed.amount, 50);
    assert.equal(parsed.merchant?.recipient, "1234567890123");
  });

  it("exposes the list error and blocks a twenty-first method", () => {
    assert.deepEqual(
      paymentMethodListState(
        Array.from({ length: MAX_PAYMENT_METHODS }, () => bank),
        { paymentMethods: "Payment method IDs must be unique" },
      ),
      { canAdd: false, rootError: "Payment method IDs must be unique" },
    );
  });

  it("allows no payment method and normalizes positions", () => {
    assert.deepEqual(preparePaymentMethods([]), []);
    assert.deepEqual(
      normalizePaymentPositions([bank, { ...bank, id: crypto.randomUUID() }]).map((row) => row.position),
      [1, 2],
    );
  });

  it("normalizes PromptPay digits", () => {
    const [method] = preparePaymentMethods([{
      ...bank,
      accountNumber: "",
      bankCode: "",
      bankId: null,
      bankLogoUrl: "",
      bankName: "",
      promptPayId: "081-234-5678",
      qrMode: "auto_promptpay",
      type: "promptpay",
    }]);
    assert.equal(method?.promptPayId, "0812345678");
  });

  it("requires an uploaded or automatic QR for PromptPay", () => {
    assert.throws(
      () => preparePaymentMethods([{
        ...bank,
        accountNumber: "",
        bankCode: "",
        bankId: null,
        bankLogoUrl: "",
        bankName: "",
        promptPayId: "0812345678",
        type: "promptpay",
      }]),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["paymentMethods.0.qrMode"]),
    );
  });

  it("rejects missing type-specific data", () => {
    for (const [method, field] of [
      [{ ...bank, accountName: "" }, "paymentMethods.0.accountName"],
      [{ ...bank, accountNumber: "" }, "paymentMethods.0.accountNumber"],
      [{ ...bank, bankId: null }, "paymentMethods.0.bankId"],
      [{ ...bank, accountName: "", bankId: null, type: "promptpay" }, "paymentMethods.0.accountName"],
      [{ ...bank, promptPayId: "123", type: "promptpay" }, "paymentMethods.0.promptPayId"],
      [{ ...bank, providerName: "", type: "qr_payment" }, "paymentMethods.0.providerName"],
      [{ ...bank, qrImageUrl: "", type: "qr_payment" }, "paymentMethods.0.qrImageUrl"],
      [{ ...bank, providerName: "", type: "other" }, "paymentMethods.0.providerName"],
      [{ ...bank, qrImageUrl: "", qrMode: "upload" }, "paymentMethods.0.qrImageUrl"],
    ] as const) {
      assert.throws(() => preparePaymentMethods([method]), (error) =>
        error instanceof QuotationValidationError && Boolean(error.fieldErrors[field]),
      );
    }
  });

  it("rejects untrusted SVG payment assets", () => {
    assert.throws(() => preparePaymentMethods([{ ...bank, qrImageUrl: "/quotations/payment-assets/qr.svg", qrMode: "upload" }]), /Quotation validation failed/);
    assert.throws(() => preparePaymentMethods([{ ...bank, customBankLogoUrl: "data:image/svg+xml,<svg />" }]), /Quotation validation failed/);
  });

  it("rejects duplicate IDs and more than twenty methods", () => {
    assert.throws(() => preparePaymentMethods([bank, { ...bank }]), /Quotation validation failed/);
    assert.throws(() => preparePaymentMethods(Array.from({ length: 21 }, (_, index) => ({ ...bank, id: crypto.randomUUID(), position: index + 1 }))), /Quotation validation failed/);
  });

  it("rejects unsupported enums and oversized text", () => {
    assert.throws(() => preparePaymentMethods([{ ...bank, type: "card" }]), /Quotation validation failed/);
    assert.throws(() => preparePaymentMethods([{ ...bank, instructions: "x".repeat(2_001) }]), /Quotation validation failed/);
    assert.throws(() => preparePaymentMethods([{ ...bank, qrMode: "auto_promptpay" }]), /Quotation validation failed/);
  });

  it("preserves only boolean default flags for company methods", () => {
    const [method] = prepareCompanyPaymentMethods([{ ...bank, isDefault: "yes" }, { ...bank, id: crypto.randomUUID(), isDefault: true }]);
    assert.equal(method?.isDefault, false);
  });
});
