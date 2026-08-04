import type { QuotationPdfRendererProps } from "./quotation-pdf-contract";
import { CurrentQuotationPdf } from "./quotation-pdf-current";

export function HospitalityQuotationPdf(props: QuotationPdfRendererProps) {
  return <CurrentQuotationPdf {...props} />;
}
