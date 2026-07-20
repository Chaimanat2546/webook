import {
  formatThaiBahtText,
  type QuotationCalculation,
} from "../../../lib/quotation-calculator";
import { formatBaht, formatMoney } from "../../../lib/quotation-money";
import { PAYMENT_ACCOUNT_TYPE_LABELS, type QuotationPaymentMethod } from "../../../lib/quotation-payment-methods";
import type { QuotationPayload } from "../../../lib/quotation-types";
import {
  CreditCard,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  ReceiptText,
} from "lucide-react";
import { renderThaiQRPaymentMatrix } from "thai-qr-payment";

export function QuotationDocument({
  calculation,
  documentNumber,
  payload,
}: {
  calculation: QuotationCalculation;
  documentNumber: string | null;
  payload: QuotationPayload;
}) {
  const showItemDiscount = payload.items.some(
    (item) => Number(item.discountAmount) > 0,
  );
  const showItemVat = payload.items.some(
    (item) => item.vatTreatment !== "none",
  );
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
              {documentNumber ?? "เลขที่ออกเมื่อบันทึก"}
            </dd>
            <dt className="font-semibold">วันที่ออก</dt>
            <dd>{documentDate(payload.issueDate)}</dd>
            <dt className="font-semibold">ใช้ได้ถึง</dt>
            <dd>{documentDate(payload.validUntil)}</dd>
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
            {showItemDiscount ? (
              <th className="w-[10%] p-2 text-right">ส่วนลด</th>
            ) : null}
            {showItemVat ? (
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
              {showItemDiscount ? (
                <td className="max-w-0 p-2 text-right tabular-nums [overflow-wrap:anywhere]">
                  {formatMoney(item.discountAmount)}
                </td>
              ) : null}
              {showItemVat ? (
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
                {formatThaiBahtText(calculation.amountDue)}
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

      {payload.paymentMethods.length ? (
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
              {[...payload.paymentMethods]
                .sort((left, right) => left.position - right.position)
                .map((method) => (
                  <PaymentMethod
                    amountDue={calculation.amountDue}
                    key={method.id}
                    method={method}
                  />
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
    </article>
  );
}

function PaymentMethod({
  amountDue,
  method,
}: {
  amountDue: string;
  method: QuotationPaymentMethod;
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
  const qr = method.qrMode === "auto_promptpay"
    ? automaticPromptPayQr(method.promptPayId, amountDue)
    : method.qrMode === "upload" && method.qrImageUrl
      ? { ok: true as const, src: method.qrImageUrl }
      : null;

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
        {qr?.ok ? (
          <picture className="h-28 w-28 shrink-0">
            <img
              alt={`QR ${title}`}
              className="h-28 w-28 object-contain"
              src={qr.src}
            />
          </picture>
        ) : qr ? (
          <p className="w-28 shrink-0 text-center text-slate-500">
            ไม่สามารถสร้าง QR ได้
          </p>
        ) : null}
      </div>
    </div>
  );
}

function automaticPromptPayQr(
  recipient: string,
  amountDue: string,
): { ok: true; src: string } | { ok: false } {
  const amount = Number(amountDue);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false };

  try {
    const svg = renderThaiQRPaymentMatrix({
      amount,
      recipient,
      size: 160,
    });
    return { ok: true, src: `data:image/svg+xml,${encodeURIComponent(svg)}` };
  } catch {
    return { ok: false };
  }
}

function office(snapshot: {
  branchNumber: string;
  officeType: "branch" | "head_office";
}) {
  return snapshot.officeType === "branch"
    ? `สาขา ${snapshot.branchNumber}`
    : "สำนักงานใหญ่";
}

function documentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
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
