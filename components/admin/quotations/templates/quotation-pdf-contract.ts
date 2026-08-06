import type { QuotationDocumentViewModel } from "../../../../lib/quotation-document-view";

export type ResolvedImages = Record<string, string>;

export interface QuotationPdfRendererProps {
  images: ResolvedImages;
  model: QuotationDocumentViewModel;
}
