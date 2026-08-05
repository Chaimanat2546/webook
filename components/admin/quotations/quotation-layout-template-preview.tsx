import { QuotationDocument } from "./quotation-document";
import { QUOTATION_LAYOUT_SCHEMA_VERSION, type QuotationLayoutConfig } from "../../../lib/quotation-layout";
import type { QuotationCalculation } from "../../../lib/quotation-calculator";
import type { QuotationTemplate } from "../../../lib/quotation-template";
import type { QuotationPayload } from "../../../lib/quotation-types";

const calculation: QuotationCalculation = {
  amountDue: "1000.00", discountTotal: "0.00", grandTotal: "1000.00", grossTotal: "1000.00", preTaxTotal: "1000.00", vatTotal: "0.00", withholdingTaxTotal: "0.00",
  lines: [{ description: "ตัวอย่างรายการในใบเสนอราคา", discountAmount: "0", grossAmount: "1000.00", id: "preview-line", lineTotal: "1000.00", name: "สินค้า / บริการตัวอย่าง", position: 1, preTaxAmount: "1000.00", quantity: "1", unit: "รายการ", unitPrice: "1000.00", vatAmount: "0.00", vatRate: "0", vatTreatment: "none" }],
};

function payloadFor(template: QuotationTemplate, config: QuotationLayoutConfig): QuotationPayload {
  return {
    certification: { approver: { name: "ผู้อนุมัติ", position: "", signatureUrl: "" }, companyStampUrl: "", issuer: { name: "ผู้ออกเอกสาร", position: "", signatureUrl: "" } },
    customer: { address: "123 ถนนสุขุมวิท กรุงเทพมหานคร", branchNumber: "", name: "บริษัทลูกค้าตัวอย่าง จำกัด", officeType: "head_office", taxId: "0105550000000" },
    documentDisplay: { certificationDate: true, certificationName: true, certificationQr: false, discount: true, notes: true, preTax: true, reference: true, tax: true, unit: true, withholdingTax: false },
    id: null,
    internalNotes: "",
    issueDate: "2026-08-05",
    items: calculation.lines,
    layout: { config, revisionNumber: 1, schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION, sourceId: "layout-preview" },
    paymentMethods: [{ accountName: "บริษัทตัวอย่าง จำกัด", accountNumber: "123-4-56789-0", accountType: "savings", bankCode: "KBANK", bankId: null, bankLogoUrl: "", bankName: "ธนาคารตัวอย่าง", customBankLogoUrl: "", customBankName: "", id: "preview-payment", instructions: "ชำระภายในวันที่กำหนด", position: 1, promptPayId: "", providerName: "", qrImageUrl: "", qrMode: "none", type: "bank_transfer" }],
    publicNotes: "ขอบคุณที่เลือกใช้บริการของเรา",
    reference: "REF-0001",
    seller: { address: "99 ถนนตัวอย่าง เขตวัฒนา กรุงเทพมหานคร", branchNumber: "", contactEmail: "sales@example.com", contactName: "ฝ่ายขาย", contactPhone: "02-000-0000", email: "sales@example.com", logoUrl: "", name: "บริษัทตัวอย่าง จำกัด", officeType: "head_office", phone: "02-000-0000", taxId: "0105550000000", website: "example.com" },
    subject: "ข้อเสนอสำหรับงานตัวอย่าง",
    template,
    validUntil: "2026-08-20",
    validityDays: "15",
    withholdingTaxRate: null,
  };
}

export function QuotationLayoutTemplatePreview({ config, template }: { config: QuotationLayoutConfig; template: QuotationTemplate }) {
  return <section className="overflow-hidden rounded-md border bg-slate-100" data-layout-live-template-preview>
    <div className="border-b bg-white px-3 py-2"><p className="text-xs font-semibold">ตัวอย่างเอกสารจริง · {template}</p><p className="text-[11px] text-muted-foreground">การจัดวางด้านล่างใช้ renderer เดียวกับใบเสนอราคาจริง</p></div>
    <div className="relative h-[405px] overflow-hidden"><div className="absolute left-1/2 top-0 w-[210mm] origin-top -translate-x-1/2 scale-[0.36]"><QuotationDocument calculation={calculation} documentNumber="QO-000001" payload={payloadFor(template, config)} /></div></div>
  </section>;
}
