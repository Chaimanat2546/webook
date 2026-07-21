export function splitQuotationPdfWord(word: string): string[] {
  if (/[\u0E00-\u0E7F]/u.test(word)) {
    return [`${word.replace(/\u200b+$/u, "")}\u200b\u200b`];
  }

  return word.length > 24 && /^[\x21-\x7e]+$/.test(word)
    ? (word.match(/.{1,12}/g) ?? [word])
    : [word];
}
