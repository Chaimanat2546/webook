export type PaymentMethodType = "bank_transfer" | "promptpay" | "qr_payment" | "cash" | "other";
export type PaymentQrMode = "none" | "upload" | "auto_promptpay";

export interface QuotationPaymentMethod {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankId: string | null;
  bankLogoUrl: string;
  bankName: string;
  customBankLogoUrl: string;
  customBankName: string;
  id: string;
  instructions: string;
  position: number;
  promptPayId: string;
  providerName: string;
  qrImageUrl: string;
  qrMode: PaymentQrMode;
  type: PaymentMethodType;
}

export interface CompanyPaymentMethod extends QuotationPaymentMethod {
  isDefault: boolean;
}

export interface BankOption {
  code: string;
  id: string;
  logoUrl: string;
  name: string;
}

export function normalizePaymentPositions<T extends QuotationPaymentMethod>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function emptyPaymentMethod(type: PaymentMethodType = "bank_transfer"): QuotationPaymentMethod {
  return { accountName: "", accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", id: crypto.randomUUID(), instructions: "", position: 1, promptPayId: "", providerName: "", qrImageUrl: "", qrMode: "none", type };
}
