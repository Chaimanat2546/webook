import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { canUseHospitalitySideBySideSettlement } from "../../../../lib/quotation-hospitality-layout";
import { formatBaht, formatMoney } from "../../../../lib/quotation-money";
import { canKeepQuotationPdfItemTogether } from "../../../../lib/quotation-pdf";

import type { QuotationPdfRendererProps } from "./quotation-pdf-contract";
import { Detail, image, office, PaymentMethod, Signer, Total, vatLabel } from "./quotation-pdf-shared";

const colors = {
  accent: "#c79b58",
  border: "#b7d0c7",
  paper: "#fffdf8",
  primary: "#286a5b",
  text: "#17352d",
};

const styles = StyleSheet.create({
  page: { backgroundColor: colors.paper, color: colors.text, fontFamily: "Noto Sans Thai", fontSize: 8, paddingBottom: 28.35, paddingHorizontal: 28.35, paddingTop: 28.35 },
  topRule: { backgroundColor: colors.primary, height: 5, left: 0, position: "absolute", right: 0, top: 0 },
  row: { flexDirection: "row" },
  bold: { fontWeight: 600 },
  grow: { flexBasis: 0, flexGrow: 1 },
  right: { textAlign: "right" },
  muted: { color: "#5d7069" },
  header: { flexDirection: "row", paddingBottom: 10 },
  seller: { flexBasis: 0, flexGrow: 1, paddingRight: 16 },
  logo: { height: 36, marginBottom: 6, objectFit: "contain", width: 100 },
  titleBox: { width: 190 },
  title: { color: colors.primary, fontSize: 20, fontWeight: 600, letterSpacing: 1.5, textAlign: "right" },
  thaiTitle: { color: colors.accent, fontSize: 12, textAlign: "right" },
  recipient: { backgroundColor: "#fff8e9", borderColor: colors.accent, borderWidth: 0.7, borderRadius: 4, flexBasis: 0, flexGrow: 1, marginRight: 12, padding: 8 },
  metadata: { borderColor: colors.border, borderWidth: 0.6, borderRadius: 4, padding: 8, width: 195 },
  detailRow: { flexDirection: "row", marginBottom: 2 },
  detailLabel: { fontWeight: 600, width: 64 },
  table: { marginTop: 14 },
  tableLabel: { color: colors.primary, fontWeight: 600, marginBottom: 4 },
  tableHeader: { backgroundColor: colors.primary, color: "#ffffff", flexDirection: "row", fontWeight: 600, paddingVertical: 5 },
  tableRow: { borderBottomColor: colors.border, borderBottomWidth: 0.4, flexDirection: "row", paddingVertical: 5 },
  cell: { paddingHorizontal: 3 },
  descriptionCell: { flexBasis: 0, flexGrow: 1, paddingHorizontal: 3 },
  qtyCell: { paddingHorizontal: 3, textAlign: "right", width: 44 },
  unitCell: { paddingHorizontal: 3, width: 40 },
  moneyCell: { paddingHorizontal: 3, textAlign: "right", width: 70 },
  discountCell: { paddingHorizontal: 3, textAlign: "right", width: 58 },
  vatCell: { paddingHorizontal: 3, textAlign: "right", width: 42 },
  itemDescription: { color: "#5d7069", marginTop: 1 },
  summary: { borderBottomColor: colors.border, borderBottomWidth: 0.6, borderTopColor: colors.border, borderTopWidth: 0.6, marginTop: 12, paddingVertical: 9 },
  summarySideBySide: { flexDirection: "row" },
  summarySequential: { flexDirection: "column" },
  paymentColumn: { flexBasis: 0, flexGrow: 1, paddingRight: 12 },
  payment: { paddingVertical: 6 },
  paymentCore: { flexDirection: "row" },
  paymentLogo: { height: 30, marginRight: 8, objectFit: "contain", width: 30 },
  paymentQr: { height: 70, marginLeft: 8, objectFit: "contain", width: 70 },
  notes: { marginTop: 7 },
  settlement: { backgroundColor: colors.primary, borderRadius: 4, color: "#ffffff", padding: 8, width: 195 },
  settlementSequential: { marginTop: 8, width: "100%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { borderTopColor: colors.accent, borderTopWidth: 0.8, fontSize: 10, fontWeight: 600, marginTop: 4, paddingTop: 5 },
  certification: { flexDirection: "row" },
  certificationSection: { flexDirection: "row", paddingTop: 9 },
  sectionTitle: { color: colors.primary, fontWeight: 600, width: 48 },
  certificationSlot: { flexBasis: 0, flexGrow: 1, minWidth: 0, paddingHorizontal: 3, textAlign: "center" },
  certificationAssetBox: { alignItems: "center", height: 60, justifyContent: "center", marginBottom: 3 },
  certificationAssetBoxCompact: { height: 36 },
  signatureBox: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 0.6, height: 60, justifyContent: "flex-end", marginBottom: 3 },
  signatureBoxCompact: { height: 36 },
  certificationImage: { height: 48, objectFit: "contain", width: "100%" },
  certificationImageCompact: { height: 32 },
  footer: { borderTopColor: colors.accent, borderTopWidth: 0.7, marginTop: 10, paddingTop: 6 },
});

export function HospitalityQuotationPdf({ images, model }: QuotationPdfRendererProps) {
  const { calculation, payload } = model;
  const compactCertification = !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  const customerOffice = office(payload.customer);
  const sellerContact = [payload.seller.contactName, payload.seller.contactPhone, payload.seller.contactEmail].filter(Boolean).join(" | ");
  const canUseSideBySideSettlement = canUseHospitalitySideBySideSettlement({
    paymentMethodCount: model.paymentMethods.length,
    paymentContentLength: model.paymentMethods.reduce((total, method) => total + [method.accountName, method.accountNumber, method.bankName, method.customBankName, method.instructions, method.promptPayId, method.providerName].join("").length + (method.qrSource || method.customBankLogoUrl || method.bankLogoUrl ? 240 : 0), 0),
    hasPaymentQr: model.paymentMethods.some((method) => Boolean(method.qrSource)),
    publicNotesLength: payload.publicNotes.length,
  });

  return <Document author={payload.seller.name} title={model.documentNumber}>
    <Page size="A4" style={styles.page} wrap>
      <View fixed style={styles.topRule} />
      {/* data-pdf-header */}
      <View style={styles.header}>
        <View style={styles.seller}>
          {image(images, payload.seller.logoUrl) ? <PdfImage src={image(images, payload.seller.logoUrl)} style={styles.logo} /> : null}
          <Text style={[styles.bold, { color: colors.primary, fontSize: 13 }]}>{payload.seller.name}</Text>
          <Text>{payload.seller.address}</Text><Text>เลขที่ภาษี {payload.seller.taxId}{sellerOffice ? ` (${sellerOffice})` : ""}</Text>
        </View>
        <View style={styles.titleBox}><Text style={styles.right}>(ต้นฉบับ)</Text><Text style={styles.title}>QUOTATION</Text><Text style={styles.thaiTitle}>ใบเสนอราคา</Text></View>
      </View>
      {/* data-pdf-customer */}
      <View style={styles.row}>
        <View style={styles.recipient} data-hospitality-recipient><Text style={[styles.bold, { color: colors.primary }]}>สำหรับ</Text><Text style={styles.bold}>{payload.customer.name}</Text><Text>{payload.customer.address}</Text>{payload.customer.taxId ? <Text>เลขที่ภาษี {payload.customer.taxId}</Text> : null}{customerOffice ? <Text>สำนักงาน {customerOffice}</Text> : null}</View>
        <View style={styles.metadata}><Detail label="เลขที่เอกสาร" styles={styles} value={model.documentNumber} /><Detail label="วันที่ออก" styles={styles} value={model.issueDate} /><Detail label="ใช้ได้ถึง" styles={styles} value={model.validUntil} />{model.showReference ? <Detail label="อ้างอิง" styles={styles} value={payload.reference} /> : null}{payload.subject ? <Detail label="เรื่อง / ชื่องาน" styles={styles} value={payload.subject} /> : null}</View>
      </View>
      {/* data-pdf-items */}
      <View style={styles.table}><Text style={styles.tableLabel}>รายละเอียดที่พักและบริการ</Text><View fixed style={styles.tableHeader} wrap={false}><Text style={styles.descriptionCell}>รายละเอียด</Text><Text style={styles.qtyCell}>จำนวน</Text>{model.showUnit ? <Text style={styles.unitCell}>หน่วย</Text> : null}<Text style={styles.moneyCell}>ราคา</Text>{model.showItemDiscount ? <Text style={styles.discountCell}>ส่วนลด</Text> : null}{model.showItemVat ? <Text style={styles.vatCell}>VAT</Text> : null}<Text style={styles.moneyCell}>มูลค่าก่อนภาษี</Text></View>
        {calculation.lines.map((item) => <View key={item.id} style={styles.tableRow} wrap={!canKeepQuotationPdfItemTogether(item.name, item.description)}><View style={styles.descriptionCell}><Text style={styles.bold}>{item.position}. {item.name}</Text>{item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}</View><Text style={styles.qtyCell}>{item.quantity}</Text>{model.showUnit ? <Text style={styles.unitCell}>{item.unit}</Text> : null}<Text style={styles.moneyCell}>{formatMoney(item.unitPrice)}</Text>{model.showItemDiscount ? <Text style={styles.discountCell}>{formatMoney(item.discountAmount)}</Text> : null}{model.showItemVat ? <Text style={styles.vatCell}>{vatLabel(item)}</Text> : null}<Text style={styles.moneyCell}>{formatMoney(item.preTaxAmount)}</Text></View>)}
      </View>
      {/* data-pdf-totals */}
      <View style={[styles.summary, canUseSideBySideSettlement ? styles.summarySideBySide : styles.summarySequential]}>
        <View style={canUseSideBySideSettlement ? styles.paymentColumn : undefined}>{model.paymentMethods.length ? <View data-pdf-payment-methods><Text style={[styles.bold, { color: colors.primary }]}>การชำระเงิน</Text>{model.paymentMethods.map((method) => <PaymentMethod images={images} key={method.id} method={method} styles={styles} />)}</View> : null}{model.showNotes ? <View style={styles.notes} data-pdf-notes><Text style={[styles.bold, { color: colors.primary }]}>หมายเหตุ</Text><Text>{payload.publicNotes}</Text></View> : null}</View>
        <View wrap={false} style={canUseSideBySideSettlement ? styles.settlement : [styles.settlement, styles.settlementSequential]} data-hospitality-settlement><Text style={styles.bold}>สรุปการชำระ</Text><Total label="มูลค่ารวม" styles={styles} value={formatBaht(calculation.grossTotal)} /><Total label="ส่วนลด" styles={styles} value={formatBaht(calculation.discountTotal)} />{model.showPreTax ? <Total label="มูลค่าก่อนภาษี" styles={styles} value={formatBaht(calculation.preTaxTotal)} /> : null}{model.showTax ? <Total label="ภาษีมูลค่าเพิ่ม" styles={styles} value={formatBaht(calculation.vatTotal)} /> : null}<Total emphasized label="จำนวนเงินทั้งสิ้น" styles={styles} value={formatBaht(calculation.grandTotal)} />{model.showWithholdingTax ? <Total label="หักภาษี ณ ที่จ่าย" styles={styles} value={formatBaht(calculation.withholdingTaxTotal)} /> : null}<Total label="จำนวนเงินที่ชำระ" styles={styles} value={formatBaht(calculation.amountDue)} /><Text style={[styles.right, { borderTopColor: "#ffffff", borderTopWidth: 0.4, marginTop: 4, paddingTop: 4 }]}>{model.amountInWords}</Text></View>
      </View>
      {/* data-pdf-certification */}
      <View style={styles.certificationSection} wrap={false}><Text style={styles.sectionTitle}>รับรอง</Text><View style={[styles.grow, styles.certification]}>{model.showCertificationQr ? <View style={styles.certificationSlot}>{/* data-pdf-public-qr */}<Text style={styles.bold}>สแกนเพื่อเปิดด้วยเว็บไซต์</Text><View style={compactCertification ? [styles.certificationAssetBox, styles.certificationAssetBoxCompact] : styles.certificationAssetBox}>{image(images, model.publicQrDataUrl) ? <PdfImage src={image(images, model.publicQrDataUrl)} style={compactCertification ? [styles.certificationImage, styles.certificationImageCompact] : styles.certificationImage} /> : null}</View></View> : null}<Signer compact={compactCertification} images={images} issueDate={model.issueDate} label="ผู้ออกเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.issuer} styles={styles} /><Signer compact={compactCertification} images={images} issueDate={model.issueDate} label="ผู้อนุมัติเอกสาร" showDate={model.showCertificationDate} showName={model.showCertificationName} signer={model.certification.approver} styles={styles} /><View style={styles.certificationSlot}><Text style={styles.bold}>ตราประทับ</Text><View style={compactCertification ? [styles.certificationAssetBox, styles.certificationAssetBoxCompact] : styles.certificationAssetBox}>{image(images, model.certification.companyStampUrl) ? <PdfImage src={image(images, model.certification.companyStampUrl)} style={compactCertification ? [styles.certificationImage, styles.certificationImageCompact] : styles.certificationImage} /> : null}</View></View><View style={styles.certificationSlot}><Text style={styles.bold}>ผู้รับเอกสาร (ลูกค้า)</Text><View style={compactCertification ? [styles.signatureBox, styles.signatureBoxCompact] : styles.signatureBox} />{model.showCertificationName ? <Text>{payload.customer.name}</Text> : null}{model.showCertificationDate ? <Text>วันที่ ____________________</Text> : null}</View></View></View>
      <View style={styles.footer} data-pdf-seller-footer><Text style={[styles.bold, { color: colors.primary }]}>{payload.seller.name}</Text><Text>{payload.seller.address}</Text><Text>{[payload.seller.phone, payload.seller.email, payload.seller.website].filter(Boolean).join(" | ")}</Text>{sellerContact ? <Text>ผู้ติดต่อ: {sellerContact}</Text> : null}</View>
    </Page>
  </Document>;
}
