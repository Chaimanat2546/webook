import "server-only";

import { normalizePaymentPositions, type CompanyPaymentMethod, type PaymentMethodType, type PaymentQrMode, type QuotationPaymentMethod } from "../../lib/quotation-payment-methods.ts";
import { QuotationValidationError } from "./quotations.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES: readonly PaymentMethodType[] = ["bank_transfer", "promptpay", "qr_payment", "cash", "other"];
const QR_MODES: readonly PaymentQrMode[] = ["none", "upload", "auto_promptpay"];

function text(value: unknown, max: number, field: string, errors: Record<string, string>): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max) errors[field] = "Payment value is too long";
  return result;
}

function assetUrl(value: string, field: string, errors: Record<string, string>): string {
  if (/^(?:data:|javascript:)|\.svg(?:[?#]|$)|image\/svg\+xml/i.test(value)) errors[field] = "Invalid payment asset URL";
  return value;
}

function paymentMethod(value: unknown, index: number, errors: Record<string, string>): QuotationPaymentMethod {
  const prefix = `paymentMethods.${index}`;
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (source !== value) errors[prefix] = "Invalid payment method";
  const typeValue = text(source.type, 40, `${prefix}.type`, errors);
  const qrModeValue = text(source.qrMode, 40, `${prefix}.qrMode`, errors);
  const type = TYPES.includes(typeValue as PaymentMethodType) ? typeValue as PaymentMethodType : "bank_transfer";
  const qrMode = QR_MODES.includes(qrModeValue as PaymentQrMode) ? qrModeValue as PaymentQrMode : "none";
  if (typeValue !== type) errors[`${prefix}.type`] = "Invalid payment type";
  if (qrModeValue !== qrMode) errors[`${prefix}.qrMode`] = "Invalid QR mode";
  const id = text(source.id, 200, `${prefix}.id`, errors);
  const bankId = typeof source.bankId === "string" ? source.bankId.trim() : null;
  if (!UUID.test(id)) errors[`${prefix}.id`] = "Invalid payment method ID";
  if (bankId !== null && !UUID.test(bankId)) errors[`${prefix}.bankId`] = "Invalid bank ID";
  const method = {
    accountName: text(source.accountName, 200, `${prefix}.accountName`, errors),
    accountNumber: text(source.accountNumber, 200, `${prefix}.accountNumber`, errors),
    bankCode: text(source.bankCode, 200, `${prefix}.bankCode`, errors),
    bankId,
    bankLogoUrl: text(source.bankLogoUrl, 2_048, `${prefix}.bankLogoUrl`, errors),
    bankName: text(source.bankName, 200, `${prefix}.bankName`, errors),
    customBankLogoUrl: assetUrl(text(source.customBankLogoUrl, 2_048, `${prefix}.customBankLogoUrl`, errors), `${prefix}.customBankLogoUrl`, errors),
    customBankName: text(source.customBankName, 200, `${prefix}.customBankName`, errors),
    id,
    instructions: text(source.instructions, 2_000, `${prefix}.instructions`, errors),
    position: 0,
    promptPayId: text(source.promptPayId, 200, `${prefix}.promptPayId`, errors).replace(/\D/g, ""),
    providerName: text(source.providerName, 200, `${prefix}.providerName`, errors),
    qrImageUrl: assetUrl(text(source.qrImageUrl, 2_048, `${prefix}.qrImageUrl`, errors), `${prefix}.qrImageUrl`, errors),
    qrMode,
    type,
  };
  if (type === "bank_transfer") {
    if (!method.accountName) errors[`${prefix}.accountName`] = "Account name is required";
    if (!method.accountNumber) errors[`${prefix}.accountNumber`] = "Account number is required";
    if (!method.bankId && !method.customBankName) errors[`${prefix}.bankId`] = "Bank is required";
  }
  if (type === "promptpay") {
    if (!method.accountName) errors[`${prefix}.accountName`] = "Account name is required";
    if (![10, 13].includes(method.promptPayId.length)) errors[`${prefix}.promptPayId`] = "PromptPay ID must contain 10 or 13 digits";
    if (qrMode === "none") errors[`${prefix}.qrMode`] = "PromptPay requires an uploaded or automatic QR";
  }
  if (type === "qr_payment" && !method.providerName) errors[`${prefix}.providerName`] = "Provider name is required";
  if (type === "other" && !method.providerName) errors[`${prefix}.providerName`] = "Display name is required";
  if ((type === "qr_payment" || qrMode === "upload") && !method.qrImageUrl) errors[`${prefix}.qrImageUrl`] = "QR image is required";
  if (qrMode === "auto_promptpay" && type !== "promptpay") errors[`${prefix}.qrMode`] = "Automatic PromptPay QR is only available for PromptPay";
  return method;
}

export function preparePaymentMethods(value: unknown): QuotationPaymentMethod[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new QuotationValidationError({ paymentMethods: "Invalid payment methods" });
  if (value.length > 20) throw new QuotationValidationError({ paymentMethods: "Payment method count cannot exceed 20" });
  const errors: Record<string, string> = {};
  const methods = value.map((row, index) => paymentMethod(row, index, errors));
  if (new Set(methods.map((method) => method.id)).size !== methods.length) errors.paymentMethods = "Payment method IDs must be unique";
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return normalizePaymentPositions(methods);
}

export function prepareCompanyPaymentMethods(value: unknown): CompanyPaymentMethod[] {
  const methods = preparePaymentMethods(value);
  const source = Array.isArray(value) ? value : [];
  return methods.map((method, index) => ({ ...method, isDefault: source[index] && typeof source[index] === "object" && !Array.isArray(source[index]) && (source[index] as Record<string, unknown>).isDefault === true }));
}
