import { CreditCard, Globe2, Mail, MessageCircle, Phone, ReceiptText, Signature } from "lucide-react";
import { formatBaht, formatMoney } from "../../../../lib/quotation-money";
import type { QuotationDocumentRendererProps } from "./quotation-document-contract";
import { DocumentImage, office, PaymentMethod, SignerSlot, Total, vatLabel } from "./quotation-document-shared";

export function CurrentQuotationDocument({
  model,
}: QuotationDocumentRendererProps) {
  const { calculation, payload } = model;
  const compactCertification = !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  return (
    <article
      className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[10mm] text-[10px] leading-[1.45] text-slate-900"
      data-quotation-document
      data-quotation-template="current"
    >
      <header
        className="grid grid-cols-[minmax(0,1.55fr)_minmax(16.5rem,0.85fr)] gap-7"
        data-document-header
      >
        <div className="min-w-0">
          {payload.seller.logoUrl ? (
            <picture>
              <img
                alt="โลโก้ผู้ขาย"
                className="mb-3 max-h-12 max-w-32 object-contain"
                src={payload.seller.logoUrl}
              />
            </picture>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_38mm] gap-5">
            <dl
              className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-2.5 gap-y-1"
              data-document-seller-details
            >
              <dt className="font-semibold">ผู้ขาย</dt>
              <dd className="font-semibold [overflow-wrap:anywhere]">
                {payload.seller.name}
              </dd>
              <dt className="font-semibold">ที่อยู่</dt>
              <dd className="whitespace-pre-line [overflow-wrap:anywhere]">
                {payload.seller.address}
              </dd>
              <dt className="font-semibold">เลขที่ภาษี</dt>
              <dd>
                {payload.seller.taxId}{sellerOffice ? ` (${sellerOffice})` : ""}
              </dd>
            </dl>
            <dl
              className="grid content-start grid-cols-[1rem_minmax(0,1fr)] gap-x-2 gap-y-1"
              data-document-seller-contact
            >
              {payload.seller.phone ? (
                <>
                  <dt className="flex h-[1.45em] items-center justify-center">
                    <Phone aria-hidden="true" className="size-3" />
                    <span className="sr-only">โทร</span>
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">{payload.seller.phone}</dd>
                </>
              ) : null}
              {payload.seller.email ? (
                <>
                  <dt className="flex h-[1.45em] items-center justify-center">
                    <Mail aria-hidden="true" className="size-3" />
                    <span className="sr-only">อีเมล</span>
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {payload.seller.email}
                  </dd>
                </>
              ) : null}
              {payload.seller.website ? (
                <>
                  <dt className="flex h-[1.45em] items-center justify-center">
                    <Globe2 aria-hidden="true" className="size-3" />
                    <span className="sr-only">เว็บไซต์</span>
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {payload.seller.website}
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-right text-[9px]">(ต้นฉบับ)</p>
          <h1 className="mb-2 text-right text-3xl font-semibold tracking-tight text-indigo-500">
            ใบเสนอราคา
          </h1>
          <dl
            className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2.5 gap-y-1 rounded-md bg-indigo-50 p-3"
            data-document-metadata
          >
            <dt className="font-semibold">เลขที่เอกสาร</dt>
            <dd data-document-number className="whitespace-nowrap tabular-nums">
              {model.documentNumber}
            </dd>
            <dt className="font-semibold">วันที่ออก</dt>
            <dd>{model.issueDate}</dd>
            <dt className="font-semibold">ใช้ได้ถึง</dt>
            <dd>{model.validUntil}</dd>
            {model.showReference ? (
              <>
                <dt className="font-semibold">อ้างอิง</dt>
                <dd>{payload.reference}</dd>
              </>
            ) : null}
            {payload.subject ? (
              <>
                <dt className="font-semibold">เรื่อง / ชื่องาน</dt>
                <dd className="[overflow-wrap:anywhere]" data-document-subject>
                  {payload.subject}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <section className="mt-3 border-t pt-3" data-document-customer>
        <dl className="grid max-w-[135mm] grid-cols-[3.75rem_minmax(0,1fr)] gap-x-2.5 gap-y-1">
          <dt className="font-semibold">ลูกค้า</dt>
          <dd className="font-semibold [overflow-wrap:anywhere]">
            {payload.customer.name}
          </dd>
          <dt className="font-semibold">ที่อยู่</dt>
          <dd className="whitespace-pre-line [overflow-wrap:anywhere]">
            {payload.customer.address}
          </dd>
          {payload.customer.taxId ? (
            <>
              <dt className="font-semibold">เลขที่ภาษี</dt>
              <dd>{payload.customer.taxId}</dd>
            </>
          ) : null}
          {office(payload.customer) ? (
            <>
              <dt className="font-semibold">สำนักงาน</dt>
              <dd>{office(payload.customer)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <table
        className="mt-3 w-full table-fixed border-collapse"
        data-document-items
      >
        <thead>
          <tr className="bg-indigo-50 text-left">
            <th className="rounded-l-md p-2">คำอธิบาย</th>
            <th className="w-[8%] p-2 text-right">จำนวน</th>
            {model.showUnit ? <th className="w-[7%] p-2">หน่วย</th> : null}
            <th className="w-[13%] p-2 text-right">ราคา</th>
            {model.showItemDiscount ? (
              <th className="w-[10%] p-2 text-right">ส่วนลด</th>
            ) : null}
            {model.showItemVat ? (
              <th className="w-[7%] p-2 text-right">VAT</th>
            ) : null}
            <th className="w-[15%] rounded-r-md p-2 text-right">
              มูลค่าก่อนภาษี
            </th>
          </tr>
        </thead>
        <tbody>
          {calculation.lines.map((item) => (
            <tr className="border-b align-top" key={item.id}>
              <td className="p-2">
                <p className="font-medium [overflow-wrap:anywhere]">
                  <span className="mr-2 tabular-nums">{item.position}.</span>
                  {item.name}
                </p>
                {item.description ? (
                  <p className="ml-5 whitespace-pre-line text-slate-500 [overflow-wrap:anywhere]">
                    {item.description}
                  </p>
                ) : null}
              </td>
              <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">{item.quantity}</td>
              {model.showUnit ? <td className="p-2 [overflow-wrap:anywhere]">{item.unit}</td> : null}
              <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">
                {formatMoney(item.unitPrice)}
              </td>
              {model.showItemDiscount ? (
                <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">
                  {formatMoney(item.discountAmount)}
                </td>
              ) : null}
              {model.showItemVat ? (
                <td className="p-2 text-right">
                  {vatLabel(item)}
                </td>
              ) : null}
              <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">
                {formatMoney(item.preTaxAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 border-b py-3" data-document-summary>
        <div className="grid grid-cols-[16mm_minmax(0,1fr)_78mm] gap-5">
          <h2
            className="flex items-start gap-1 font-semibold"
            data-document-summary-heading
          >
            <ReceiptText aria-hidden="true" className="mt-0.5 size-3" />
            สรุป
          </h2>
          <div className="space-y-1" data-document-summary-breakdown>
            {model.showPreTax ? <Total
              label="มูลค่าก่อนภาษี"
              value={formatBaht(calculation.preTaxTotal)}
            /> : null}
            {model.showTax ? <Total label="ภาษีมูลค่าเพิ่ม" value={formatBaht(calculation.vatTotal)} /> : null}
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0">จำนวนเงินทั้งสิ้น</span>
              <span className="text-right text-slate-600 [overflow-wrap:anywhere]">
                {model.amountInWords}
              </span>
            </div>
          </div>
          <div className="space-y-1" data-document-summary-settlement>
            <div data-document-summary-grand-total>
              <Total
                emphasized
                label="จำนวนเงินทั้งสิ้น"
                value={formatBaht(calculation.grandTotal)}
              />
            </div>
            {model.showWithholdingTax ? <Total
              label="หักภาษี ณ ที่จ่าย"
              value={formatBaht(calculation.withholdingTaxTotal)}
            /> : null}
            <Total
              label="จำนวนเงินที่ชำระ"
              value={formatBaht(calculation.amountDue)}
            />
          </div>
        </div>
      </section>

      {model.paymentMethods.length ? (
        <section
          className="border-b"
          data-document-payment-methods
        >
          <div className="grid grid-cols-[16mm_minmax(0,1fr)] gap-5">
            <h2
              className="flex items-start gap-1 py-3 font-semibold"
              data-document-payment-heading
            >
              <CreditCard aria-hidden="true" className="mt-0.5 size-3" />
              ชำระเงิน
            </h2>
            <div className="divide-y" data-document-payment-list>
              {model.paymentMethods.map((method) => (
                <PaymentMethod key={method.id} method={method} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {model.showNotes ? <section
        className="grid grid-cols-[16mm_minmax(0,1fr)] gap-5 border-b py-3"
        data-document-notes
      >
        <h2 className="flex items-start gap-1 font-semibold">
          <MessageCircle aria-hidden="true" className="mt-0.5 size-3" />
          หมายเหตุ
        </h2>
        {payload.publicNotes ? (
          <p className="whitespace-pre-line [overflow-wrap:anywhere]">
            {payload.publicNotes}
          </p>
        ) : null}
      </section> : null}

      <section
        className="break-inside-avoid grid grid-cols-[16mm_minmax(0,1fr)] gap-5 py-3"
        data-document-certification
      >
        <h2 className="flex items-start gap-1 font-semibold">
          <Signature aria-hidden="true" className="mt-0.5 size-3" />
          รับรอง
        </h2>
        <div
          className={`grid min-w-0 gap-3 text-center ${
            model.showCertificationQr ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          {model.showCertificationQr ? (
            <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-public-qr>
              <p className="font-semibold">สแกนเพื่อเปิดด้วยเว็บไซต์</p>
              <div className={`flex items-center justify-center ${compactCertification ? "h-12" : "h-20"}`}>
                {model.publicQrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Generated Data URLs are intentionally embedded for print.
                  <img
                    alt="QR สำหรับดูใบเสนอราคาออนไลน์"
                    className={`${compactCertification ? "max-h-10" : "max-h-20"} w-full object-contain`}
                    src={model.publicQrDataUrl}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          <SignerSlot
            compact={compactCertification}
            issueDate={model.issueDate}
            label="ผู้ออกเอกสาร"
            showDate={model.showCertificationDate}
            showName={model.showCertificationName}
            signer={model.certification.issuer}
          />
          <SignerSlot
            compact={compactCertification}
            issueDate={model.issueDate}
            label="ผู้อนุมัติเอกสาร"
            showDate={model.showCertificationDate}
            showName={model.showCertificationName}
            signer={model.certification.approver}
          />
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-stamp>
            <p className="font-semibold">ตราประทับ</p>
            <div className={`flex items-center justify-center ${compactCertification ? "h-12" : "h-20"}`}>
              {model.certification.companyStampUrl ? (
                <DocumentImage
                  alt="ตราประทับบริษัท"
                  className={`${compactCertification ? "max-h-10" : "max-h-16"} w-full object-contain`}
                  key={model.certification.companyStampUrl}
                  src={model.certification.companyStampUrl}
                />
              ) : null}
            </div>
          </div>
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-receiver>
            <p className="font-semibold">ผู้รับเอกสาร (ลูกค้า)</p>
            <div className={`${compactCertification ? "h-12" : "h-20"} border-b`} aria-hidden="true" />
            {model.showCertificationName ? <p>{model.payload.customer.name}</p> : null}
            {model.showCertificationDate ? <p>วันที่ __________________</p> : null}
          </div>
        </div>
      </section>
    </article>
  );
}
