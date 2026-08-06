import type { CSSProperties } from "react";

import { quotationLayoutBlockRow, quotationLayoutBlockRowSpan, quotationLayoutZonePosition, type QuotationLayoutBlockId } from "./quotation-layout";
import type { QuotationDocumentViewModel } from "./quotation-document-view";
import { quotationThemePalette } from "./quotation-theme.ts";

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

/** Returns whether one configured block is visually placed before another. */
export function isQuotationLayoutBlockBefore(
  model: QuotationDocumentViewModel,
  leftId: QuotationLayoutBlockId,
  rightId: QuotationLayoutBlockId,
): boolean {
  const left = model.payload.layout.config.blocks.find((item) => item.id === leftId);
  const right = model.payload.layout.config.blocks.find((item) => item.id === rightId);
  if (!left || !right) return false;

  const leftRow = quotationLayoutBlockRow(model.payload.layout.config, leftId);
  const rightRow = quotationLayoutBlockRow(model.payload.layout.config, rightId);
  return leftRow === rightRow ? left.column < right.column : leftRow < rightRow;
}

export function quotationLayoutDocumentStyle(model: QuotationDocumentViewModel): CSSProperties {
  const theme = quotationThemePalette(model.payload.layout.config.themeColor);
  return {
    "--quotation-theme-border": theme.border,
    "--quotation-theme-contrast": theme.contrast,
    "--quotation-theme-dark": theme.dark,
    "--quotation-theme-light": theme.light,
    "--quotation-theme-muted": theme.muted,
    "--quotation-theme-primary": theme.primary,
    "--quotation-zone-body": quotationLayoutZonePosition(model.payload.layout.config, "body"),
    "--quotation-zone-certification": quotationLayoutZonePosition(model.payload.layout.config, "certification"),
    "--quotation-zone-header": quotationLayoutZonePosition(model.payload.layout.config, "header"),
    "--quotation-zone-settlement": quotationLayoutZonePosition(model.payload.layout.config, "settlement"),
  } as CSSProperties;
}
