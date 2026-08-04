import { CurrentQuotationDocument } from "./quotation-document-current";
import type { QuotationDocumentRendererProps } from "./quotation-document-contract";

export function CorporateQuotationDocument(props: QuotationDocumentRendererProps) {
  return <CurrentQuotationDocument {...props} />;
}
