import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calculateQuotation } from "../../lib/quotation-calculator.ts";
import { buildQuotationDocumentViewModel } from "../../lib/quotation-document-view.ts";
import { canonicalQuotationLayoutSnapshot } from "../../lib/quotation-layout.ts";
import { CorporateQuotationDocument } from "../../components/admin/quotations/templates/quotation-document-corporate.tsx";
import { collectQuotationPdfImageSources, resolveQuotationPdfImages } from "../../components/admin/quotations/quotation-pdf.tsx";

const uploadedPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6rQAAAABJRU5ErkJggg==";
const item = { description: "รายละเอียด", discountAmount: "0.00", id: "item-1", name: "ค่าที่พัก", position: 1, quantity: "1.000", unit: "คืน", unitPrice: "1000.00", vatRate: "0.00", vatTreatment: "none" };
const payload = { certification: { approver: { name: "", position: "", signatureUrl: "" }, companyStampUrl: "", issuer: { name: "", position: "", signatureUrl: "" } }, customer: { address: "ที่อยู่ลูกค้า", branchNumber: "", name: "ลูกค้า", officeType: "unspecified", taxId: "" }, documentDisplay: { certificationDate: false, certificationName: false, certificationQr: false, discount: false, notes: false, preTax: true, reference: false, tax: false, unit: false, withholdingTax: false }, id: null, internalNotes: "", issueDate: "2026-08-04", items: [item], layout: { ...canonicalQuotationLayoutSnapshot("corporate"), sourceId: "00000000-0000-4000-8000-000000000001" }, paymentMethods: [{ accountName: "บริษัทตัวอย่าง", accountNumber: "123456", accountType: "savings", bankCode: "KBANK", bankId: "bank-kbank", bankLogoUrl: "", bankName: "ธนาคารตัวอย่าง", customBankLogoUrl: "", customBankName: "", id: "payment-1", instructions: "", position: 1, promptPayId: "", providerName: "", qrImageUrl: "https://assets.example.test/uploaded-qr.png", qrMode: "upload", type: "bank_transfer" }], publicNotes: "", reference: "", seller: { address: "ที่อยู่ผู้ขาย", branchNumber: "", contactEmail: "contact@example.test", contactName: "ผู้ประสานงาน", contactPhone: "0812345678", email: "seller@example.test", logoUrl: "", name: "ผู้ขาย", officeType: "head_office", phone: "020000000", taxId: "0100000000000", website: "example.test" }, subject: "", template: "corporate", validUntil: "2026-08-31", validityDays: "27", withholdingTaxRate: "0.00" };
const calculation = calculateQuotation({ items: payload.items, withholdingTaxRate: payload.withholdingTaxRate });
const model = buildQuotationDocumentViewModel({ calculation, documentNumber: "COR-TEST", payload });
const html = renderToStaticMarkup(React.createElement(CorporateQuotationDocument, { model }));
const sources = collectQuotationPdfImageSources(model);
const resolved = await resolveQuotationPdfImages(sources, async (source) => source === payload.paymentMethods[0].qrImageUrl ? uploadedPng : source);
console.log(JSON.stringify({ hasUploadedPng: resolved[payload.paymentMethods[0].qrImageUrl] === uploadedPng, hasVatColumn: html.includes(">VAT</th>"), hasDiscountColumn: html.includes(">ส่วนลด</th>"), hasUnitColumn: html.includes(">หน่วย</th>"), hasSequentialSummary: html.includes("data-corporate-summary-sequential"), template: html.includes("data-quotation-template=\"corporate\"") }));
