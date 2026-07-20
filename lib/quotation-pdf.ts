export function splitQuotationPdfWord(word: string): string[] {
  return word.length > 24 && /^[\x21-\x7e]+$/.test(word)
    ? (word.match(/.{1,12}/g) ?? [word])
    : [word];
}
