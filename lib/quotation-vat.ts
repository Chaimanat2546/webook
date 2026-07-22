import type { QuotationPayload } from "./quotation-types.ts";

export function normalizeQuotationVatChoices(
  payload: QuotationPayload,
): QuotationPayload {
  return {
    ...payload,
    items: payload.items.map((item) => {
      if (item.vatTreatment !== "taxable") {
        return { ...item, vatRate: "0", vatTreatment: "none" };
      }
      return { ...item, vatRate: Number(item.vatRate) === 0 ? "0" : "7" };
    }),
  };
}
