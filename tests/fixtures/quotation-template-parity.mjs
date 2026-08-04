import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calculateQuotation } from "../../lib/quotation-calculator.ts";
import { QuotationDocument } from "../../components/admin/quotations/quotation-document.tsx";

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
const renders = Object.fromEntries(["current", "hospitality", "corporate"].map((template) => [
  template,
  { html: renderToStaticMarkup(React.createElement(QuotationDocument, { calculation, documentNumber: "QO-PARITY-001", payload: { ...payload, template } })) },
]));

console.log(JSON.stringify(renders));
