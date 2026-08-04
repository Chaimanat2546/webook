import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);

const source = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8") : "";

const pdfSource = source("components/admin/quotations/quotation-pdf.tsx");
const currentPdf = source(
  "components/admin/quotations/templates/quotation-pdf-current.tsx",
);
const sharedPdf = source(
  "components/admin/quotations/templates/quotation-pdf-shared.tsx",
);
const hospitalityPdf = source(
  "components/admin/quotations/templates/quotation-pdf-hospitality.tsx",
);
const corporatePdf = source(
  "components/admin/quotations/templates/quotation-pdf-corporate.tsx",
);
const editorSource = source("components/admin/quotations/quotation-editor.tsx");

describe("quotation PDF", () => {
  it("keeps every PDF template on the shared public-document contract", () => {
    for (const template of [currentPdf, hospitalityPdf, corporatePdf]) {
      for (const marker of [
        "data-pdf-header",
        "data-pdf-customer",
        "data-pdf-items",
        "data-pdf-totals",
        "data-pdf-payment-methods",
        "data-pdf-notes",
        "data-pdf-certification",
        "payload.seller",
        "model.documentNumber",
        "payload.seller.name",
        "payload.seller.address",
        "payload.seller.taxId",
        "model.issueDate",
        "model.validUntil",
        "payload.customer.name",
        "payload.customer.address",
        "calculation.lines.map",
        "calculation.grandTotal",
        "model.paymentMethods.map",
        "payload.publicNotes",
        "model.certification",
      ]) {
        assert.match(template, new RegExp(marker));
      }
      assert.doesNotMatch(template, /internalNotes/);
      assert.doesNotMatch(template, /calculateQuotation|document_template_default|accountTemplateDefault/);
    }
  });

  it("renders Corporate with its own navy PDF layout", () => {
    for (const marker of [
      "CorporateQuotationPdf",
      "#142d4c",
      "#f2f5f8",
      "data-pdf-header",
      "data-pdf-customer",
      "data-pdf-items",
      "data-pdf-totals",
      "data-pdf-payment-methods",
      "data-pdf-notes",
      "data-pdf-certification",
      "data-corporate-settlement",
      "มูลค่ารวม",
      "ส่วนลด",
    ]) {
      assert.match(corporatePdf, new RegExp(marker));
    }
    assert.doesNotMatch(corporatePdf, /CurrentQuotationPdf/);
    assert.match(pdfSource, /quotation-pdf-corporate/);
  });

  it("renders Hospitality with its own green PDF layout", () => {
    for (const marker of [
      "HospitalityQuotationPdf",
      "#286a5b",
      "#c79b58",
      "data-pdf-header",
      "data-pdf-items",
      "data-pdf-totals",
      "data-pdf-payment-methods",
      "data-pdf-notes",
      "data-pdf-certification",
      "มูลค่ารวม",
      "ส่วนลด",
    ]) {
      assert.match(hospitalityPdf, new RegExp(marker));
    }
    assert.doesNotMatch(hospitalityPdf, /CurrentQuotationPdf/);
    assert.match(pdfSource, /quotation-pdf-hospitality/);
  });

  it("uses the approved PDF renderer, shared model, Thai fonts, and A4", () => {
    assert.match(pdfSource, /@react-pdf\/renderer/);
    assert.match(pdfSource, /buildQuotationDocumentViewModel/);
    assert.match(pdfSource, /NotoSansThai-Regular\.ttf/);
    assert.match(pdfSource, /NotoSansThai-SemiBold\.ttf/);
    assert.match(pdfSource, /registerHyphenationCallback/);
    assert.match(currentPdf, /size="A4"/);
    assert.match(currentPdf, /wrap/);
  });

  it("dispatches the resolved model to every fixed template renderer", () => {
    assert.match(pdfSource, /model\.payload\.template/);
    assert.match(pdfSource, /CurrentQuotationPdf/);
    assert.match(pdfSource, /HospitalityQuotationPdf/);
    assert.match(pdfSource, /CorporateQuotationPdf/);
  });

  it("keeps the Current document's required semantic sections", () => {
    assert.match(currentPdf, /data-pdf-header/);
    assert.match(currentPdf, /data-pdf-items/);
    assert.match(currentPdf, /data-pdf-totals/);
    assert.match(currentPdf, /data-pdf-certification/);
  });

  it("embeds fonts that cover both Latin values and Thai labels", () => {
    const fontkit = require("fontkit") as {
      openSync(path: string): {
        hasGlyphForCodePoint(codePoint: number): boolean;
      };
    };
    const requiredCharacters =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.-/%(): คืน";

    for (const path of [
      "public/fonts/NotoSansThai-Regular.ttf",
      "public/fonts/NotoSansThai-SemiBold.ttf",
    ]) {
      const font = fontkit.openSync(path);
      for (const character of requiredCharacters) {
        assert.equal(
          font.hasGlyphForCodePoint(character.codePointAt(0)!),
          true,
          `${path} must contain ${JSON.stringify(character)}`,
        );
      }
    }
  });

  it("lets Thai font metrics determine line height at every text size", () => {
    const pageStart = currentPdf.indexOf("page: {");
    const pageEnd = currentPdf.indexOf("row: {");
    assert.ok(pageStart >= 0 && pageEnd > pageStart);
    const pageStyle = currentPdf.slice(pageStart, pageEnd);

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
    assert.match(currentPdf, /objectFit:\s*"contain"/);
    assert.match(pdfSource, /URL\.revokeObjectURL/);
    assert.match(pdfSource, /catch/);
  });

  it("requires Public QR only when its certification setting is enabled", () => {
    assert.match(pdfSource, /if \(model\.showCertificationQr && !images\[model\.publicQrDataUrl\]\) throw new Error\("Public QR image is unavailable"\)/);
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
      assert.ok(currentPdf.indexOf(sections[index - 1]!) < currentPdf.indexOf(sections[index]!));
    }

    const certification = currentPdf.slice(
      currentPdf.indexOf("data-pdf-certification"),
      currentPdf.indexOf("</Page>", currentPdf.indexOf("data-pdf-certification")),
    );
    const signer = sharedPdf;

    assert.ok(certification.indexOf("data-pdf-public-qr") > -1);
    assert.match(
      certification,
      /\{model\.showCertificationQr \? \([\s\S]*data-pdf-public-qr[\s\S]*\) : null\}/,
    );
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
    assert.doesNotMatch(currentPdf, /pageNumber|totalPages|styles\.footer/);
    assert.match(certification, /wrap=\{false\}/);
    assert.match(
      currentPdf,
      /const compactCertification = !model\.showCertificationName && !model\.showCertificationDate/,
    );
    assert.match(currentPdf, /certificationAssetBoxCompact: \{ height: 36 \}/);
    assert.match(currentPdf, /signatureBoxCompact: \{ height: 36 \}/);
    assert.match(currentPdf, /certificationImageCompact: \{ height: 32 \}/);
    assert.equal(
      certification.match(/compact=\{compactCertification\}/g)?.length,
      2,
    );
    assert.match(
      certification,
      /compactCertification\s*\?\s*\[styles\.certificationAssetBox, styles\.certificationAssetBoxCompact\]/g,
    );
    assert.match(
      signer,
      /compact\s*\?\s*\[styles\.signatureBox, styles\.signatureBoxCompact\]/,
    );
    assert.doesNotMatch(
      certification + signer,
      /&& styles\.(?:certificationAssetBoxCompact|signatureBoxCompact)/,
    );
    assert.doesNotMatch(certification, /styles\.section(?:,|\])/);
  });

  it("repeats the ledger heading in normal flow on continuation pages", () => {
    assert.match(currentPdf, /<View fixed style=\{styles\.tableHeader\} wrap=\{false\}>/);
    assert.doesNotMatch(currentPdf, /tableHeader:\s*\{[^}]*position:/);
  });

  it("allows validated long user content to wrap across pages", () => {
    const header = currentPdf.slice(currentPdf.indexOf("data-pdf-header"), currentPdf.indexOf("data-pdf-customer"));
    const customer = currentPdf.slice(currentPdf.indexOf("data-pdf-customer"), currentPdf.indexOf("data-pdf-items"));
    const items = currentPdf.slice(currentPdf.indexOf("data-pdf-items"), currentPdf.indexOf("data-pdf-totals"));
    const payment = sharedPdf.slice(sharedPdf.indexOf("function PaymentMethod"), sharedPdf.indexOf("function Signer"));

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
      "components/admin/quotations/templates/quotation-document-current.tsx",
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
      [currentPdf, pdfMarkers],
    ] as const) {
      let previous = -1;
      for (const marker of markers) {
        const current = documentSource.indexOf(marker);
        assert.ok(current > previous, `${marker} must follow the previous section`);
        previous = current;
      }
    }
  });

  it("omits an empty optional reference in HTML and PDF", () => {
    const html = readFileSync(
      "components/admin/quotations/templates/quotation-document-current.tsx",
      "utf8",
    );

    assert.match(html, /\{model\.showReference \? \([\s\S]*อ้างอิง[\s\S]*payload\.reference[\s\S]*\) : null\}/);
    assert.match(currentPdf, /\{model\.showReference \? <Detail label="อ้างอิง" styles=\{styles\} value=\{payload\.reference\} \/> : null\}/);
    assert.doesNotMatch(html, /payload\.reference \|\| "-"/);
  });

  it("keeps unspecified offices blank and uses generic VAT summary labels", () => {
    const html = readFileSync(
      "components/admin/quotations/templates/quotation-document-current.tsx",
      "utf8",
    ) + readFileSync(
      "components/admin/quotations/templates/quotation-document-shared.tsx",
      "utf8",
    );

    for (const documentSource of [html, `${currentPdf}\n${sharedPdf}`]) {
      assert.match(documentSource, /officeType === "unspecified"[\s\S]*return ""/);
      assert.match(documentSource, /office\(payload\.customer\) \?/);
      assert.match(documentSource, /function vatLabel[\s\S]*item\.vatTreatment === "taxable"[\s\S]*return `\$\{item\.vatRate\}%`[\s\S]*return ""/);
      assert.match(documentSource, /label="มูลค่าก่อนภาษี"/);
      assert.match(documentSource, /label="ภาษีมูลค่าเพิ่ม"/);
      assert.doesNotMatch(documentSource, /label="(?:มูลค่าก่อนภาษี|ภาษีมูลค่าเพิ่ม) 7%"/);
    }
  });
});
