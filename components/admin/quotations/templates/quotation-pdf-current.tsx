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

export function CurrentQuotationPdf({ images, model }: QuotationPdfRendererProps) {
  const { calculation, payload } = model;
  const compactCertification = !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  const metadataIsLeft = isQuotationLayoutBlockBefore(model, "documentMetadata", "seller");
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
            <Text style={styles.title}>ใบเสนอราคา</Text>
          </View>
        </View>
        <View style={metadataIsLeft ? [styles.row, { flexDirection: "row-reverse", paddingVertical: 8 }] : [styles.row, { paddingVertical: 8 }]}>
          <View style={[styles.seller, layoutFlex(model, "seller")] }>
            <Detail label="ผู้ขาย" styles={styles} value={payload.seller.name} />
            <Detail label="ที่อยู่" styles={styles} value={payload.seller.address} />
            <Detail label="เลขที่ภาษี" styles={styles} value={`${payload.seller.taxId}${sellerOffice ? ` (${sellerOffice})` : ""}`} />
            {payload.seller.phone ? <Detail label="โทร" styles={styles} value={payload.seller.phone} /> : null}
            {payload.seller.email ? <Detail label="อีเมล" styles={styles} value={payload.seller.email} /> : null}
            {payload.seller.website ? <Detail label="เว็บไซต์" styles={styles} value={payload.seller.website} /> : null}
          </View>
          <View style={[styles.metadata, layoutFlex(model, "documentMetadata")] }>
            <Detail label="เลขที่เอกสาร" styles={styles} value={model.documentNumber} />
            <Detail label="วันที่ออก" styles={styles} value={model.issueDate} />
            <Detail label="ใช้ได้ถึง" styles={styles} value={model.validUntil} />
            {model.showReference ? <Detail label="อ้างอิง" styles={styles} value={payload.reference} /> : null}
            {payload.subject ? <Detail label="เรื่อง / ชื่องาน" styles={styles} value={payload.subject} /> : null}
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
        <View style={styles.table}>
          <View fixed style={styles.tableHeader} wrap={false}>
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
        <View style={[styles.section, styles.totals]} wrap={false}>
          <Text style={styles.sectionTitle}>สรุป</Text>
          <View style={styles.totalsWords}>
            {model.showPreTax ? <Total label="มูลค่าก่อนภาษี" styles={styles} value={formatBaht(calculation.preTaxTotal)} /> : null}
            {model.showTax ? <Total label="ภาษีมูลค่าเพิ่ม" styles={styles} value={formatBaht(calculation.vatTotal)} /> : null}
            <Text style={styles.muted}>{model.amountInWords}</Text>
          </View>
          <View style={styles.totalsBox}>
            <Total emphasized label="จำนวนเงินทั้งสิ้น" styles={styles} value={formatBaht(calculation.grandTotal)} />
            {model.showWithholdingTax ? <Total label="หักภาษี ณ ที่จ่าย" styles={styles} value={formatBaht(calculation.withholdingTaxTotal)} /> : null}
            <Total label="จำนวนเงินที่ชำระ" styles={styles} value={formatBaht(calculation.amountDue)} />
          </View>
        </View>

        {/* data-pdf-payment-methods */}
        {model.paymentMethods.length ? (
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>ชำระเงิน</Text>
              <View style={styles.grow}>
                {model.paymentMethods.map((method) => <PaymentMethod images={images} key={method.id} method={method} styles={styles} />)}
              </View>
            </View>
          </View>
        ) : null}

        {/* data-pdf-notes */}
        {model.showNotes ? <View style={[styles.section, styles.row, styles.notes]}>
          <Text style={styles.sectionTitle}>หมายเหตุ</Text>
          <Text style={styles.grow}>{payload.publicNotes}</Text>
        </View> : null}

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
