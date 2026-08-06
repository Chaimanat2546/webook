import React from "react";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Font, pdf } from "@react-pdf/renderer";

import { calculateQuotation } from "../../lib/quotation-calculator.ts";
import { buildQuotationDocumentViewModel } from "../../lib/quotation-document-view.ts";
import { canonicalQuotationLayoutSnapshot } from "../../lib/quotation-layout.ts";
import { QuotationDocument } from "../../components/admin/quotations/quotation-document.tsx";
import { CorporateQuotationPdf } from "../../components/admin/quotations/templates/quotation-pdf-corporate.tsx";
import { CurrentQuotationPdf } from "../../components/admin/quotations/templates/quotation-pdf-current.tsx";
import { HospitalityQuotationPdf } from "../../components/admin/quotations/templates/quotation-pdf-hospitality.tsx";

const regularFont = fileURLToPath(new URL("../../public/fonts/NotoSansThai-Regular.ttf", import.meta.url));
const semiBoldFont = fileURLToPath(new URL("../../public/fonts/NotoSansThai-SemiBold.ttf", import.meta.url));
Font.register({
  family: "Noto Sans Thai",
  fonts: [
    { fontWeight: 400, src: regularFont },
    { fontWeight: 600, src: semiBoldFont },
  ],
});

const payload = {
  certification: { approver: { name: "Fixture approver", position: "", signatureUrl: "" }, companyStampUrl: "", issuer: { name: "Fixture issuer", position: "", signatureUrl: "" } },
  customer: { address: "Customer Fixture address", branchNumber: "", name: "Customer Fixture", officeType: "head_office", taxId: "0200000000000" },
  documentDisplay: { certificationDate: true, certificationName: true, certificationQr: false, discount: true, notes: true, preTax: true, reference: true, tax: true, unit: true, withholdingTax: false },
  id: null, internalNotes: "Private fixture note", issueDate: "2026-08-04",
  items: [{ description: "Fixture service detail", discountAmount: "123.50", id: "item-1", name: "Suite Fixture", position: 1, quantity: "1", unit: "night", unitPrice: "10000.00", vatRate: "0.00", vatTreatment: "taxable" }],
  paymentMethods: [{ accountName: "Fixture account", accountNumber: "123", accountType: "savings", bankCode: "KBANK", bankId: "bank-kbank", bankLogoUrl: "", bankName: "Fixture Bank", customBankLogoUrl: "", customBankName: "", id: "payment-1", instructions: "Fixture payment instruction", position: 1, promptPayId: "", providerName: "", qrImageUrl: "", qrMode: "upload", type: "bank_transfer" }],
  publicNotes: "Fixture public note", reference: "Fixture reference",
  seller: { address: "Seller Fixture address", branchNumber: "", contactEmail: "", contactName: "", contactPhone: "", email: "seller@example.test", logoUrl: "", name: "Seller Fixture", officeType: "head_office", phone: "020000000", taxId: "0100000000000", website: "" },
  subject: "Fixture subject", template: "current", validUntil: "2026-08-11", validityDays: "7", withholdingTaxRate: null,
};

const calculation = calculateQuotation({ items: payload.items, withholdingTaxRate: payload.withholdingTaxRate });
const rendererByTemplate = {
  corporate: CorporateQuotationPdf,
  current: CurrentQuotationPdf,
  hospitality: HospitalityQuotationPdf,
};

function collectPdfTreeText(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectPdfTreeText).join(" ");
  if (!React.isValidElement(node)) return "";
  if (typeof node.type === "function") return collectPdfTreeText(node.type(node.props));
  return collectPdfTreeText(node.props.children);
}

async function renderPdfBuffer(Renderer, model) {
  const stream = await pdf(React.createElement(Renderer, { images: {}, model })).toBuffer();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).byteLength;
}

const renders = Object.fromEntries(await Promise.all(["current", "hospitality", "corporate"].map(async (template) => {
  const templatePayload = { ...payload, layout: canonicalQuotationLayoutSnapshot(template), template };
  const model = buildQuotationDocumentViewModel({ calculation, documentNumber: "QO-PARITY-001", payload: templatePayload });
  const Renderer = rendererByTemplate[template];
  const hiddenPayload = {
    ...templatePayload,
    documentDisplay: { ...templatePayload.documentDisplay, notes: false, reference: false, unit: false },
  };
  const hiddenModel = buildQuotationDocumentViewModel({ calculation, documentNumber: "QO-PARITY-001", payload: hiddenPayload });
  return [
    template,
    {
      html: renderToStaticMarkup(React.createElement(QuotationDocument, { calculation, documentNumber: "QO-PARITY-001", payload: templatePayload })),
      hiddenHtml: renderToStaticMarkup(React.createElement(QuotationDocument, { calculation, documentNumber: "QO-PARITY-001", payload: hiddenPayload })),
      hiddenPdfByteLength: await renderPdfBuffer(Renderer, hiddenModel),
      hiddenPdfTreeText: collectPdfTreeText(React.createElement(Renderer, { images: {}, model: hiddenModel })),
      pdfTreeText: collectPdfTreeText(React.createElement(Renderer, { images: {}, model })),
      pdfByteLength: await renderPdfBuffer(Renderer, model),
    },
  ];
})));

console.log(JSON.stringify(renders));
