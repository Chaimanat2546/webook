export type VatTreatment = "exempt" | "none" | "taxable";

export interface QuotationItemInput {
  description: string;
  discountAmount: string;
  id: string;
  name: string;
  position: number;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

export interface QuotationCalculationInput {
  items: QuotationItemInput[];
  withholdingTaxRate: string | null;
}

export interface QuotationLineCalculation extends QuotationItemInput {
  grossAmount: string;
  lineTotal: string;
  preTaxAmount: string;
  vatAmount: string;
}

export interface QuotationCalculation {
  amountDue: string;
  discountTotal: string;
  grandTotal: string;
  grossTotal: string;
  lines: QuotationLineCalculation[];
  preTaxTotal: string;
  vatTotal: string;
  withholdingTaxTotal: string;
}

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 3;
const PERCENT_SCALE = 2;
const ZERO = BigInt(0);
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

export function calculateQuotation(
  input: QuotationCalculationInput,
): QuotationCalculation {
  if (input.items.length === 0) throw new Error("Quotation requires at least one item");
  const withholdingRate = input.withholdingTaxRate === null
    ? ZERO
    : parseScaled(input.withholdingTaxRate, PERCENT_SCALE, "Withholding tax rate");
  if (withholdingRate > PERCENT_DENOMINATOR) {
    throw new Error("Withholding tax rate must be between 0 and 100");
  }

  const lines = input.items.map((item, index) => {
    const quantity = parseScaled(item.quantity, QUANTITY_SCALE, "Quantity");
    if (quantity <= ZERO) throw new Error("Quantity must be greater than zero");
    const gross = roundDiv(
      quantity * parseScaled(item.unitPrice, MONEY_SCALE, "Unit price"),
      tenPow(QUANTITY_SCALE),
    );
    const discount = parseScaled(item.discountAmount || "0", MONEY_SCALE, "Discount");
    if (discount > gross) {
      throw new Error(`Discount cannot exceed item gross for item ${index + 1}`);
    }
    const preTax = gross - discount;
    const rate = item.vatTreatment === "taxable"
      ? parseScaled(item.vatRate, PERCENT_SCALE, "VAT rate")
      : ZERO;
    if (rate > PERCENT_DENOMINATOR) throw new Error("VAT rate must be between 0 and 100");
    const vat = item.vatTreatment === "taxable"
      ? roundDiv(preTax * rate, PERCENT_DENOMINATOR)
      : ZERO;
    return {
      ...item,
      grossAmount: formatScaled(gross, MONEY_SCALE),
      lineTotal: formatScaled(preTax + vat, MONEY_SCALE),
      preTaxAmount: formatScaled(preTax, MONEY_SCALE),
      vatAmount: formatScaled(vat, MONEY_SCALE),
    };
  });

  const sum = (field: "discountAmount" | "grossAmount" | "lineTotal" | "preTaxAmount" | "vatAmount") =>
    lines.reduce(
      (total, line) => total + parseScaled(line[field], MONEY_SCALE, field),
      ZERO,
    );
  const grossTotal = sum("grossAmount");
  const discountTotal = sum("discountAmount");
  const preTaxTotal = sum("preTaxAmount");
  const vatTotal = sum("vatAmount");
  const grandTotal = sum("lineTotal");
  const withholdingTax = roundDiv(preTaxTotal * withholdingRate, PERCENT_DENOMINATOR);
  return {
    amountDue: formatScaled(grandTotal - withholdingTax, MONEY_SCALE),
    discountTotal: formatScaled(discountTotal, MONEY_SCALE),
    grandTotal: formatScaled(grandTotal, MONEY_SCALE),
    grossTotal: formatScaled(grossTotal, MONEY_SCALE),
    lines,
    preTaxTotal: formatScaled(preTaxTotal, MONEY_SCALE),
    vatTotal: formatScaled(vatTotal, MONEY_SCALE),
    withholdingTaxTotal: formatScaled(withholdingTax, MONEY_SCALE),
  };
}

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readThaiSixDigits(value: string): string {
  const padded = value.padStart(6, "0");
  let output = "";
  for (let index = 0; index < padded.length; index += 1) {
    const digit = padded[index]!;
    if (digit === "0") continue;
    const position = padded.length - index - 1;
    if (position === 1 && digit === "1") output += "";
    else if (position === 1 && digit === "2") output += "ยี่";
    else if (position === 0 && digit === "1" && BigInt(value) > BigInt(10)) output += "เอ็ด";
    else output += THAI_DIGITS["0123456789".indexOf(digit)]!;
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
  return `${readThaiInteger(head)}ล้าน${BigInt(tail) === ZERO ? "" : readThaiSixDigits(tail)}`;
}

export function formatThaiBahtText(value: string): string {
  const cents = parseScaled(value, MONEY_SCALE, "Amount");
  const bahtText = `${readThaiInteger((cents / BigInt(100)).toString())}บาท`;
  const satang = cents % BigInt(100);
  return satang === ZERO ? `${bahtText}ถ้วน` : `${bahtText}${readThaiInteger(satang.toString())}สตางค์`;
}
