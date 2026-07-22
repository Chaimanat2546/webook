const MONEY_INPUT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/;

export function normalizeMoneyInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!MONEY_INPUT.test(trimmed)) return null;
  return trimmed.replaceAll(",", "");
}

export function formatMoney(value: string): string {
  const normalized = normalizeMoneyInput(value);
  if (normalized === null || normalized === "") return value;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${fraction.padEnd(2, "0")}`;
}

export function formatBaht(value: string): string {
  return `${formatMoney(value)} บาท`;
}
