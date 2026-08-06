import {
  Image as PdfImage,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import type { QuotationCalculation } from "../../../../lib/quotation-calculator";
import type { QuotationDocumentViewModel } from "../../../../lib/quotation-document-view";
import { PAYMENT_ACCOUNT_TYPE_LABELS } from "../../../../lib/quotation-payment-methods";
import type { OfficeType } from "../../../../lib/quotation-types";

import type { ResolvedImages } from "./quotation-pdf-contract";

export interface QuotationPdfSharedStyles {
  bold: Style;
  certificationImage: Style;
  certificationImageCompact: Style;
  certificationSlot: Style;
  detailLabel: Style;
  detailRow: Style;
  grandTotal: Style;
  grow: Style;
  muted: Style;
  payment: Style;
  paymentCore: Style;
  paymentLogo: Style;
  paymentQr: Style;
  right: Style;
  signatureBox: Style;
  signatureBoxCompact: Style;
  totalRow: Style;
}

export function image(images: ResolvedImages, source: string): string | undefined {
  return source ? images[source] : undefined;
}

export function Detail({
  label,
  styles,
  value,
}: {
  label: string;
  styles: QuotationPdfSharedStyles;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.grow}>{value || "-"}</Text>
    </View>
  );
}

export function Total({
  emphasized = false,
  label,
  styles,
  value,
}: {
  emphasized?: boolean;
  label: string;
  styles: QuotationPdfSharedStyles;
  value: string;
}) {
  return (
    <View style={emphasized ? [styles.totalRow, styles.grandTotal] : styles.totalRow}>
      <Text>{label}</Text>
      <Text style={styles.right}>{value}</Text>
    </View>
  );
}

export function office(value: { branchNumber: string; officeType: OfficeType }) {
  if (value.officeType === "unspecified") return "";
  return value.officeType === "branch" ? `สาขา ${value.branchNumber}` : "สำนักงานใหญ่";
}

export function vatLabel(item: QuotationCalculation["lines"][number]) {
  if (item.vatTreatment === "taxable") return `${item.vatRate}%`;
  if (item.vatTreatment === "exempt") return "ยกเว้น";
  return "";
}

function paymentTitle(method: QuotationDocumentViewModel["paymentMethods"][number]) {
  if (method.type === "bank_transfer") return method.customBankName || method.bankName;
  if (method.type === "promptpay") return "พร้อมเพย์";
  if (method.type === "cash") return "เงินสด";
  return method.providerName;
}

export function PaymentMethod({
  images,
  method,
  styles,
}: {
  images: ResolvedImages;
  method: QuotationDocumentViewModel["paymentMethods"][number];
  styles: QuotationPdfSharedStyles;
}) {
  const logoSource = method.customBankLogoUrl || method.bankLogoUrl;
  const accountType = method.accountType ? PAYMENT_ACCOUNT_TYPE_LABELS[method.accountType] : "";
  return (
    <View style={styles.payment}>
      <View style={styles.paymentCore} wrap={false}>
        {image(images, logoSource) ? <PdfImage src={image(images, logoSource)} style={styles.paymentLogo} /> : null}
        <View style={styles.grow}>
          <Text style={styles.bold}>{paymentTitle(method)}</Text>
          {method.type === "bank_transfer" ? (
            <>
              <Text>{[accountType, method.accountNumber].filter(Boolean).join(" ")}</Text>
              <Text>{method.accountName}</Text>
            </>
          ) : null}
          {method.type === "promptpay" ? (
            <>
              <Text>{method.promptPayId}</Text>
              <Text>{method.accountName}</Text>
            </>
          ) : null}
          {method.qrMode === "auto_promptpay" && !method.qrSource ? <Text style={styles.muted}>ไม่สามารถสร้าง QR ได้</Text> : null}
        </View>
        {image(images, method.qrSource) ? <PdfImage src={image(images, method.qrSource)} style={styles.paymentQr} /> : null}
      </View>
      {method.instructions ? <Text style={styles.muted}>{method.instructions}</Text> : null}
    </View>
  );
}

export function Signer({
  compact,
  images,
  issueDate,
  label,
  showDate,
  showName,
  signer,
  styles,
}: {
  compact: boolean;
  images: ResolvedImages;
  issueDate: string;
  label: string;
  showDate: boolean;
  showName: boolean;
  signer: QuotationDocumentViewModel["certification"]["issuer"];
  styles: QuotationPdfSharedStyles;
}) {
  return (
    <View style={styles.certificationSlot}>
      <Text style={styles.bold}>{label}</Text>
      <View style={compact ? [styles.signatureBox, styles.signatureBoxCompact] : styles.signatureBox}>
        {image(images, signer.signatureUrl) ? (
          <PdfImage
            src={image(images, signer.signatureUrl)}
            style={compact
              ? [styles.certificationImage, styles.certificationImageCompact]
              : styles.certificationImage}
          />
        ) : null}
      </View>
      {showName && signer.name ? <Text>({signer.name})</Text> : null}
      {showDate ? <Text>วันที่ {issueDate}</Text> : null}
    </View>
  );
}
