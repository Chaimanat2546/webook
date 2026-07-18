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

export const MAX_PAYMENT_METHODS = 20;

export function paymentMethodListState(
  methods: readonly QuotationPaymentMethod[],
  errors: Readonly<Record<string, string>>,
) {
  return {
    canAdd: methods.length < MAX_PAYMENT_METHODS,
    rootError: errors.paymentMethods ?? "",
  };
}

export function normalizePaymentPositions<T extends QuotationPaymentMethod>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function hydratePaymentMethodBanks<T extends QuotationPaymentMethod>(rows: T[], banks: BankOption[]): T[] {
  return rows.map((row) => {
    if (row.type !== "bank_transfer" || row.bankId || row.bankCode === "OTHER") return row;
    const bank = banks.find((option) => option.code === row.bankCode);
    if (bank) return { ...row, bankId: bank.id };
    return {
      ...row,
      bankCode: "OTHER",
      bankId: null,
      customBankName: row.customBankName || row.bankName,
    };
  });
}

export function emptyPaymentMethod(type: PaymentMethodType = "bank_transfer"): QuotationPaymentMethod {
  return { accountName: "", accountNumber: "", bankCode: "", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "", id: crypto.randomUUID(), instructions: "", position: 1, promptPayId: "", providerName: "", qrImageUrl: "", qrMode: "none", type };
}

export function updatePaymentMethodType(method: QuotationPaymentMethod, type: PaymentMethodType): QuotationPaymentMethod {
  const qrMode = type === "qr_payment"
    ? "upload"
    : type === "promptpay" && method.qrMode === "none"
      ? "auto_promptpay"
      : type !== "promptpay" && method.qrMode === "auto_promptpay"
        ? "none"
        : method.qrMode;
  return { ...method, qrMode, type };
}

export function paymentMethodEditorState(method: Pick<QuotationPaymentMethod, "bankCode" | "bankId" | "qrMode" | "type">) {
  const hasCustomBankFields = method.type === "bank_transfer" && (method.bankCode === "OTHER" || !method.bankId);
  return {
    bankSelectValue: hasCustomBankFields ? "OTHER" : method.bankId ?? "OTHER",
    hasCustomBankFields,
    showQrUpload: method.qrMode === "upload",
  };
}
