import type { QuotationCalculation } from "../../../lib/quotation-calculator";
import {
  buildQuotationDocumentViewModel,
  type QuotationDocumentViewModel,
} from "../../../lib/quotation-document-view";
import { formatBaht, formatMoney } from "../../../lib/quotation-money";
import { PAYMENT_ACCOUNT_TYPE_LABELS } from "../../../lib/quotation-payment-methods";
import type { QuotationPayload } from "../../../lib/quotation-types";
import {
  CreditCard,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  ReceiptText,
  Signature,
} from "lucide-react";
import { DocumentImage } from "./document-image";

export function QuotationDocument({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string | null;
  payload: QuotationPayload;
  publicQrDataUrl?: string | null;
}) {
  const model = buildQuotationDocumentViewModel({
    calculation,
    documentNumber,
    payload,
    publicQrDataUrl,
  });
  return (
    <article
      className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[10mm] text-[10px] leading-[1.45] text-slate-900"
      data-quotation-document
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
                {payload.seller.taxId} ({office(payload.seller)})
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
            <dt className="font-semibold">อ้างอิง</dt>
            <dd>{payload.reference || "-"}</dd>
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
          <dt className="font-semibold">สำนักงาน</dt>
          <dd>{office(payload.customer)}</dd>
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
            <th className="w-[7%] p-2">หน่วย</th>
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
              <td className="p-2 [overflow-wrap:anywhere]">{item.unit}</td>
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
                  {item.vatTreatment === "taxable"
                    ? `${item.vatRate}%`
                    : item.vatTreatment === "exempt"
                      ? "ยกเว้น"
                      : "-"}
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
            <Total
              label="มูลค่าก่อนภาษี 7%"
              value={formatBaht(calculation.preTaxTotal)}
            />
            <Total label="ภาษีมูลค่าเพิ่ม 7%" value={formatBaht(calculation.vatTotal)} />
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
            <Total
              label="หักภาษี ณ ที่จ่าย"
              value={formatBaht(calculation.withholdingTaxTotal)}
            />
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

      <section
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
      </section>

      <section
        className="break-inside-avoid grid grid-cols-[16mm_minmax(0,1fr)] gap-5 border-b py-3"
        data-document-certification
      >
        <h2 className="flex items-start gap-1 font-semibold">
          <Signature aria-hidden="true" className="mt-0.5 size-3" />
          รับรอง
        </h2>
        <div className="grid min-w-0 grid-cols-5 gap-3 text-center">
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-public-qr>
            <p className="font-semibold">สแกนเพื่อเปิดด้วยเว็บไซต์</p>
            <div className="flex h-20 items-center justify-center">
              {model.publicQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Generated Data URLs are intentionally embedded for print.
                <img
                  alt="QR สำหรับดูใบเสนอราคาออนไลน์"
                  className="max-h-20 w-full object-contain"
                  src={model.publicQrDataUrl}
                />
              ) : null}
            </div>
          </div>
          <SignerSlot
            issueDate={model.issueDate}
            label="ผู้ออกเอกสาร"
            signer={model.certification.issuer}
          />
          <SignerSlot
            issueDate={model.issueDate}
            label="ผู้อนุมัติเอกสาร"
            signer={model.certification.approver}
          />
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-stamp>
            <p className="font-semibold">ตราประทับ</p>
            <div className="flex h-20 items-center justify-center">
              {model.certification.companyStampUrl ? (
                <DocumentImage
                  alt="ตราประทับบริษัท"
                  className="max-h-16 w-full object-contain"
                  key={model.certification.companyStampUrl}
                  src={model.certification.companyStampUrl}
                />
              ) : null}
            </div>
          </div>
          <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-receiver>
            <p className="font-semibold">ผู้รับเอกสาร (ลูกค้า)</p>
            <div className="h-20 border-b" aria-hidden="true" />
            <p>{model.payload.customer.name}</p>
            <p>วันที่ __________________</p>
          </div>
        </div>
      </section>
    </article>
  );
}

function PaymentMethod({
  method,
}: {
  method: QuotationDocumentViewModel["paymentMethods"][number];
}) {
  const bankName = method.customBankName || method.bankName;
  const bankLogo = method.customBankLogoUrl || method.bankLogoUrl;
  const title = method.type === "bank_transfer"
    ? bankName
    : method.type === "promptpay"
      ? "พร้อมเพย์"
      : method.type === "qr_payment" || method.type === "other"
        ? method.providerName
        : "เงินสด";
  const accountTypeLabel = method.accountType
    ? PAYMENT_ACCOUNT_TYPE_LABELS[method.accountType]
    : "";
  const accountNumberLine = [accountTypeLabel, method.accountNumber].filter(Boolean).join(" ");
  const qrUnavailable = method.qrMode === "auto_promptpay" && !method.qrSource;

  return (
    <div className="break-inside-avoid min-w-0 py-2.5">
      <div
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"
        data-document-payment-entry
      >
        {bankLogo ? (
          <picture className="shrink-0" data-document-payment-logo>
            <img
              alt={bankName ? `โลโก้${bankName}` : "โลโก้ธนาคาร"}
              className="h-9 w-9 object-contain"
              src={bankLogo}
            />
          </picture>
        ) : null}
        <div
          className="min-w-0 space-y-0.5 [overflow-wrap:anywhere]"
          data-document-payment-details
        >
          <p>{title}</p>
          {method.type === "bank_transfer" ? (
            <>
              <p className="font-semibold tabular-nums">{accountNumberLine}</p>
              <p>{method.accountName}</p>
            </>
          ) : null}
          {method.type === "promptpay" ? (
            <>
              <p className="font-medium tabular-nums">{method.promptPayId}</p>
              <p>{method.accountName}</p>
            </>
          ) : null}
          {method.instructions ? (
            <p className="whitespace-pre-line text-slate-500">
              {method.instructions}
            </p>
          ) : null}
        </div>
        {method.qrSource ? (
          <picture className="h-28 w-28 shrink-0">
            <img
              alt={`QR ${title}`}
              className="h-28 w-28 object-contain"
              src={method.qrSource}
            />
          </picture>
        ) : qrUnavailable ? (
          <p className="w-28 shrink-0 text-center text-slate-500">
            ไม่สามารถสร้าง QR ได้
          </p>
        ) : null}
      </div>
    </div>
  );
}

function office(snapshot: {
  branchNumber: string;
  officeType: "branch" | "head_office";
}) {
  return snapshot.officeType === "branch"
    ? `สาขา ${snapshot.branchNumber}`
    : "สำนักงานใหญ่";
}

function SignerSlot({
  issueDate,
  label,
  signer,
}: {
  issueDate: string;
  label: string;
  signer: QuotationDocumentViewModel["certification"]["issuer"];
}) {
  return (
    <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-signer>
      <p className="font-semibold">{label}</p>
      <div className="flex h-20 items-end justify-center border-b">
        {signer.signatureUrl ? (
          <DocumentImage
            alt={`ลายเซ็น${label}`}
            className="max-h-16 w-full object-contain"
            key={signer.signatureUrl}
            src={signer.signatureUrl}
          />
        ) : null}
      </div>
      {signer.name ? <p>({signer.name})</p> : null}
      <p>วันที่ {issueDate}</p>
    </div>
  );
}

function Total({
  bold,
  emphasized,
  label,
  value,
}: {
  bold?: boolean;
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-3",
        bold ? "border-t pt-2 font-semibold" : "",
        emphasized ? "rounded-md bg-indigo-50 p-3 text-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}
