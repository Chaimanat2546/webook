import type { QuotationCalculation } from "../../../../lib/quotation-calculator";
import type { QuotationDocumentViewModel } from "../../../../lib/quotation-document-view";
import { PAYMENT_ACCOUNT_TYPE_LABELS } from "../../../../lib/quotation-payment-methods";
import type { OfficeType } from "../../../../lib/quotation-types";
import { DocumentImage } from "../document-image";

export { DocumentImage };

export function PaymentMethod({
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

export function office(snapshot: {
  branchNumber: string;
  officeType: OfficeType;
}) {
  if (snapshot.officeType === "unspecified") return "";
  return snapshot.officeType === "branch"
    ? `สาขา ${snapshot.branchNumber}`
    : "สำนักงานใหญ่";
}

export function vatLabel(item: QuotationCalculation["lines"][number]) {
  if (item.vatTreatment === "taxable") return `${item.vatRate}%`;
  if (item.vatTreatment === "exempt") return "ยกเว้น";
  return "";
}

export function SignerSlot({
  compact,
  issueDate,
  label,
  showDate,
  showName,
  signer,
}: {
  compact: boolean;
  issueDate: string;
  label: string;
  showDate: boolean;
  showName: boolean;
  signer: QuotationDocumentViewModel["certification"]["issuer"];
}) {
  return (
    <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]" data-document-signer>
      <p className="font-semibold">{label}</p>
      <div className={`flex items-end justify-center border-b ${compact ? "h-12" : "h-20"}`}>
        {signer.signatureUrl ? (
          <DocumentImage
            alt={`ลายเซ็น${label}`}
            className={`${compact ? "max-h-10" : "max-h-16"} w-full object-contain`}
            key={signer.signatureUrl}
            src={signer.signatureUrl}
          />
        ) : null}
      </div>
      {showName && signer.name ? <p>({signer.name})</p> : null}
      {showDate ? <p>วันที่ {issueDate}</p> : null}
    </div>
  );
}

export function Total({
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
