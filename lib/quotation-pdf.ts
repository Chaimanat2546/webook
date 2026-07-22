export function splitQuotationPdfWord(word: string): string[] {
  if (/[\u0E00-\u0E7F]/u.test(word)) {
    return [`${word.replace(/\u200b+$/u, "")}\u200b\u200b`];
  }

  return word.length > 24 && /^[\x21-\x7e]+$/.test(word)
    ? (word.match(/.{1,12}/g) ?? [word])
    : [word];
}

const PDF_ITEM_ESTIMATED_CHARS_PER_LINE = 48;
const PDF_UNBREAKABLE_ITEM_LINE_LIMIT = 12;

export function canKeepQuotationPdfItemTogether(
  name: string,
  description: string,
): boolean {
  // ponytail: estimated lines avoid oversized unbreakable rows; replace with
  // measured layout only if real PDF fixtures show this approximation is wrong.
  const text = [name, description].filter(Boolean).join("\n");
  const estimatedLines = text.split(/\r?\n/u).reduce(
    (total, line) =>
      total +
      Math.max(
        1,
        Math.ceil(line.length / PDF_ITEM_ESTIMATED_CHARS_PER_LINE),
      ),
    0,
  );
  return estimatedLines <= PDF_UNBREAKABLE_ITEM_LINE_LIMIT;
}
