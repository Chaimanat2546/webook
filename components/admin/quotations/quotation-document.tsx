import {
  formatThaiBahtText,
  type QuotationCalculation,
} from "../../../lib/quotation-calculator";
import { formatBaht, formatMoney } from "../../../lib/quotation-money";
import type { QuotationPaymentMethod } from "../../../lib/quotation-payment-methods";
import type { QuotationPayload } from "../../../lib/quotation-types";
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
      className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-[11px] leading-relaxed text-slate-900"
      data-quotation-document
    >
      <header
        className="grid grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] gap-8"
        data-document-header
      >
        <div className="min-w-0">
          {payload.seller.logoUrl ? (
            <picture>
            <img
              alt="โลโก้ผู้ขาย"
              className="mb-4 max-h-16 max-w-40 object-contain"
              src={payload.seller.logoUrl}
            />
            </picture>
          ) : null}
          <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
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
            {payload.seller.phone ? (
              <>
                <dt className="font-semibold">โทร</dt>
                <dd>{payload.seller.phone}</dd>
              </>
            ) : null}
            {payload.seller.email ? (
              <>
                <dt className="font-semibold">อีเมล</dt>
                <dd className="[overflow-wrap:anywhere]">
                  {payload.seller.email}
                </dd>
              </>
            ) : null}
            {payload.seller.website ? (
              <>
                <dt className="font-semibold">เว็บไซต์</dt>
                <dd className="[overflow-wrap:anywhere]">
                  {payload.seller.website}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
        <div className="min-w-0">
          <h1 className="mb-4 text-right text-3xl font-semibold tracking-tight text-indigo-500">
            ใบเสนอราคา
          </h1>
          <dl
            className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md bg-indigo-50 p-4"
            data-document-metadata
          >
            <dt className="font-semibold">เลขที่เอกสาร</dt>
            <dd>{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</dd>
            <dt className="font-semibold">วันที่ออก</dt>
            <dd>{documentDate(payload.issueDate)}</dd>
            <dt className="font-semibold">ใช้ได้ถึง</dt>
            <dd>{documentDate(payload.validUntil)}</dd>
            <dt className="font-semibold">อ้างอิง</dt>
            <dd>{payload.reference || "-"}</dd>
          </dl>
          {payload.subject ? (
            <p className="mt-3 text-right [overflow-wrap:anywhere]">
              <span className="font-semibold">เรื่อง / ชื่องาน:</span>{" "}
              {payload.subject}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mt-5 border-t pt-4" data-document-customer>
        <dl className="grid max-w-[125mm] grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
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
        className="mt-5 w-full table-fixed border-collapse"
        data-document-items
      >
        <thead>
          <tr className="bg-indigo-50 text-left">
            <th className="w-[6%] rounded-l-md p-2">#</th>
            <th className="p-2">คำอธิบาย</th>
            <th className="w-[9%] p-2 text-right">จำนวน</th>
            <th className="w-[8%] p-2">หน่วย</th>
            <th className="w-[14%] p-2 text-right">ราคา</th>
            {showItemDiscount ? (
              <th className="w-[12%] p-2 text-right">ส่วนลด</th>
            ) : null}
            {showItemVat ? (
              <th className="w-[8%] p-2 text-right">VAT</th>
            ) : null}
            <th className="w-[16%] rounded-r-md p-2 text-right">
              มูลค่าก่อนภาษี
            </th>
          </tr>
        </thead>
        <tbody>
          {calculation.lines.map((item) => (
            <tr className="border-b align-top" key={item.id}>
              <td className="p-2">{item.position}.</td>
              <td className="p-2">
                <p className="font-medium [overflow-wrap:anywhere]">{item.name}</p>
                {item.description ? (
                  <p className="whitespace-pre-line text-slate-500 [overflow-wrap:anywhere]">{item.description}</p>
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

      <section
        className="mt-10 grid grid-cols-[minmax(0,1fr)_80mm] gap-8 border-t pt-4"
        data-document-summary
      >
        <div className="min-w-0">
          {payload.publicNotes ? (
            <>
              <p className="font-semibold">หมายเหตุ</p>
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">
                {payload.publicNotes}
              </p>
            </>
          ) : null}
        </div>
        <div className="space-y-1">
          <Total
            label="รวมก่อนส่วนลด"
            value={formatBaht(calculation.grossTotal)}
          />
          {calculation.discountTotal !== "0.00" ? (
            <Total
              label="ส่วนลด"
              value={formatBaht(calculation.discountTotal)}
            />
          ) : null}
          <Total
            label="มูลค่าก่อนภาษี"
            value={formatBaht(calculation.preTaxTotal)}
          />
          <Total label="VAT" value={formatBaht(calculation.vatTotal)} />
          <Total
            emphasized
            label="จำนวนเงินรวมทั้งสิ้น"
            value={formatBaht(calculation.grandTotal)}
          />
          <Total
            label="หักภาษี ณ ที่จ่าย"
            value={formatBaht(calculation.withholdingTaxTotal)}
          />
          <Total
            bold
            label="ยอดชำระ"
            value={formatBaht(calculation.amountDue)}
          />
          <p className="pt-2 text-right [overflow-wrap:anywhere]">
            {formatThaiBahtText(calculation.amountDue)}
          </p>
        </div>
      </section>

      {payload.paymentMethods.length ? (
        <section
          className="mt-6 border-t pt-4"
          data-document-payment-methods
        >
          <h2 className="mb-3 text-sm font-semibold">ช่องทางชำระเงิน</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
        </section>
      ) : null}
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
  const qr = method.qrMode === "auto_promptpay"
    ? automaticPromptPayQr(method.promptPayId, amountDue)
    : method.qrMode === "upload" && method.qrImageUrl
      ? { ok: true as const, src: method.qrImageUrl }
      : null;

  return (
    <div className="break-inside-avoid min-w-0 border-l-2 border-indigo-100 pl-3">
      <div className="flex min-w-0 items-start gap-3">
        {bankLogo ? (
          <picture className="h-9 w-9 shrink-0">
            <img
              alt={bankName ? `โลโก้${bankName}` : "โลโก้ธนาคาร"}
              className="h-9 w-9 object-contain"
              src={bankLogo}
            />
          </picture>
        ) : null}
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="font-semibold">{title}</p>
          {method.type === "bank_transfer" ? (
            <>
              <p className="font-medium tabular-nums">{method.accountNumber}</p>
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
        emphasized ? "my-3 rounded-md bg-indigo-50 p-3 text-sm" : "",
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
