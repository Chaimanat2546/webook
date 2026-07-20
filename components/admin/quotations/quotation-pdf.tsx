import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import type { QuotationCalculation } from "../../../lib/quotation-calculator";
import {
  buildQuotationDocumentViewModel,
  type QuotationDocumentViewModel,
} from "../../../lib/quotation-document-view";
import { formatBaht, formatMoney } from "../../../lib/quotation-money";
import { PAYMENT_ACCOUNT_TYPE_LABELS } from "../../../lib/quotation-payment-methods";
import { splitQuotationPdfWord } from "../../../lib/quotation-pdf";
import type { QuotationPayload } from "../../../lib/quotation-types";

Font.register({
  family: "Noto Sans Thai",
  fonts: [
    { fontWeight: 400, src: "/fonts/NotoSansThai-Regular.ttf" },
    { fontWeight: 600, src: "/fonts/NotoSansThai-SemiBold.ttf" },
  ],
});

Font.registerHyphenationCallback(splitQuotationPdfWord);

const colors = {
  accent: "#6366f1",
  border: "#cbd5e1",
  light: "#eef2ff",
  muted: "#64748b",
  text: "#0f172a",
};

const styles = StyleSheet.create({
  page: {
    color: colors.text,
    fontFamily: "Noto Sans Thai",
    fontSize: 8,
    lineHeight: 1.45,
    paddingBottom: 36,
    paddingHorizontal: 28.35,
    paddingTop: 28.35,
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontWeight: 600 },
  muted: { color: colors.muted },
  right: { textAlign: "right" },
  section: { borderBottomColor: colors.border, borderBottomWidth: 0.6, paddingVertical: 8 },
  sectionTitle: { fontWeight: 600, width: 48 },
  grow: { flexGrow: 1, flexBasis: 0 },
  header: { borderBottomColor: colors.border, borderBottomWidth: 0.6, flexDirection: "row", paddingBottom: 10 },
  seller: { flexGrow: 1, flexBasis: 0, paddingRight: 16 },
  logo: { height: 36, marginBottom: 6, objectFit: "contain", width: 100 },
  titleBox: { width: 210 },
  title: { color: colors.accent, fontSize: 22, fontWeight: 600, marginBottom: 5, textAlign: "right" },
  metadata: { backgroundColor: colors.light, borderRadius: 4, padding: 7 },
  detailRow: { flexDirection: "row", marginBottom: 2 },
  detailLabel: { fontWeight: 600, width: 64 },
  customer: { paddingVertical: 8 },
  table: { marginTop: 2 },
  tableHeader: { backgroundColor: colors.light, flexDirection: "row", fontWeight: 600, paddingVertical: 5 },
  tableRow: { borderBottomColor: colors.border, borderBottomWidth: 0.4, flexDirection: "row", paddingVertical: 5 },
  cell: { paddingHorizontal: 3 },
  descriptionCell: { flexBasis: 0, flexGrow: 1, paddingHorizontal: 3 },
  qtyCell: { paddingHorizontal: 3, textAlign: "right", width: 44 },
  unitCell: { paddingHorizontal: 3, width: 40 },
  moneyCell: { paddingHorizontal: 3, textAlign: "right", width: 70 },
  discountCell: { paddingHorizontal: 3, textAlign: "right", width: 58 },
  vatCell: { paddingHorizontal: 3, textAlign: "right", width: 42 },
  itemDescription: { color: colors.muted, marginLeft: 13, marginTop: 1 },
  totals: { flexDirection: "row", paddingVertical: 9 },
  totalsWords: { flexGrow: 1, flexBasis: 0, paddingRight: 16 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { backgroundColor: colors.light, borderRadius: 4, fontSize: 10, fontWeight: 600, marginBottom: 4, padding: 7 },
  payment: { paddingVertical: 7 },
  paymentCore: { flexDirection: "row" },
  paymentLogo: { height: 30, marginRight: 8, objectFit: "contain", width: 30 },
  paymentQr: { height: 78, marginLeft: 8, objectFit: "contain", width: 78 },
  notes: { minHeight: 36 },
  publicQr: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 0.6, flexDirection: "row", paddingVertical: 8 },
  publicQrImage: { height: 58, marginRight: 10, objectFit: "contain", width: 58 },
  certification: { flexDirection: "row", paddingTop: 12 },
  certificationSlot: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 5, textAlign: "center" },
  signatureBox: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 0.6, height: 60, justifyContent: "flex-end", marginBottom: 3 },
  signature: { height: 48, objectFit: "contain", width: "100%" },
  receiverLine: { borderBottomColor: colors.border, borderBottomWidth: 0.6, height: 16 },
  stamp: { height: 48, marginLeft: "auto", marginRight: "auto", marginTop: 8, objectFit: "contain", width: 110 },
  footer: { bottom: 16, color: colors.muted, fontSize: 7, left: 28.35, position: "absolute", right: 28.35, textAlign: "center" },
});

type ResolvedImages = Record<string, string>;
type ImageConverter = (source: string) => Promise<string>;

export function collectQuotationPdfImageSources(
  model: QuotationDocumentViewModel,
): string[] {
  const { approver, companyStampUrl, issuer } = model.certification;
  return [...new Set([
    model.payload.seller.logoUrl,
    ...model.paymentMethods.flatMap((method) => [
      method.customBankLogoUrl || method.bankLogoUrl,
      method.qrSource,
    ]),
    issuer.signatureUrl,
    approver.signatureUrl,
    companyStampUrl,
    model.publicQrDataUrl,
  ].filter(Boolean))];
}

async function convertQuotationPdfImage(source: string): Promise<string> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load image (${response.status})`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode image"));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image is empty");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resolveQuotationPdfImages(
  sources: string[],
  convert: ImageConverter = convertQuotationPdfImage,
): Promise<ResolvedImages> {
  const entries = await Promise.all(sources.map(async (source) => {
    try {
      return [source, await convert(source)] as const;
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

function image(images: ResolvedImages, source: string): string | undefined {
  return source ? images[source] : undefined;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.grow}>{value || "-"}</Text>
    </View>
  );
}

function Total({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <View style={emphasized ? [styles.totalRow, styles.grandTotal] : styles.totalRow}>
      <Text>{label}</Text>
      <Text style={styles.right}>{value}</Text>
    </View>
  );
}

function office(value: { branchNumber: string; officeType: "branch" | "head_office" }) {
  return value.officeType === "branch" ? `สาขา ${value.branchNumber}` : "สำนักงานใหญ่";
}

function paymentTitle(method: QuotationDocumentViewModel["paymentMethods"][number]) {
  if (method.type === "bank_transfer") return method.customBankName || method.bankName;
  if (method.type === "promptpay") return "พร้อมเพย์";
  if (method.type === "cash") return "เงินสด";
  return method.providerName;
}

function PaymentMethod({
  images,
  method,
}: {
  images: ResolvedImages;
  method: QuotationDocumentViewModel["paymentMethods"][number];
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

function Signer({
  images,
  issueDate,
  label,
  signer,
}: {
  images: ResolvedImages;
  issueDate: string;
  label: string;
  signer: QuotationDocumentViewModel["certification"]["issuer"];
}) {
  return (
    <View style={styles.certificationSlot}>
      <Text style={styles.bold}>{label}</Text>
      <View style={styles.signatureBox}>
        {image(images, signer.signatureUrl) ? <PdfImage src={image(images, signer.signatureUrl)} style={styles.signature} /> : null}
      </View>
      {signer.name ? <Text>({signer.name})</Text> : null}
      {signer.position ? <Text>{signer.position}</Text> : null}
      <Text>วันที่ {issueDate}</Text>
    </View>
  );
}

function QuotationPdfDocument({
  images,
  model,
}: {
  images: ResolvedImages;
  model: QuotationDocumentViewModel;
}) {
  const { calculation, payload } = model;
  return (
    <Document author={payload.seller.name} title={model.documentNumber}>
      <Page size="A4" style={styles.page} wrap>
        {/* data-pdf-header */}
        <View style={styles.header}>
          <View style={styles.seller}>
            {image(images, payload.seller.logoUrl) ? <PdfImage src={image(images, payload.seller.logoUrl)} style={styles.logo} /> : null}
            <Detail label="ผู้ขาย" value={payload.seller.name} />
            <Detail label="ที่อยู่" value={payload.seller.address} />
            <Detail label="เลขที่ภาษี" value={`${payload.seller.taxId} (${office(payload.seller)})`} />
            {payload.seller.phone ? <Detail label="โทร" value={payload.seller.phone} /> : null}
            {payload.seller.email ? <Detail label="อีเมล" value={payload.seller.email} /> : null}
            {payload.seller.website ? <Detail label="เว็บไซต์" value={payload.seller.website} /> : null}
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.right}>(ต้นฉบับ)</Text>
            <Text style={styles.title}>ใบเสนอราคา</Text>
            <View style={styles.metadata}>
              <Detail label="เลขที่เอกสาร" value={model.documentNumber} />
              <Detail label="วันที่ออก" value={model.issueDate} />
              <Detail label="ใช้ได้ถึง" value={model.validUntil} />
              <Detail label="อ้างอิง" value={payload.reference} />
              {payload.subject ? <Detail label="เรื่อง / ชื่องาน" value={payload.subject} /> : null}
            </View>
          </View>
        </View>

        {/* data-pdf-customer */}
        <View style={styles.customer}>
          <Detail label="ลูกค้า" value={payload.customer.name} />
          <Detail label="ที่อยู่" value={payload.customer.address} />
          {payload.customer.taxId ? <Detail label="เลขที่ภาษี" value={payload.customer.taxId} /> : null}
          <Detail label="สำนักงาน" value={office(payload.customer)} />
        </View>

        {/* data-pdf-items */}
        <View style={styles.table}>
          <View fixed style={styles.tableHeader} wrap={false}>
            <Text style={styles.descriptionCell}>คำอธิบาย</Text>
            <Text style={styles.qtyCell}>จำนวน</Text>
            <Text style={styles.unitCell}>หน่วย</Text>
            <Text style={styles.moneyCell}>ราคา</Text>
            {model.showItemDiscount ? <Text style={styles.discountCell}>ส่วนลด</Text> : null}
            {model.showItemVat ? <Text style={styles.vatCell}>VAT</Text> : null}
            <Text style={styles.moneyCell}>มูลค่าก่อนภาษี</Text>
          </View>
          {calculation.lines.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.descriptionCell}>
                <Text style={styles.bold}>{item.position}. {item.name}</Text>
                {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
              </View>
              <Text style={styles.qtyCell}>{item.quantity}</Text>
              <Text style={styles.unitCell}>{item.unit}</Text>
              <Text style={styles.moneyCell}>{formatMoney(item.unitPrice)}</Text>
              {model.showItemDiscount ? <Text style={styles.discountCell}>{formatMoney(item.discountAmount)}</Text> : null}
              {model.showItemVat ? (
                <Text style={styles.vatCell}>
                  {item.vatTreatment === "taxable" ? `${item.vatRate}%` : item.vatTreatment === "exempt" ? "ยกเว้น" : "-"}
                </Text>
              ) : null}
              <Text style={styles.moneyCell}>{formatMoney(item.preTaxAmount)}</Text>
            </View>
          ))}
        </View>

        {/* data-pdf-totals */}
        <View style={[styles.section, styles.totals]} wrap={false}>
          <Text style={styles.sectionTitle}>สรุป</Text>
          <View style={styles.totalsWords}>
            <Total label="มูลค่าก่อนภาษี 7%" value={formatBaht(calculation.preTaxTotal)} />
            <Total label="ภาษีมูลค่าเพิ่ม 7%" value={formatBaht(calculation.vatTotal)} />
            <Text style={styles.muted}>{model.amountInWords}</Text>
          </View>
          <View style={styles.totalsBox}>
            <Total emphasized label="จำนวนเงินทั้งสิ้น" value={formatBaht(calculation.grandTotal)} />
            <Total label="หักภาษี ณ ที่จ่าย" value={formatBaht(calculation.withholdingTaxTotal)} />
            <Total label="จำนวนเงินที่ชำระ" value={formatBaht(calculation.amountDue)} />
          </View>
        </View>

        {/* data-pdf-payment-methods */}
        {model.paymentMethods.length ? (
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>ชำระเงิน</Text>
              <View style={styles.grow}>
                {model.paymentMethods.map((method) => <PaymentMethod images={images} key={method.id} method={method} />)}
              </View>
            </View>
          </View>
        ) : null}

        {/* data-pdf-notes */}
        <View style={[styles.section, styles.row, styles.notes]}>
          <Text style={styles.sectionTitle}>หมายเหตุ</Text>
          <Text style={styles.grow}>{payload.publicNotes}</Text>
        </View>

        <View>
          {/* data-pdf-public-qr */}
          {image(images, model.publicQrDataUrl) ? (
            <View style={styles.publicQr} wrap={false}>
              <PdfImage src={image(images, model.publicQrDataUrl)} style={styles.publicQrImage} />
              <Text>สแกนเพื่อดูเอกสารออนไลน์</Text>
            </View>
          ) : null}

          {/* data-pdf-certification */}
          <View style={styles.certification} wrap={false}>
            <Signer images={images} issueDate={model.issueDate} label="ผู้ออกเอกสาร" signer={model.certification.issuer} />
            <Signer images={images} issueDate={model.issueDate} label="ผู้อนุมัติ" signer={model.certification.approver} />
            <View style={styles.certificationSlot}>
              <Text style={styles.bold}>ผู้รับเอกสาร</Text>
              <View style={styles.signatureBox} />
              <Text>ชื่อ ____________________</Text>
              <Text>ตำแหน่ง __________________</Text>
              <Text>วันที่ ____________________</Text>
            </View>
          </View>
          {image(images, model.certification.companyStampUrl) ? (
            <PdfImage src={image(images, model.certification.companyStampUrl)} style={styles.stamp} />
          ) : null}
        </View>

        <Text
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          style={styles.footer}
        />
      </Page>
    </Document>
  );
}

export async function downloadQuotationPdf({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string;
  payload: QuotationPayload;
  publicQrDataUrl: string;
}): Promise<void> {
  const model = buildQuotationDocumentViewModel({ calculation, documentNumber, payload, publicQrDataUrl });
  const images = await resolveQuotationPdfImages(collectQuotationPdfImageSources(model));
  if (!images[model.publicQrDataUrl]) throw new Error("Public QR image is unavailable");
  const blob = await pdf(<QuotationPdfDocument images={images} model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentNumber}.pdf`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
