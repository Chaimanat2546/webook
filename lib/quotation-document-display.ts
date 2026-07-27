import type { QuotationPayload } from "./quotation-types.ts";

export const QUOTATION_DOCUMENT_DISPLAY_KEYS = [
  "certificationDate",
  "certificationName",
  "certificationQr",
  "discount",
  "notes",
  "preTax",
  "reference",
  "tax",
  "unit",
  "withholdingTax",
] as const;

export type QuotationDocumentDisplayKey =
  (typeof QUOTATION_DOCUMENT_DISPLAY_KEYS)[number];

export type QuotationDocumentDisplay = Record<
  QuotationDocumentDisplayKey,
  boolean
>;

export const QUOTATION_DOCUMENT_DISPLAY_DEFAULTS: QuotationDocumentDisplay = {
  certificationDate: true,
  certificationName: true,
  certificationQr: true,
  discount: true,
  notes: true,
  preTax: true,
  reference: true,
  tax: true,
  unit: true,
  withholdingTax: true,
};

export function isQuotationDocumentDisplay(
  value: unknown,
): value is QuotationDocumentDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === QUOTATION_DOCUMENT_DISPLAY_KEYS.length
    && QUOTATION_DOCUMENT_DISPLAY_KEYS.every(
      (key) => typeof record[key] === "boolean",
    );
}

export function normalizeQuotationDocumentDisplay(
  value: unknown,
): QuotationDocumentDisplay {
  return isQuotationDocumentDisplay(value)
    ? { ...value }
    : { ...QUOTATION_DOCUMENT_DISPLAY_DEFAULTS };
}

export function quotationDocumentDisplayClearImpact(
  payload: QuotationPayload,
  next: QuotationDocumentDisplay,
): QuotationDocumentDisplayKey[] {
  return [
    !next.reference && payload.reference ? "reference" : null,
    !next.notes && payload.publicNotes ? "notes" : null,
    !next.discount
      && payload.items.some((item) => Number(item.discountAmount) !== 0)
      ? "discount"
      : null,
    !next.unit && payload.items.some((item) => item.unit.trim()) ? "unit" : null,
    !next.tax && payload.items.some((item) => item.vatTreatment !== "none")
      ? "tax"
      : null,
    !next.withholdingTax && payload.withholdingTaxRate !== null
      ? "withholdingTax"
      : null,
  ].filter((key): key is QuotationDocumentDisplayKey => key !== null);
}

export function applyQuotationDocumentDisplay(
  payload: QuotationPayload,
  next: QuotationDocumentDisplay,
): QuotationPayload {
  return {
    ...payload,
    documentDisplay: { ...next },
    items: payload.items.map((item) => ({
      ...item,
      discountAmount: next.discount ? item.discountAmount : "0",
      unit: next.unit ? item.unit : "",
      vatRate: next.tax ? item.vatRate : "0",
      vatTreatment: next.tax ? item.vatTreatment : "none",
    })),
    publicNotes: next.notes ? payload.publicNotes : "",
    reference: next.reference ? payload.reference : "",
    withholdingTaxRate: next.withholdingTax
      ? payload.withholdingTaxRate
      : null,
  };
}
