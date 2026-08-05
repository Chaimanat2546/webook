import type { CSSProperties } from "react";

import type { QuotationLayoutBlockId } from "./quotation-layout";
import type { QuotationDocumentViewModel } from "./quotation-document-view";

export function quotationLayoutBlockStyle(
  model: QuotationDocumentViewModel,
  id: QuotationLayoutBlockId,
): CSSProperties {
  const block = model.payload.layout.config.blocks.find((item) => item.id === id);
  if (!block) return {};
  return {
    gridColumn: `${block.column} / span ${block.span}`,
    order: block.order,
  };
}

export function quotationLayoutOrder(
  model: QuotationDocumentViewModel,
  id: QuotationLayoutBlockId,
): number {
  return model.payload.layout.config.blocks.find((item) => item.id === id)?.order ?? 0;
}
