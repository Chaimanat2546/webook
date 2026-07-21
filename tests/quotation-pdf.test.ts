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

  it("lets Thai font metrics determine line height at every text size", () => {
    const pageStart = pdfSource.indexOf("page: {");
    const pageEnd = pdfSource.indexOf("row: {");
    assert.ok(pageStart >= 0 && pageEnd > pageStart);
    const pageStyle = pdfSource.slice(pageStart, pageEnd);

    assert.doesNotMatch(pageStyle, /lineHeight:/);
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

  it("keeps the approved order, paginated ledger, and five-slot certification row", () => {
    const sections = [
      "data-pdf-header",
      "data-pdf-customer",
      "data-pdf-items",
      "data-pdf-totals",
      "data-pdf-payment-methods",
      "data-pdf-notes",
      "data-pdf-certification",
    ];
    for (let index = 1; index < sections.length; index += 1) {
      assert.ok(pdfSource.indexOf(sections[index - 1]!) < pdfSource.indexOf(sections[index]!));
    }

    const certification = pdfSource.slice(
      pdfSource.indexOf("data-pdf-certification"),
      pdfSource.indexOf("style={styles.footer}"),
    );
    const signer = pdfSource.slice(
      pdfSource.indexOf("function Signer"),
      pdfSource.indexOf("function QuotationPdfDocument"),
    );

    assert.ok(certification.indexOf("data-pdf-public-qr") > -1);
    assert.match(certification, /สแกนเพื่อเปิดด้วยเว็บไซต์/);
    assert.match(certification, /ผู้ออกเอกสาร/);
    assert.match(certification, /ผู้อนุมัติเอกสาร/);
    assert.match(certification, /ตราประทับ/);
    assert.match(certification, /ผู้รับเอกสาร \(ลูกค้า\)/);
    assert.match(certification, /payload\.customer\.name/);
    assert.match(
      certification,
      /data-pdf-public-qr[\s\S]*label="ผู้ออกเอกสาร"[\s\S]*label="ผู้อนุมัติเอกสาร"[\s\S]*ตราประทับ[\s\S]*ผู้รับเอกสาร \(ลูกค้า\)/,
    );
    assert.doesNotMatch(certification, /ตำแหน่ง/);
    assert.doesNotMatch(signer, /signer\.position/);
    assert.match(pdfSource, /fixed[\s\S]*render=\{\(\{ pageNumber, totalPages \}\)/);
    assert.match(certification, /wrap=\{false\}/);
  });

  it("repeats the ledger heading in normal flow on continuation pages", () => {
    assert.match(pdfSource, /<View fixed style=\{styles\.tableHeader\} wrap=\{false\}>/);
    assert.doesNotMatch(pdfSource, /tableHeader:\s*\{[^}]*position:/);
  });

  it("allows validated long user content to wrap across pages", () => {
    const header = pdfSource.slice(pdfSource.indexOf("data-pdf-header"), pdfSource.indexOf("data-pdf-customer"));
    const customer = pdfSource.slice(pdfSource.indexOf("data-pdf-customer"), pdfSource.indexOf("data-pdf-items"));
    const items = pdfSource.slice(pdfSource.indexOf("data-pdf-items"), pdfSource.indexOf("data-pdf-totals"));
    const payment = pdfSource.slice(pdfSource.indexOf("function PaymentMethod"), pdfSource.indexOf("function Signer"));

    assert.doesNotMatch(header, /style=\{styles\.header\} wrap=\{false\}/);
    assert.doesNotMatch(customer, /style=\{styles\.customer\} wrap=\{false\}/);
    assert.doesNotMatch(items, /style=\{styles\.tableRow\} wrap=\{false\}/);
    assert.match(
      items,
      /wrap=\{!canKeepQuotationPdfItemTogether\(item\.name, item\.description\)\}/,
    );
    assert.doesNotMatch(payment, /style=\{styles\.payment\} wrap=\{false\}/);
    assert.match(payment, /style=\{styles\.paymentCore\} wrap=\{false\}/);
    assert.match(payment, /<\/View>\s*\{method\.instructions \? <Text/);
  });

  it("keeps HTML and PDF sections in the same approved order", () => {
    const html = readFileSync(
      "components/admin/quotations/quotation-document.tsx",
      "utf8",
    );
    const htmlMarkers = [
      "data-document-header",
      "data-document-customer",
      "data-document-items",
      "data-document-summary",
      "data-document-payment-methods",
      "data-document-notes",
      "data-document-certification",
    ];
    const pdfMarkers = [
      "data-pdf-header",
      "data-pdf-customer",
      "data-pdf-items",
      "data-pdf-totals",
      "data-pdf-payment-methods",
      "data-pdf-notes",
      "data-pdf-certification",
    ];

    for (const [documentSource, markers] of [
      [html, htmlMarkers],
      [pdfSource, pdfMarkers],
    ] as const) {
      let previous = -1;
      for (const marker of markers) {
        const current = documentSource.indexOf(marker);
        assert.ok(current > previous, `${marker} must follow the previous section`);
        previous = current;
      }
    }
  });

  it("shows the same fallback for an empty reference", () => {
    const html = readFileSync(
      "components/admin/quotations/quotation-document.tsx",
      "utf8",
    );

    assert.match(html, /payload\.reference \|\| "-"/);
    assert.match(
      pdfSource,
      /function Detail[\s\S]*\{value \|\| "-"\}[\s\S]*<Detail label="อ้างอิง" value=\{payload\.reference\}/,
    );
  });
});
