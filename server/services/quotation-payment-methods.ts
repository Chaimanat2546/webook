import "server-only";

import { MAX_PAYMENT_METHODS, normalizePaymentPositions, type CompanyPaymentMethod, type PaymentMethodType, type PaymentQrMode, type QuotationPaymentMethod } from "../../lib/quotation-payment-methods.ts";
import { QuotationValidationError } from "./quotations.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES: readonly PaymentMethodType[] = ["bank_transfer", "promptpay", "qr_payment", "cash", "other"];
const QR_MODES: readonly PaymentQrMode[] = ["none", "upload", "auto_promptpay"];

function text(value: unknown, max: number, field: string, errors: Record<string, string>): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max) errors[field] = "ข้อมูลช่องทางชำระเงินยาวเกินกำหนด";
  return result;
}

function assetUrl(value: string, field: string, errors: Record<string, string>): string {
  if (/^(?:data:|javascript:)|\.svg(?:[?#]|$)|image\/svg\+xml/i.test(value)) errors[field] = "ลิงก์รูปช่องทางชำระเงินไม่ถูกต้อง";
  return value;
}

function paymentMethod(value: unknown, index: number, errors: Record<string, string>): QuotationPaymentMethod {
  const prefix = `paymentMethods.${index}`;
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (source !== value) errors[prefix] = "ข้อมูลช่องทางชำระเงินไม่ถูกต้อง";
  const typeValue = text(source.type, 40, `${prefix}.type`, errors);
  const qrModeValue = text(source.qrMode, 40, `${prefix}.qrMode`, errors);
  const type = TYPES.includes(typeValue as PaymentMethodType) ? typeValue as PaymentMethodType : "bank_transfer";
  const qrMode = QR_MODES.includes(qrModeValue as PaymentQrMode) ? qrModeValue as PaymentQrMode : "none";
  if (typeValue !== type) errors[`${prefix}.type`] = "ประเภทช่องทางชำระเงินไม่ถูกต้อง";
  if (qrModeValue !== qrMode) errors[`${prefix}.qrMode`] = "รูปแบบ QR ไม่ถูกต้อง";
  const id = text(source.id, 200, `${prefix}.id`, errors);
  const bankId = typeof source.bankId === "string" ? source.bankId.trim() : null;
  if (!UUID.test(id)) errors[`${prefix}.id`] = "รหัสช่องทางชำระเงินไม่ถูกต้อง";
  if (bankId !== null && !UUID.test(bankId)) errors[`${prefix}.bankId`] = "รหัสธนาคารไม่ถูกต้อง";
  let method: QuotationPaymentMethod = {
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
  const shared = { id: method.id, instructions: method.instructions, position: 0, type: method.type };
  if (type === "bank_transfer") {
    method = { ...method, promptPayId: "", providerName: "" };
    if (method.bankId) {
      method.customBankLogoUrl = "";
      method.customBankName = "";
    } else {
      method.bankCode = "OTHER";
      method.bankName = "";
    }
    if (qrMode === "auto_promptpay") method.qrMode = "none";
    if (method.qrMode !== "upload") method.qrImageUrl = "";
  } else if (type === "promptpay") {
    method = { ...method, accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", providerName: "" };
    if (method.qrMode !== "upload") method.qrImageUrl = "";
  } else if (type === "qr_payment") {
    method = { ...method, ...shared, accountName: "", accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", promptPayId: "", qrMode: "upload" };
  } else {
    method = { ...method, ...shared, accountName: "", accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", promptPayId: "", qrImageUrl: "", qrMode: "none", providerName: type === "other" ? method.providerName : "" };
  }
  const relevant = new Set(type === "bank_transfer"
    ? ["accountName", "accountNumber", "bankCode", "bankId", "bankLogoUrl", "customBankLogoUrl", "customBankName", "id", "instructions", "qrImageUrl", "qrMode", "type"]
    : type === "promptpay"
      ? ["accountName", "id", "instructions", "promptPayId", "qrImageUrl", "qrMode", "type"]
      : type === "qr_payment"
        ? ["id", "instructions", "providerName", "qrImageUrl", "qrMode", "type"]
        : type === "other"
          ? ["id", "instructions", "providerName", "type"]
          : ["id", "instructions", "type"]);
  for (const key of Object.keys(errors)) {
    if (key.startsWith(`${prefix}.`) && !relevant.has(key.slice(prefix.length + 1))) delete errors[key];
  }
  if (type === "bank_transfer") {
    if (method.bankLogoUrl && !/^\/quotation\/banks\/[a-z0-9-]+\.svg$/i.test(method.bankLogoUrl)) errors[`${prefix}.bankLogoUrl`] = "โลโก้ธนาคารในระบบไม่ถูกต้อง";
    if (!method.accountName) errors[`${prefix}.accountName`] = "กรุณากรอกชื่อบัญชี";
    if (!method.accountNumber) errors[`${prefix}.accountNumber`] = "กรุณากรอกเลขที่บัญชี";
    if (!method.bankId && !method.customBankName) errors[`${prefix}.bankId`] = "กรุณาเลือกธนาคาร";
  }
  if (type === "promptpay") {
    if (!method.accountName) errors[`${prefix}.accountName`] = "กรุณากรอกชื่อบัญชี";
    if (![10, 13].includes(method.promptPayId.length)) errors[`${prefix}.promptPayId`] = "หมายเลข PromptPay ต้องมี 10 หรือ 13 หลัก";
    if (qrMode === "none") errors[`${prefix}.qrMode`] = "PromptPay ต้องใช้ QR ที่อัปโหลดหรือสร้างอัตโนมัติ";
  }
  if (type === "qr_payment" && !method.providerName) errors[`${prefix}.providerName`] = "กรุณากรอกชื่อผู้ให้บริการ";
  if (type === "other" && !method.providerName) errors[`${prefix}.providerName`] = "กรุณากรอกชื่อช่องทาง";
  if ((type === "qr_payment" || qrMode === "upload") && !method.qrImageUrl) errors[`${prefix}.qrImageUrl`] = "กรุณาอัปโหลดรูป QR";
  if (method.qrMode === "auto_promptpay" && type !== "promptpay") errors[`${prefix}.qrMode`] = "QR PromptPay อัตโนมัติใช้ได้กับช่องทาง PromptPay เท่านั้น";
  return method;
}

export function preparePaymentMethods(value: unknown): QuotationPaymentMethod[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new QuotationValidationError({ paymentMethods: "ข้อมูลช่องทางชำระเงินไม่ถูกต้อง" });
  if (value.length > MAX_PAYMENT_METHODS) throw new QuotationValidationError({ paymentMethods: "เพิ่มช่องทางชำระเงินได้ไม่เกิน 20 รายการ" });
  const errors: Record<string, string> = {};
  const methods = value.map((row, index) => paymentMethod(row, index, errors));
  if (new Set(methods.map((method) => method.id)).size !== methods.length) errors.paymentMethods = "รหัสช่องทางชำระเงินต้องไม่ซ้ำกัน";
  if (Object.keys(errors).length) throw new QuotationValidationError(errors);
  return normalizePaymentPositions(methods);
}

export function prepareCompanyPaymentMethods(value: unknown): CompanyPaymentMethod[] {
  const methods = preparePaymentMethods(value);
  const source = Array.isArray(value) ? value : [];
  return methods.map((method, index) => ({ ...method, isDefault: source[index] && typeof source[index] === "object" && !Array.isArray(source[index]) && (source[index] as Record<string, unknown>).isDefault === true }));
}
