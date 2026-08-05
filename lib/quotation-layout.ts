import type { QuotationTemplate } from "./quotation-template";

export const QUOTATION_LAYOUT_SCHEMA_VERSION = 1;

export const QUOTATION_LAYOUT_BLOCK_IDS = [
  "seller",
  "documentMetadata",
  "customer",
  "items",
  "summary",
  "paymentMethods",
  "publicNotes",
  "certification",
  "sellerFooter",
] as const;

export const QUOTATION_LAYOUT_ZONES = [
  "header",
  "body",
  "settlement",
  "footer",
  "certification",
] as const;

export type QuotationLayoutBlockId = (typeof QUOTATION_LAYOUT_BLOCK_IDS)[number];
export type QuotationLayoutZone = (typeof QUOTATION_LAYOUT_ZONES)[number];

export interface QuotationLayoutBlock {
  column: number;
  id: QuotationLayoutBlockId;
  order: number;
  span: number;
  zone: QuotationLayoutZone;
}

export interface QuotationLayoutConfig {
  blocks: QuotationLayoutBlock[];
  schemaVersion: typeof QUOTATION_LAYOUT_SCHEMA_VERSION;
}

export interface QuotationLayoutSnapshot {
  config: QuotationLayoutConfig;
  revisionNumber: number;
  schemaVersion: number;
  sourceId: string;
}

interface BlockRule {
  spans: readonly number[];
  zones: readonly QuotationLayoutZone[];
}

const BLOCK_RULES: Record<QuotationLayoutBlockId, BlockRule> = {
  certification: { spans: [12], zones: ["certification"] },
  customer: { spans: [12], zones: ["body"] },
  documentMetadata: { spans: [4, 5, 6, 7, 8, 12], zones: ["header"] },
  items: { spans: [12], zones: ["body"] },
  paymentMethods: { spans: [4, 5, 6, 7, 8, 12], zones: ["settlement"] },
  publicNotes: { spans: [4, 5, 6, 7, 8, 12], zones: ["settlement"] },
  seller: { spans: [4, 5, 6, 7, 8, 12], zones: ["header"] },
  sellerFooter: { spans: [12], zones: ["footer"] },
  summary: { spans: [4, 5, 6, 7, 8, 12], zones: ["settlement"] },
};

const BLOCKS_BY_TEMPLATE: Record<QuotationTemplate, readonly QuotationLayoutBlockId[]> = {
  corporate: ["seller", "documentMetadata", "customer", "items", "summary", "paymentMethods", "publicNotes", "certification"],
  current: ["seller", "documentMetadata", "customer", "items", "summary", "paymentMethods", "publicNotes", "certification"],
  hospitality: ["seller", "documentMetadata", "customer", "items", "summary", "paymentMethods", "publicNotes", "certification", "sellerFooter"],
};

const canonical: Record<QuotationTemplate, QuotationLayoutConfig> = {
  corporate: {
    blocks: [
      { id: "seller", zone: "header", column: 1, order: 10, span: 6 },
      { id: "documentMetadata", zone: "header", column: 7, order: 10, span: 6 },
      { id: "customer", zone: "body", column: 1, order: 10, span: 12 },
      { id: "items", zone: "body", column: 1, order: 20, span: 12 },
      { id: "paymentMethods", zone: "settlement", column: 1, order: 10, span: 7 },
      { id: "summary", zone: "settlement", column: 8, order: 10, span: 5 },
      { id: "publicNotes", zone: "settlement", column: 1, order: 20, span: 7 },
      { id: "certification", zone: "certification", column: 1, order: 10, span: 12 },
    ],
    schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION,
  },
  current: {
    blocks: [
      { id: "seller", zone: "header", column: 1, order: 10, span: 7 },
      { id: "documentMetadata", zone: "header", column: 8, order: 10, span: 5 },
      { id: "customer", zone: "body", column: 1, order: 10, span: 12 },
      { id: "items", zone: "body", column: 1, order: 20, span: 12 },
      { id: "paymentMethods", zone: "settlement", column: 1, order: 10, span: 8 },
      { id: "summary", zone: "settlement", column: 9, order: 10, span: 4 },
      { id: "publicNotes", zone: "settlement", column: 1, order: 20, span: 8 },
      { id: "certification", zone: "certification", column: 1, order: 10, span: 12 },
    ],
    schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION,
  },
  hospitality: {
    blocks: [
      { id: "seller", zone: "header", column: 1, order: 10, span: 7 },
      { id: "documentMetadata", zone: "header", column: 8, order: 10, span: 5 },
      { id: "customer", zone: "body", column: 1, order: 10, span: 12 },
      { id: "items", zone: "body", column: 1, order: 20, span: 12 },
      { id: "paymentMethods", zone: "settlement", column: 1, order: 10, span: 7 },
      { id: "summary", zone: "settlement", column: 8, order: 10, span: 5 },
      { id: "publicNotes", zone: "settlement", column: 1, order: 20, span: 7 },
      { id: "certification", zone: "certification", column: 1, order: 10, span: 12 },
      { id: "sellerFooter", zone: "footer", column: 1, order: 10, span: 12 },
    ],
    schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBlockId(value: unknown): value is QuotationLayoutBlockId {
  return typeof value === "string" && QUOTATION_LAYOUT_BLOCK_IDS.includes(value as QuotationLayoutBlockId);
}

function isZone(value: unknown): value is QuotationLayoutZone {
  return typeof value === "string" && QUOTATION_LAYOUT_ZONES.includes(value as QuotationLayoutZone);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isBlock(value: unknown, template: QuotationTemplate): value is QuotationLayoutBlock {
  if (!isRecord(value) || Object.keys(value).length !== 5) return false;
  const { column, id, order, span, zone } = value;
  if (!isBlockId(id) || !isZone(zone) || !isPositiveInteger(column) || !isPositiveInteger(order) || !isPositiveInteger(span)) return false;
  if (!BLOCKS_BY_TEMPLATE[template].includes(id)) return false;
  if (column > 12 || span > 12 || column + span - 1 > 12 || order > 1_000 || order % 10 !== 0) return false;
  const rule = BLOCK_RULES[id];
  return rule.zones.includes(zone) && rule.spans.includes(span);
}

export function isQuotationLayoutConfig(value: unknown, template: QuotationTemplate): value is QuotationLayoutConfig {
  if (!isRecord(value) || Object.keys(value).length !== 2 || value.schemaVersion !== QUOTATION_LAYOUT_SCHEMA_VERSION || !Array.isArray(value.blocks)) return false;
  const blocks = value.blocks;
  if (blocks.length !== BLOCKS_BY_TEMPLATE[template].length || !blocks.every((block) => isBlock(block, template))) return false;
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) return false;
  if (!BLOCKS_BY_TEMPLATE[template].every((id) => blocks.some((block) => block.id === id))) return false;

  for (const block of blocks) {
    for (const other of blocks) {
      if (block === other || block.zone !== other.zone || block.order !== other.order) continue;
      const blockEnd = block.column + block.span - 1;
      const otherEnd = other.column + other.span - 1;
      if (block.column <= otherEnd && other.column <= blockEnd) return false;
    }
  }
  return true;
}

export function canonicalQuotationLayout(template: QuotationTemplate): QuotationLayoutConfig {
  return structuredClone(canonical[template]);
}

export function normalizeQuotationLayout(value: unknown, template: QuotationTemplate): QuotationLayoutConfig {
  return isQuotationLayoutConfig(value, template)
    ? structuredClone(value)
    : canonicalQuotationLayout(template);
}

/**
 * Resolves the visual grid row without preserving empty space between blocks.
 * A row is shared whenever its blocks occupy different columns. This makes a
 * two-column header/settlement remain compact even after a drag has changed
 * the linear sort order of its blocks.
 */
export function quotationLayoutBlockRow(config: QuotationLayoutConfig, id: QuotationLayoutBlockId): number {
  const target = config.blocks.find((block) => block.id === id);
  if (!target) return 1;

  const rows: QuotationLayoutBlock[][] = [];
  const blocks = config.blocks
    .filter((block) => block.zone === target.zone)
    .sort((left, right) => left.order - right.order || left.column - right.column);

  for (const block of blocks) {
    const rowIndex = rows.findIndex((row) => row.every((placed) => {
      const blockEnd = block.column + block.span - 1;
      const placedEnd = placed.column + placed.span - 1;
      return blockEnd < placed.column || placedEnd < block.column;
    }));
    const row = rowIndex === -1 ? (rows.push([]) - 1) : rowIndex;
    rows[row]?.push(block);
    if (block.id === id) return row + 1;
  }

  return 1;
}

const MOVABLE_ZONE_DEFAULT_ORDER: readonly QuotationLayoutZone[] = [
  "header",
  "body",
  "settlement",
  "certification",
];

/** Resolves document-section order from the saved block orders. The Hospitality footer stays fixed. */
export function quotationLayoutZonesInDocumentOrder(config: QuotationLayoutConfig): QuotationLayoutZone[] {
  return [...MOVABLE_ZONE_DEFAULT_ORDER].sort((left, right) => {
    const leftOrder = Math.min(...config.blocks.filter((block) => block.zone === left).map((block) => block.order));
    const rightOrder = Math.min(...config.blocks.filter((block) => block.zone === right).map((block) => block.order));
    return leftOrder - rightOrder || MOVABLE_ZONE_DEFAULT_ORDER.indexOf(left) - MOVABLE_ZONE_DEFAULT_ORDER.indexOf(right);
  });
}

export function quotationLayoutZonePosition(config: QuotationLayoutConfig, zone: QuotationLayoutZone): number {
  if (zone === "footer") return MOVABLE_ZONE_DEFAULT_ORDER.length;
  return quotationLayoutZonesInDocumentOrder(config).indexOf(zone);
}

/** Fixed visual height rules owned by the document template, not editable layout data. */
export function quotationLayoutBlockRowSpan(template: QuotationTemplate, id: QuotationLayoutBlockId): number {
  return id === "summary" ? 2 : 1;
}

export function canonicalQuotationLayoutSnapshot(template: QuotationTemplate): QuotationLayoutSnapshot {
  return {
    config: canonicalQuotationLayout(template),
    revisionNumber: 1,
    schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION,
    sourceId: "",
  };
}
