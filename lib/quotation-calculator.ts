export type DiscountType = "amount" | "percent" | null;
export type PriceMode = "vat_exclusive" | "vat_inclusive";
export type VatTreatment = "exempt" | "none" | "taxable";

export interface QuotationItemInput {
  description: string;
  discountType: DiscountType;
  discountValue: string;
  id: string;
  name: string;
  position: number;
  quantity: string;
  sku: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

export interface QuotationCalculationInput {
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
}

export interface QuotationLineCalculation extends QuotationItemInput {
  discountAmount: string;
  documentDiscountAllocation: string;
  grossAmount: string;
  lineTotal: string;
  taxableAmount: string;
  vatAmount: string;
}

export interface VatSummaryLine {
  taxableAmount: string;
  vatAmount: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

export interface QuotationCalculation {
  documentDiscountTotal: string;
  grandTotal: string;
  itemDiscountTotal: string;
  lines: QuotationLineCalculation[];
  subtotal: string;
  taxableTotal: string;
  vatSummary: VatSummaryLine[];
  vatTotal: string;
}

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 3;
const PERCENT_SCALE = 2;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const PERCENT_DENOMINATOR = BigInt(10_000);

function tenPow(scale: number): bigint {
  return BigInt(10) ** BigInt(scale);
}

function parseScaled(value: string, scale: number, label: string): bigint {
  const normalized = value.trim();
  if (normalized.length > 32) throw new Error(`${label} is too large`);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${label} is invalid`);
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > scale) throw new Error(`${label} has too many decimal places`);
  return BigInt(whole) * tenPow(scale) + BigInt(fraction.padEnd(scale, "0") || "0");
}

function formatScaled(value: bigint, scale: number): string {
  const divisor = tenPow(scale);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(scale, "0");
  return scale === 0 ? whole.toString() : `${whole}.${fraction}`;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= ZERO) throw new Error("Denominator must be positive");
  return (numerator + denominator / TWO) / denominator;
}

function discountAmount(type: DiscountType, value: string, base: bigint): bigint {
  if (type === null) return ZERO;
  if (type === "amount") return parseScaled(value || "0", MONEY_SCALE, "Discount");
  const rate = parseScaled(value || "0", PERCENT_SCALE, "Discount percent");
  if (rate > PERCENT_DENOMINATOR) throw new Error("Discount percent must be between 0 and 100");
  return roundDiv(base * rate, PERCENT_DENOMINATOR);
}

function allocateProportionally(total: bigint, weights: bigint[]): bigint[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, ZERO);
  if (total === ZERO) return weights.map(() => ZERO);
  if (weightTotal === ZERO) throw new Error("Cannot allocate discount across zero-value items");

  const rows = weights.map((weight, index) => {
    const product = total * weight;
    return { allocation: product / weightTotal, index, remainder: product % weightTotal };
  });
  let remaining = total - rows.reduce((sum, row) => sum + row.allocation, ZERO);
  const order = [...rows].sort((left, right) =>
    left.remainder === right.remainder ? left.index - right.index : left.remainder > right.remainder ? -1 : 1,
  );
  for (const row of order) {
    if (remaining === ZERO) break;
    rows[row.index]!.allocation += ONE;
    remaining -= ONE;
  }
  return rows.map((row) => row.allocation);
}

export function calculateQuotation(input: QuotationCalculationInput): QuotationCalculation {
  if (input.items.length === 0) throw new Error("Quotation requires at least one item");

  const prepared = input.items.map((item) => {
    const quantity = parseScaled(item.quantity, QUANTITY_SCALE, "Quantity");
    if (quantity <= ZERO) throw new Error("Quantity must be greater than zero");
    const gross = roundDiv(quantity * parseScaled(item.unitPrice, MONEY_SCALE, "Unit price"), tenPow(QUANTITY_SCALE));
    const itemDiscount = discountAmount(item.discountType, item.discountValue, gross);
    if (itemDiscount > gross) throw new Error("Discount cannot exceed item gross");
    return { afterItemDiscount: gross - itemDiscount, gross, item, itemDiscount };
  });
  const discountBase = prepared.reduce((sum, item) => sum + item.afterItemDiscount, ZERO);
  const documentDiscount = discountAmount(input.documentDiscountType, input.documentDiscountValue, discountBase);
  if (documentDiscount > discountBase) throw new Error("Document discount cannot exceed subtotal");
  const allocations = allocateProportionally(documentDiscount, prepared.map((item) => item.afterItemDiscount));
  const lines = prepared.map((preparedItem, index) => {
    const allocation = allocations[index] ?? ZERO;
    const adjusted = preparedItem.afterItemDiscount - allocation;
    const rate = preparedItem.item.vatTreatment === "taxable"
      ? parseScaled(preparedItem.item.vatRate, PERCENT_SCALE, "VAT rate") : ZERO;
    if (rate > PERCENT_DENOMINATOR) throw new Error("VAT rate must be between 0 and 100");
    let taxable = adjusted;
    let vat = ZERO;
    let total = adjusted;
    if (preparedItem.item.vatTreatment === "taxable" && rate > ZERO) {
      if (input.priceMode === "vat_exclusive") {
        vat = roundDiv(taxable * rate, PERCENT_DENOMINATOR);
        total = taxable + vat;
      } else {
        taxable = roundDiv(adjusted * PERCENT_DENOMINATOR, PERCENT_DENOMINATOR + rate);
        vat = adjusted - taxable;
      }
    }
    return {
      ...preparedItem.item,
      discountAmount: formatScaled(preparedItem.itemDiscount, MONEY_SCALE),
      documentDiscountAllocation: formatScaled(allocation, MONEY_SCALE),
      grossAmount: formatScaled(preparedItem.gross, MONEY_SCALE),
      lineTotal: formatScaled(total, MONEY_SCALE),
      taxableAmount: formatScaled(taxable, MONEY_SCALE),
      vatAmount: formatScaled(vat, MONEY_SCALE),
    };
  });
  const sum = (field: "discountAmount" | "grossAmount" | "lineTotal" | "taxableAmount" | "vatAmount") =>
    lines.reduce((total, line) => total + parseScaled(line[field], MONEY_SCALE, field), ZERO);
  const vatGroups = new Map<string, { taxableAmount: bigint; vatAmount: bigint; vatRate: string; vatTreatment: VatTreatment }>();
  for (const line of lines) {
    const key = `${line.vatTreatment}:${line.vatRate}`;
    const current = vatGroups.get(key) ?? { taxableAmount: ZERO, vatAmount: ZERO, vatRate: line.vatRate, vatTreatment: line.vatTreatment };
    current.taxableAmount += parseScaled(line.taxableAmount, MONEY_SCALE, "Taxable amount");
    current.vatAmount += parseScaled(line.vatAmount, MONEY_SCALE, "VAT amount");
    vatGroups.set(key, current);
  }
  return {
    documentDiscountTotal: formatScaled(documentDiscount, MONEY_SCALE),
    grandTotal: formatScaled(sum("lineTotal"), MONEY_SCALE),
    itemDiscountTotal: formatScaled(sum("discountAmount"), MONEY_SCALE),
    lines,
    subtotal: formatScaled(sum("grossAmount"), MONEY_SCALE),
    taxableTotal: formatScaled(sum("taxableAmount"), MONEY_SCALE),
    vatSummary: [...vatGroups.values()].map((row) => ({
      taxableAmount: formatScaled(row.taxableAmount, MONEY_SCALE),
      vatAmount: formatScaled(row.vatAmount, MONEY_SCALE),
      vatRate: row.vatRate,
      vatTreatment: row.vatTreatment,
    })),
    vatTotal: formatScaled(sum("vatAmount"), MONEY_SCALE),
  };
}

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readThaiSixDigits(value: string): string {
  const padded = value.padStart(6, "0");
  let output = "";
  for (let index = 0; index < padded.length; index += 1) {
    const digit = Number(padded[index]);
    if (digit === 0) continue;
    const position = padded.length - index - 1;
    if (position === 1 && digit === 1) output += "";
    else if (position === 1 && digit === 2) output += "ยี่";
    else if (position === 0 && digit === 1 && Number(value) > 10) output += "เอ็ด";
    else output += THAI_DIGITS[digit];
    output += THAI_POSITIONS[position];
  }
  return output;
}

function readThaiInteger(value: string): string {
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (normalized === "0") return THAI_DIGITS[0]!;
  if (normalized.length <= 6) return readThaiSixDigits(normalized);
  const head = normalized.slice(0, -6);
  const tail = normalized.slice(-6);
  return `${readThaiInteger(head)}ล้าน${Number(tail) === 0 ? "" : readThaiSixDigits(tail)}`;
}

export function formatThaiBahtText(value: string): string {
  const cents = parseScaled(value, MONEY_SCALE, "Amount");
  const bahtText = `${readThaiInteger((cents / BigInt(100)).toString())}บาท`;
  const satang = cents % BigInt(100);
  return satang === ZERO ? `${bahtText}ถ้วน` : `${bahtText}${readThaiInteger(satang.toString())}สตางค์`;
}
