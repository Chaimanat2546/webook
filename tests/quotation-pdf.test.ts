import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8") : "";

const pdfSource = source("components/admin/quotations/quotation-pdf.tsx");
const editorSource = source("components/admin/quotations/quotation-editor.tsx");

describe("quotation PDF", () => {
  it("uses the approved PDF renderer, shared model, Thai fonts, and A4", () => {
    assert.match(pdfSource, /@react-pdf\/renderer/);
    assert.match(pdfSource, /buildQuotationDocumentViewModel/);
    assert.match(pdfSource, /NotoSansThai-Regular\.ttf/);
    assert.match(pdfSource, /NotoSansThai-SemiBold\.ttf/);
    assert.match(pdfSource, /registerHyphenationCallback/);
    assert.match(pdfSource, /size="A4"/);
    assert.match(pdfSource, /wrap/);
  });

  it("collects and deduplicates every supported document image", () => {
    assert.match(pdfSource, /export function collectQuotationPdfImageSources/);
    assert.match(pdfSource, /seller\.logoUrl/);
    assert.match(pdfSource, /customBankLogoUrl \|\| method\.bankLogoUrl/);
    assert.match(pdfSource, /method\.qrSource/);
    assert.match(pdfSource, /issuer\.signatureUrl/);
    assert.match(pdfSource, /approver\.signatureUrl/);
    assert.match(pdfSource, /companyStampUrl/);
    assert.match(pdfSource, /publicQrDataUrl/);
    assert.match(pdfSource, /new Set/);
  });

  it("downloads only through a lazy import and exact document filename", () => {
    assert.match(editorSource, /import\("\.\/quotation-pdf"\)/);
    assert.match(pdfSource, /`\$\{documentNumber\}\.pdf`/);
    assert.match(editorSource, /กำลังสร้าง PDF/);
    assert.match(editorSource, /บันทึกการเปลี่ยนแปลงก่อน/);
  });

  it("converts browser images to contained PNGs with per-image fallback", () => {
    assert.match(pdfSource, /fetch\(source\)/);
    assert.match(pdfSource, /canvas\.toDataURL\("image\/png"\)/);
    assert.match(pdfSource, /objectFit:\s*"contain"/);
    assert.match(pdfSource, /URL\.revokeObjectURL/);
    assert.match(pdfSource, /catch/);
  });

  it("fails the download instead of omitting the required Public QR", () => {
    assert.match(pdfSource, /if \(!images\[model\.publicQrDataUrl\]\) throw new Error\("Public QR image is unavailable"\)/);
  });

  it("keeps the approved order, paginated ledger, and certification section", () => {
    const sections = [
      "data-pdf-header",
      "data-pdf-customer",
      "data-pdf-items",
      "data-pdf-totals",
      "data-pdf-payment-methods",
      "data-pdf-notes",
      "data-pdf-public-qr",
      "data-pdf-certification",
    ];
    for (let index = 1; index < sections.length; index += 1) {
      assert.ok(pdfSource.indexOf(sections[index - 1]!) < pdfSource.indexOf(sections[index]!));
    }
    assert.match(pdfSource, /fixed[\s\S]*render=\{\(\{ pageNumber, totalPages \}\)/);
    assert.match(pdfSource, /wrap=\{false\}/);
    assert.match(pdfSource, /ผู้รับเอกสาร/);
  });
});
