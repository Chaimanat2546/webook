export const QUOTATION_TEMPLATES = [
  "current",
  "hospitality",
  "corporate",
] as const;

export type QuotationTemplate = (typeof QUOTATION_TEMPLATES)[number];

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplate = "current";

export const QUOTATION_TEMPLATE_LABELS: Record<QuotationTemplate, string> = {
  corporate: "Corporate",
  current: "Current",
  hospitality: "Hospitality",
};

export function isQuotationTemplate(value: unknown): value is QuotationTemplate {
  return typeof value === "string"
    && QUOTATION_TEMPLATES.includes(value as QuotationTemplate);
}

export function normalizeQuotationTemplate(value: unknown): QuotationTemplate {
  if (value == null || value === "") return DEFAULT_QUOTATION_TEMPLATE;
  if (isQuotationTemplate(value)) return value;
  throw new Error("Invalid quotation template snapshot");
}
