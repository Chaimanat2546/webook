import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { splitQuotationPdfWord } from "../lib/quotation-pdf.ts";

describe("quotation PDF helpers", () => {
  it("provides dependency-free helpers that Node can execute", () => {
    assert.equal(existsSync("lib/quotation-pdf.ts"), true);
  });

  it("splits only long unbroken ASCII and URL-like words", () => {
    for (const word of [
      "SUPERCALIFRAGILISTICEXPIALIDOCIOUSWITHOUTBREAKS",
      "https://example.test/quotation/THISISALONGUNBROKENPATH",
    ]) {
      const parts = splitQuotationPdfWord(word);
      assert.ok(parts.length > 1);
      assert.ok(parts.every((part) => part.length <= 12));
      assert.equal(parts.join(""), word);
    }
  });

  it("leaves Thai and combining grapheme sequences untouched", () => {
    const thai = "ข้อความภาษาไทยที่ยาวต่อเนื่องและต้องไม่ถูกแบ่งกลางเครื่องหมาย";
    const combining = "e\u0301".repeat(20);

    assert.deepEqual(splitQuotationPdfWord(thai), [thai]);
    assert.deepEqual(splitQuotationPdfWord(combining), [combining]);
  });

  it("registers the Unicode-safe helper as the renderer callback", () => {
    const source = readFileSync("components/admin/quotations/quotation-pdf.tsx", "utf8");
    assert.match(source, /registerHyphenationCallback\(splitQuotationPdfWord\)/);
  });
});
