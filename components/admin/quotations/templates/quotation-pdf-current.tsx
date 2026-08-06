import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatBaht, formatMoney } from "../../../../lib/quotation-money";
import { canKeepQuotationPdfItemTogether } from "../../../../lib/quotation-pdf";
import { isQuotationLayoutBlockBefore } from "../../../../lib/quotation-layout-renderer";
import { quotationThemePalette } from "../../../../lib/quotation-theme";

import type { QuotationPdfRendererProps } from "./quotation-pdf-contract";
import {
  Detail,
  image,
  office,
  PaymentMethod,
  Signer,
  Total,
  vatLabel,
} from "./quotation-pdf-shared";

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
  header: { flexDirection: "row" },
  headerDetails: {
    borderTopColor: colors.border,
    borderTopWidth: 0.6,
    flexDirection: "row",
    marginTop: 9,
    paddingTop: 9,
  },
  seller: { flexGrow: 1, flexBasis: 0, paddingRight: 16 },
  sellerDetails: { flexBasis: 0, flexGrow: 1 },
  sellerContact: { flexBasis: 82, marginLeft: 14 },
  sellerDetailLabel: { fontWeight: 600, width: 45 },
  metadataDetailLabel: { fontWeight: 600, width: 57 },
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
  settlement: {
    borderBottomColor: colors.border,
    borderBottomWidth: 0.6,
    borderTopColor: colors.border,
    borderTopWidth: 0.6,
    flexDirection: "row",
    marginTop: 12,
    paddingVertical: 9,
  },
  settlementSide: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  settlementContent: { paddingRight: 14 },
  settlementContentLeft: { paddingLeft: 14, paddingRight: 0 },
  summary: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  summaryHeading: { fontWeight: 600, marginBottom: 6 },
  summaryBreakdown: { borderTopColor: colors.border, borderTopWidth: 0.6, marginTop: 7, paddingTop: 7 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { backgroundColor: colors.light, borderRadius: 4, fontSize: 10, fontWeight: 600, marginBottom: 4, padding: 7 },
  payment: { paddingVertical: 7 },
  paymentCore: { flexDirection: "row" },
  paymentLogo: { height: 30, marginRight: 8, objectFit: "contain", width: 30 },
  paymentQr: { height: 78, marginLeft: 8, objectFit: "contain", width: 78 },
  notes: { minHeight: 36 },
  certification: { flexDirection: "row" },
  certificationSlot: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    textAlign: "center",
  },
  certificationAssetBox: {
    alignItems: "center",
    height: 60,
    justifyContent: "center",
    marginBottom: 3,
  },
  certificationAssetBoxCompact: { height: 36 },
  signatureBox: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 0.6, height: 60, justifyContent: "flex-end", marginBottom: 3 },
  signatureBoxCompact: { height: 36 },
  certificationImage: { height: 48, objectFit: "contain", width: "100%" },
  certificationImageCompact: { height: 32 },
});

function layoutFlex(model: QuotationPdfRendererProps["model"], id: "seller" | "documentMetadata") {
  const block = model.payload.layout.config.blocks.find((item) => item.id === id);
  return { flexBasis: 0, flexGrow: block?.span ?? 1 };
}

function DetailWithLabelWidth({
  label,
  labelStyle,
  value,
}: {
  label: string;
  labelStyle: typeof styles.sellerDetailLabel;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={styles.grow}>{value || "-"}</Text>
    </View>
  );
}

export function CurrentQuotationPdf({ images, model }: QuotationPdfRendererProps) {
  const { calculation, payload } = model;
  const compactCertification = !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  const metadataIsLeft = isQuotationLayoutBlockBefore(model, "documentMetadata", "seller");
  const summaryIsLeft = isQuotationLayoutBlockBefore(model, "summary", "paymentMethods");
  const paymentBlock = payload.layout.config.blocks.find((item) => item.id === "paymentMethods");
  const summaryBlock = payload.layout.config.blocks.find((item) => item.id === "summary");
  const theme = quotationThemePalette(payload.layout.config.themeColor);
  const themedSharedStyles = {
    ...styles,
    grandTotal: { ...styles.grandTotal, backgroundColor: theme.light },
    signatureBox: { ...styles.signatureBox, borderBottomColor: theme.border },
  };
  return (
    <Document author={payload.seller.name} title={model.documentNumber}>
      <Page size="A4" style={styles.page} wrap>
        {/* data-pdf-header */}
        <View style={styles.header}>
          <View style={styles.seller}>
            {image(images, payload.seller.logoUrl) ? <PdfImage src={image(images, payload.seller.logoUrl)} style={styles.logo} /> : null}
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.right}>(ต้นฉบับ)</Text>
            <Text style={[styles.title, { color: theme.primary }]}>ใบเสนอราคา</Text>
          </View>
        </View>
        <View style={metadataIsLeft ? [styles.headerDetails, { borderTopColor: theme.border, flexDirection: "row-reverse" }] : [styles.headerDetails, { borderTopColor: theme.border }]}>
          <View style={[styles.seller, layoutFlex(model, "seller")] }>
            <View style={styles.row}>
              <View style={styles.sellerDetails}>
                <DetailWithLabelWidth label="ผู้ขาย" labelStyle={styles.sellerDetailLabel} value={payload.seller.name} />
                <DetailWithLabelWidth label="ที่อยู่" labelStyle={styles.sellerDetailLabel} value={payload.seller.address} />
                <DetailWithLabelWidth label="เลขที่ภาษี" labelStyle={styles.sellerDetailLabel} value={`${payload.seller.taxId}${sellerOffice ? ` (${sellerOffice})` : ""}`} />
              </View>
              {(payload.seller.phone || payload.seller.email || payload.seller.website) ? <View style={styles.sellerContact}>
                {payload.seller.phone ? <Text>{payload.seller.phone}</Text> : null}
                {payload.seller.email ? <Text>{payload.seller.email}</Text> : null}
                {payload.seller.website ? <Text>{payload.seller.website}</Text> : null}
              </View> : null}
            </View>
          </View>
          <View style={[styles.metadata, layoutFlex(model, "documentMetadata"), { backgroundColor: theme.light }] }>
            <DetailWithLabelWidth label="เลขที่เอกสาร" labelStyle={styles.metadataDetailLabel} value={model.documentNumber} />
            <DetailWithLabelWidth label="วันที่ออก" labelStyle={styles.metadataDetailLabel} value={model.issueDate} />
            <DetailWithLabelWidth label="ใช้ได้ถึง" labelStyle={styles.metadataDetailLabel} value={model.validUntil} />
            {model.showReference ? <DetailWithLabelWidth label="อ้างอิง" labelStyle={styles.metadataDetailLabel} value={payload.reference} /> : null}
            {payload.subject ? <DetailWithLabelWidth label="เรื่อง / ชื่องาน" labelStyle={styles.metadataDetailLabel} value={payload.subject} /> : null}
          </View>
        </View>

        {/* data-pdf-customer */}
        <View style={styles.customer}>
          <Detail label="ลูกค้า" styles={styles} value={payload.customer.name} />
          <Detail label="ที่อยู่" styles={styles} value={payload.customer.address} />
          {payload.customer.taxId ? <Detail label="เลขที่ภาษี" styles={styles} value={payload.customer.taxId} /> : null}
          {office(payload.customer) ? <Detail label="สำนักงาน" styles={styles} value={office(payload.customer)} /> : null}
        </View>

        {/* data-pdf-items */}
        <View style={styles.table} wrap>
          <View style={[styles.tableHeader, { backgroundColor: theme.light }]} wrap={false}>
            <Text style={styles.descriptionCell}>คำอธิบาย</Text>
            <Text style={styles.qtyCell}>จำนวน</Text>
            {model.showUnit ? <Text style={styles.unitCell}>หน่วย</Text> : null}
            <Text style={styles.moneyCell}>ราคา</Text>
            {model.showItemDiscount ? <Text style={styles.discountCell}>ส่วนลด</Text> : null}
            {model.showItemVat ? <Text style={styles.vatCell}>VAT</Text> : null}
            <Text style={styles.moneyCell}>มูลค่าก่อนภาษี</Text>
          </View>
          {calculation.lines.map((item) => (
            <View
              key={item.id}
              style={styles.tableRow}
              wrap={!canKeepQuotationPdfItemTogether(item.name, item.description)}
            >
              <View style={styles.descriptionCell}>
                <Text style={styles.bold}>{item.position}. {item.name}</Text>
                {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
              </View>
              <Text style={styles.qtyCell}>{item.quantity}</Text>
              {model.showUnit ? <Text style={styles.unitCell}>{item.unit}</Text> : null}
              <Text style={styles.moneyCell}>{formatMoney(item.unitPrice)}</Text>
              {model.showItemDiscount ? <Text style={styles.discountCell}>{formatMoney(item.discountAmount)}</Text> : null}
              {model.showItemVat ? <Text style={styles.vatCell}>{vatLabel(item)}</Text> : null}
              <Text style={styles.moneyCell}>{formatMoney(item.preTaxAmount)}</Text>
            </View>
          ))}
        </View>

        {/* data-pdf-totals */}
        <View
          data-pdf-totals
          style={summaryIsLeft ? [styles.settlement, { borderBottomColor: theme.border, borderTopColor: theme.border, flexDirection: "row-reverse" }] : [styles.settlement, { borderBottomColor: theme.border, borderTopColor: theme.border }]}
        >
          <View style={[styles.settlementSide, { flexGrow: paymentBlock?.span ?? 8 }, summaryIsLeft ? styles.settlementContentLeft : styles.settlementContent]}>
            {model.paymentMethods.length ? (
              <View data-pdf-payment-methods>
                <Text style={styles.sectionTitle}>ชำระเงิน</Text>
                {model.paymentMethods.map((method) => <PaymentMethod images={images} key={method.id} method={method} styles={styles} />)}
              </View>
            ) : null}
            {model.showNotes ? <View style={model.paymentMethods.length ? [styles.notes, styles.summaryBreakdown] : styles.notes} data-pdf-notes>
              <Text style={styles.sectionTitle}>หมายเหตุ</Text>
              <Text>{payload.publicNotes}</Text>
            </View> : null}
          </View>
          <View style={[styles.summary, { flexGrow: summaryBlock?.span ?? 4 }]} wrap={false}>
            <Text style={styles.summaryHeading}>สรุป</Text>
            <Total emphasized label="จำนวนเงินทั้งสิ้น" styles={themedSharedStyles} value={formatBaht(calculation.grandTotal)} />
            {model.showWithholdingTax ? <Total label="หักภาษี ณ ที่จ่าย" styles={themedSharedStyles} value={formatBaht(calculation.withholdingTaxTotal)} /> : null}
            <Total label="จำนวนเงินที่ชำระ" styles={themedSharedStyles} value={formatBaht(calculation.amountDue)} />
            <View style={[styles.summaryBreakdown, { borderTopColor: theme.border }]}>
              {model.showPreTax ? <Total label="มูลค่าก่อนภาษี" styles={styles} value={formatBaht(calculation.preTaxTotal)} /> : null}
              {model.showTax ? <Total label="ภาษีมูลค่าเพิ่ม" styles={styles} value={formatBaht(calculation.vatTotal)} /> : null}
              <Text style={styles.muted}>{model.amountInWords}</Text>
            </View>
          </View>
        </View>

        {/* data-pdf-certification */}
        <View style={[styles.row, { paddingVertical: 8 }]} wrap={false}>
          <Text style={styles.sectionTitle}>รับรอง</Text>
          <View style={[styles.grow, styles.certification]}>
            {model.showCertificationQr ? (
              <View style={styles.certificationSlot}>
                {/* data-pdf-public-qr */}
                <Text style={styles.bold}>สแกนเพื่อเปิดด้วยเว็บไซต์</Text>
                <View style={compactCertification
                  ? [styles.certificationAssetBox, styles.certificationAssetBoxCompact]
                  : styles.certificationAssetBox}>
                  {image(images, model.publicQrDataUrl) ? (
                    <PdfImage
                      src={image(images, model.publicQrDataUrl)}
                      style={compactCertification
                        ? [styles.certificationImage, styles.certificationImageCompact]
                        : styles.certificationImage}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            <Signer compact={compactCertification} images={images} issueDate={model.issueDate} label="ผู้ออกเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.issuer} styles={styles} />
            <Signer compact={compactCertification} images={images} issueDate={model.issueDate} label="ผู้อนุมัติเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.approver} styles={styles} />
            <View style={styles.certificationSlot}>
              <Text style={styles.bold}>ตราประทับ</Text>
              <View style={compactCertification
                ? [styles.certificationAssetBox, styles.certificationAssetBoxCompact]
                : styles.certificationAssetBox}>
                {image(images, model.certification.companyStampUrl) ? (
                  <PdfImage
                    src={image(images, model.certification.companyStampUrl)}
                    style={compactCertification
                      ? [styles.certificationImage, styles.certificationImageCompact]
                      : styles.certificationImage}
                  />
                ) : null}
              </View>
            </View>
            <View style={styles.certificationSlot}>
              <Text style={styles.bold}>ผู้รับเอกสาร (ลูกค้า)</Text>
              <View style={compactCertification
                ? [styles.signatureBox, styles.signatureBoxCompact]
                : styles.signatureBox} />
              {model.showCertificationName ? <Text>{payload.customer.name}</Text> : null}
              {model.showCertificationDate ? <Text>วันที่ ____________________</Text> : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
