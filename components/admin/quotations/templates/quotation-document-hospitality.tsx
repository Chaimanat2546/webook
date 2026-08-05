import { CreditCard, MapPin, MessageCircle, ReceiptText, Signature } from "lucide-react";

import { quotationLayoutBlockStyle } from "../../../../lib/quotation-layout-renderer";
import { formatBaht, formatMoney } from "../../../../lib/quotation-money";

import type { QuotationDocumentRendererProps } from "./quotation-document-contract";
import {
  DocumentImage,
  office,
  PaymentMethod,
  SignerSlot,
  vatLabel,
} from "./quotation-document-shared";

function HospitalityTotal({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={emphasized ? "flex justify-between gap-3 border-t border-[#c79b58] pt-2 text-sm font-semibold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <span className="text-right tabular-nums [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

export function HospitalityQuotationDocument({ model }: QuotationDocumentRendererProps) {
  const { calculation, payload } = model;
  const compactCertification = !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  const customerOffice = office(payload.customer);
  const hasContact = Boolean(
    payload.seller.contactName || payload.seller.contactPhone || payload.seller.contactEmail,
  );

  return (
    <article
      className="mx-auto min-h-[297mm] w-[210mm] bg-[#fffdf8] p-[10mm] text-[10px] leading-[1.45] text-slate-800"
      data-quotation-document
      data-layout-revision={payload.layout.revisionNumber}
      data-quotation-template="hospitality"
    >
      <div className="-mx-[10mm] -mt-[10mm] mb-5 h-2 bg-[#286a5b]" aria-hidden="true" />

      <header className="grid grid-cols-12 gap-6" data-document-header>
        <div className="min-w-0" data-layout-block="seller" style={quotationLayoutBlockStyle(model, "seller")}>
          {payload.seller.logoUrl ? (
            <picture>
              <img alt="โลโก้ผู้ขาย" className="mb-3 max-h-12 max-w-32 object-contain" src={payload.seller.logoUrl} />
            </picture>
          ) : null}
          <p className="text-lg font-semibold text-[#286a5b] [overflow-wrap:anywhere]">{payload.seller.name}</p>
          <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{payload.seller.address}</p>
          <p className="mt-1">เลขที่ภาษี {payload.seller.taxId}{sellerOffice ? ` (${sellerOffice})` : ""}</p>
        </div>
        <div className="min-w-0 text-right" data-layout-block="documentMetadata" style={quotationLayoutBlockStyle(model, "documentMetadata")}>
          <p className="text-[9px]">(ต้นฉบับ)</p>
          <h1 className="text-3xl font-semibold tracking-[0.08em] text-[#286a5b]">QUOTATION</h1>
          <p className="text-base text-[#c79b58]">ใบเสนอราคา</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-12 gap-4" data-layout-zone="body">
        <div className="rounded-md border border-[#c79b58]/50 bg-[#fff8e9] p-3" data-hospitality-recipient data-layout-block="customer" style={quotationLayoutBlockStyle(model, "customer")}>
          <p className="mb-2 font-semibold text-[#286a5b]">สำหรับ</p>
          <p className="font-semibold [overflow-wrap:anywhere]">{payload.customer.name}</p>
          <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{payload.customer.address}</p>
          {payload.customer.taxId ? <p className="mt-1">เลขที่ภาษี {payload.customer.taxId}</p> : null}
          {customerOffice ? <p>สำนักงาน {customerOffice}</p> : null}
        </div>
        <dl className="rounded-md border border-[#286a5b]/20 bg-white/60 p-3" data-document-metadata>
          <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1">
            <dt className="font-semibold">เลขที่เอกสาร</dt><dd data-document-number className="text-right tabular-nums">{model.documentNumber}</dd>
            <dt className="font-semibold">วันที่ออก</dt><dd className="text-right">{model.issueDate}</dd>
            <dt className="font-semibold">ใช้ได้ถึง</dt><dd className="text-right">{model.validUntil}</dd>
            {model.showReference ? <><dt className="font-semibold">อ้างอิง</dt><dd className="text-right [overflow-wrap:anywhere]">{payload.reference}</dd></> : null}
            {payload.subject ? <><dt className="font-semibold">เรื่อง / ชื่องาน</dt><dd data-document-subject className="text-right [overflow-wrap:anywhere]">{payload.subject}</dd></> : null}
          </div>
        </dl>

      <section className="mt-5" data-document-items data-layout-block="items" style={quotationLayoutBlockStyle(model, "items")}>
        <div className="mb-2 flex items-center gap-2 text-[#286a5b]"><MapPin aria-hidden="true" className="size-3.5" /><h2 className="font-semibold">รายละเอียดที่พักและบริการ</h2></div>
        <table className="w-full table-fixed border-collapse">
          <thead><tr className="bg-[#286a5b] text-left text-white">
            <th className="rounded-l-md p-2">รายละเอียด</th><th className="w-[8%] p-2 text-right">จำนวน</th>
            {model.showUnit ? <th className="w-[7%] p-2">หน่วย</th> : null}<th className="w-[13%] p-2 text-right">ราคา</th>
            {model.showItemDiscount ? <th className="w-[10%] p-2 text-right">ส่วนลด</th> : null}{model.showItemVat ? <th className="w-[7%] p-2 text-right">VAT</th> : null}
            <th className="w-[15%] rounded-r-md p-2 text-right">มูลค่าก่อนภาษี</th>
          </tr></thead>
          <tbody>{calculation.lines.map((item) => <tr className="border-b border-[#286a5b]/20 align-top" key={item.id}>
            <td className="p-2"><p className="font-medium [overflow-wrap:anywhere]"><span className="mr-2 tabular-nums text-[#c79b58]">{item.position}.</span>{item.name}</p>{item.description ? <p className="mt-1 whitespace-pre-line text-slate-600 [overflow-wrap:anywhere]">{item.description}</p> : null}</td>
            <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">{item.quantity}</td>{model.showUnit ? <td className="p-2 [overflow-wrap:anywhere]">{item.unit}</td> : null}
            <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">{formatMoney(item.unitPrice)}</td>{model.showItemDiscount ? <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">{formatMoney(item.discountAmount)}</td> : null}
            {model.showItemVat ? <td className="p-2 text-right">{vatLabel(item)}</td> : null}<td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">{formatMoney(item.preTaxAmount)}</td>
          </tr>)}</tbody>
        </table>
      </section>

      </section>

      <section className="mt-4 grid grid-cols-12 gap-4 border-y border-[#286a5b]/20 py-3" data-document-summary data-layout-zone="settlement">
        <div className="min-w-0" data-layout-block="paymentMethods" style={quotationLayoutBlockStyle(model, "paymentMethods")}>
          {model.paymentMethods.length ? <div data-document-payment-methods><h2 className="mb-1 flex items-center gap-1 font-semibold text-[#286a5b]"><CreditCard aria-hidden="true" className="size-3" />การชำระเงิน</h2><div className="divide-y divide-[#286a5b]/15">{model.paymentMethods.map((method) => <PaymentMethod key={method.id} method={method} />)}</div></div> : null}
        </div>
        {model.showNotes ? <section data-document-notes data-layout-block="publicNotes" style={quotationLayoutBlockStyle(model, "publicNotes")}><h2 className="mb-1 flex items-center gap-1 font-semibold text-[#286a5b]"><MessageCircle aria-hidden="true" className="size-3" />หมายเหตุ</h2><p className="whitespace-pre-line [overflow-wrap:anywhere]">{payload.publicNotes}</p></section> : null}
        <aside className="break-inside-avoid h-full rounded-md bg-[#286a5b] p-3 text-white" data-hospitality-settlement data-document-summary-settlement data-layout-block="summary" style={quotationLayoutBlockStyle(model, "summary")}>
          <h2 className="mb-2 flex items-center gap-1 font-semibold"><ReceiptText aria-hidden="true" className="size-3" />สรุปการชำระ</h2>
          <HospitalityTotal label="มูลค่ารวม" value={formatBaht(calculation.grossTotal)} />
          <HospitalityTotal label="ส่วนลด" value={formatBaht(calculation.discountTotal)} />
          {model.showPreTax ? <HospitalityTotal label="มูลค่าก่อนภาษี" value={formatBaht(calculation.preTaxTotal)} /> : null}
          {model.showTax ? <HospitalityTotal label="ภาษีมูลค่าเพิ่ม" value={formatBaht(calculation.vatTotal)} /> : null}
          <HospitalityTotal emphasized label="จำนวนเงินทั้งสิ้น" value={formatBaht(calculation.grandTotal)} />
          {model.showWithholdingTax ? <HospitalityTotal label="หักภาษี ณ ที่จ่าย" value={formatBaht(calculation.withholdingTaxTotal)} /> : null}
          <HospitalityTotal label="จำนวนเงินที่ชำระ" value={formatBaht(calculation.amountDue)} />
          <p className="mt-2 border-t border-white/30 pt-2 text-right text-[9px] [overflow-wrap:anywhere]">{model.amountInWords}</p>
        </aside>
      </section>

      <section className="break-inside-avoid mt-3 grid grid-cols-[16mm_minmax(0,1fr)] gap-4" data-document-certification data-layout-block="certification" style={quotationLayoutBlockStyle(model, "certification")}>
        <h2 className="flex items-start gap-1 font-semibold text-[#286a5b]"><Signature aria-hidden="true" className="mt-0.5 size-3" />รับรอง</h2>
        <div className={`grid min-w-0 gap-3 text-center ${model.showCertificationQr ? "grid-cols-5" : "grid-cols-4"}`}>
          {model.showCertificationQr ? <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-public-qr><p className="font-semibold">สแกนเพื่อเปิดด้วยเว็บไซต์</p><div className={`flex items-center justify-center ${compactCertification ? "h-12" : "h-20"}`}>{model.publicQrDataUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- Generated QR data URLs must remain embeddable in document previews. */}
            <img alt="QR สำหรับดูใบเสนอราคาออนไลน์" className={`${compactCertification ? "max-h-10" : "max-h-20"} w-full object-contain`} src={model.publicQrDataUrl} />
          </> : null}</div></div> : null}
          <SignerSlot compact={compactCertification} issueDate={model.issueDate} label="ผู้ออกเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.issuer} />
          <SignerSlot compact={compactCertification} issueDate={model.issueDate} label="ผู้อนุมัติเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.approver} />
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-stamp><p className="font-semibold">ตราประทับ</p><div className={`flex items-center justify-center ${compactCertification ? "h-12" : "h-20"}`}>{model.certification.companyStampUrl ? <DocumentImage alt="ตราประทับบริษัท" className={`${compactCertification ? "max-h-10" : "max-h-16"} w-full object-contain`} key={model.certification.companyStampUrl} src={model.certification.companyStampUrl} /> : null}</div></div>
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-receiver><p className="font-semibold">ผู้รับเอกสาร (ลูกค้า)</p><div className={`${compactCertification ? "h-12" : "h-20"} border-b`} aria-hidden="true" />{model.showCertificationName ? <p>{payload.customer.name}</p> : null}{model.showCertificationDate ? <p>วันที่ __________________</p> : null}</div>
        </div>
      </section>

      <footer className="mt-4 border-t border-[#c79b58] pt-3 text-[9px] text-slate-600" data-hospitality-seller-footer data-layout-block="sellerFooter" style={quotationLayoutBlockStyle(model, "sellerFooter")}>
        <p className="font-semibold text-[#286a5b]">{payload.seller.name}</p>
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{payload.seller.address}</p>
        <p className="[overflow-wrap:anywhere]">{[payload.seller.phone, payload.seller.email, payload.seller.website].filter(Boolean).join(" | ")}</p>
        {hasContact ? <p className="mt-1 [overflow-wrap:anywhere]">ผู้ติดต่อ: {[payload.seller.contactName, payload.seller.contactPhone, payload.seller.contactEmail].filter(Boolean).join(" | ")}</p> : null}
      </footer>
    </article>
  );
}
