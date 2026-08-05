import type { CSSProperties } from "react";

import { quotationLayoutBlockRow, quotationLayoutBlockRowSpan, type QuotationLayoutBlockId } from "./quotation-layout";
import type { QuotationDocumentViewModel } from "./quotation-document-view";

export function quotationLayoutBlockStyle(
  model: QuotationDocumentViewModel,
  id: QuotationLayoutBlockId,
): CSSProperties {
  const block = model.payload.layout.config.blocks.find((item) => item.id === id);
  if (!block) return {};
  const summary = model.payload.layout.config.blocks.find((item) => item.id === "summary");
  const paymentMethods = model.payload.layout.config.blocks.find((item) => item.id === "paymentMethods");
  const isExpandedSettlement = model.payload.template !== "current"
    && (id === "summary" || id === "paymentMethods" || id === "publicNotes")
    && summary
    && paymentMethods;
  const summaryIsLeft = isExpandedSettlement && summary.column < paymentMethods.column;
  const gridColumn = isExpandedSettlement
    ? id === "summary"
      ? `${summaryIsLeft ? 1 : 8} / span 5`
      : `${summaryIsLeft ? 6 : 1} / span 7`
    : `${block.column} / span ${block.span}`;
  return {
    gridColumn,
    gridRow: `${quotationLayoutBlockRow(model.payload.layout.config, id)} / span ${quotationLayoutBlockRowSpan(model.payload.template, id)}`,
  };
}
