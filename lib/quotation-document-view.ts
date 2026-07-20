import { formatThaiBahtText, type QuotationCalculation } from "./quotation-calculator.ts";
import type { CertificationSnapshot } from "./quotation-certification.ts";
import type { QuotationPaymentMethod } from "./quotation-payment-methods.ts";
import type { QuotationPayload } from "./quotation-types.ts";
import { renderThaiQRPaymentMatrix } from "thai-qr-payment";

export interface QuotationDocumentViewModel {
  amountInWords: string;
  calculation: QuotationCalculation;
  certification: CertificationSnapshot;
  documentNumber: string;
  issueDate: string;
  payload: QuotationPayload;
  paymentMethods: Array<QuotationPaymentMethod & { qrSource: string }>;
  publicQrDataUrl: string;
  showItemDiscount: boolean;
  showItemVat: boolean;
  validUntil: string;
}

export function buildQuotationDocumentViewModel({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string | null;
  payload: QuotationPayload;
  publicQrDataUrl?: string | null;
}): QuotationDocumentViewModel {
  return {
    amountInWords: formatThaiBahtText(calculation.amountDue),
    calculation,
    certification: payload.certification,
    documentNumber: documentNumber ?? "เลขที่ออกเมื่อบันทึก",
    issueDate: documentDate(payload.issueDate),
    payload,
    paymentMethods: [...payload.paymentMethods]
      .sort((left, right) => left.position - right.position)
      .map((method) => ({ ...method, qrSource: paymentQrSource(method, calculation.amountDue) })),
    publicQrDataUrl: publicQrDataUrl ?? "",
    showItemDiscount: payload.items.some((item) => Number(item.discountAmount) > 0),
    showItemVat: payload.items.some((item) => item.vatTreatment !== "none"),
    validUntil: documentDate(payload.validUntil),
  };
}

function paymentQrSource(method: QuotationPaymentMethod, amountDue: string): string {
  if (method.qrMode === "upload") return method.qrImageUrl;
  if (method.qrMode !== "auto_promptpay") return "";
  const amount = Number(amountDue);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  try {
    const svg = renderThaiQRPaymentMatrix({
      amount,
      recipient: method.promptPayId,
      size: 160,
    });
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  } catch {
    return "";
  }
}

function documentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
