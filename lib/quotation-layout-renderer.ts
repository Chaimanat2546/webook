import type { CSSProperties } from "react";

import { quotationLayoutBlockRow, quotationLayoutBlockRowSpan, type QuotationLayoutBlockId } from "./quotation-layout";
import type { QuotationDocumentViewModel } from "./quotation-document-view";

export function quotationLayoutBlockStyle(
  model: QuotationDocumentViewModel,
  id: QuotationLayoutBlockId,
): CSSProperties {
  const block = model.payload.layout.config.blocks.find((item) => item.id === id);
  if (!block) return {};
  return {
    gridColumn: `${block.column} / span ${block.span}`,
    gridRow: `${quotationLayoutBlockRow(model.payload.layout.config, id)} / span ${quotationLayoutBlockRowSpan(model.payload.template, id)}`,
  };
}
