import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { canUseHospitalitySideBySideSettlement } from "../../../../lib/quotation-hospitality-layout";
import { isQuotationLayoutBlockBefore } from "../../../../lib/quotation-layout-renderer";
import { formatBaht, formatMoney } from "../../../../lib/quotation-money";
import { canKeepQuotationPdfItemTogether } from "../../../../lib/quotation-pdf";
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
  border: "#bac5d1",
  navy: "#142d4c",
  panel: "#f2f5f8",
  text: "#17283c",
};

const styles = StyleSheet.create({
  page: {
    color: colors.text,
    fontFamily: "Noto Sans Thai",
    fontSize: 8,
    paddingBottom: 28.35,
    paddingHorizontal: 28.35,
    paddingTop: 31,
  },
  topRule: {
    backgroundColor: colors.navy,
    height: 4,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  row: { flexDirection: "row" },
  bold: { fontWeight: 600 },
  grow: { flexBasis: 0, flexGrow: 1 },
  right: { textAlign: "right" },
  muted: { color: "#51606f" },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: 0.6,
    flexDirection: "row",
    paddingBottom: 7,
  },
  seller: { flexBasis: 0, flexGrow: 1, paddingRight: 16 },
  logo: { height: 32, marginBottom: 4, objectFit: "contain", width: 100 },
  titleBox: { width: 190 },
  title: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: 1.5,
    textAlign: "right",
  },
  badge: {
    backgroundColor: colors.navy,
    color: "#ffffff",
    fontSize: 7,
    marginLeft: "auto",
    marginTop: 4,
    padding: 4,
    textAlign: "center",
    width: 110,
  },
  details: { flexDirection: "row", marginTop: 8 },
  company: {
    borderColor: colors.border,
    borderWidth: 0.6,
    flexBasis: 0,
    flexGrow: 1,
    marginRight: 12,
    padding: 6,
  },
  metadata: {
    borderColor: colors.border,
    borderWidth: 0.6,
    padding: 6,
    width: 195,
  },
  detailRow: { flexDirection: "row", marginBottom: 1 },
  detailLabel: { fontWeight: 600, width: 64 },
  recipient: {
    backgroundColor: colors.panel,
    borderLeftColor: colors.navy,
    borderLeftWidth: 3,
    marginTop: 8,
    padding: 6,
  },
  table: { marginTop: 10 },
  tableHeader: {
    backgroundColor: colors.navy,
    color: "#ffffff",
    flexDirection: "row",
    fontWeight: 600,
    paddingVertical: 4,
  },
  tableRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 0.4,
    flexDirection: "row",
    paddingVertical: 4,
  },
  descriptionCell: { flexBasis: 0, flexGrow: 1, paddingHorizontal: 3 },
  qtyCell: { paddingHorizontal: 3, textAlign: "right", width: 44 },
  unitCell: { paddingHorizontal: 3, width: 40 },
  moneyCell: { paddingHorizontal: 3, textAlign: "right", width: 70 },
  discountCell: { paddingHorizontal: 3, textAlign: "right", width: 58 },
  vatCell: { paddingHorizontal: 3, textAlign: "right", width: 42 },
  itemDescription: { color: "#51606f", marginTop: 1 },
  summary: {
    borderBottomColor: colors.border,
    borderBottomWidth: 0.6,
    borderTopColor: colors.border,
    borderTopWidth: 0.6,
    marginTop: 8,
    paddingVertical: 6,
  },
  summarySideBySide: { flexDirection: "row" },
  summarySequential: { flexDirection: "column" },
  paymentColumn: { flexBasis: 0, flexGrow: 1, paddingRight: 12 },
  payment: { paddingVertical: 4 },
  paymentCore: { flexDirection: "row" },
  paymentLogo: { height: 30, marginRight: 8, objectFit: "contain", width: 30 },
  paymentQr: { height: 64, marginLeft: 8, objectFit: "contain", width: 64 },
  notes: { marginTop: 5 },
  settlement: {
    backgroundColor: colors.panel,
    borderColor: colors.navy,
    borderWidth: 0.8,
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
    padding: 6,
  },
  settlementSequential: { marginTop: 8, width: "100%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  grandTotal: {
    borderTopColor: colors.navy,
    borderTopWidth: 0.8,
    fontSize: 10,
    fontWeight: 600,
    marginTop: 3,
    paddingTop: 4,
  },
  certificationSection: {
    borderTopColor: colors.navy,
    borderTopWidth: 1.2,
    flexDirection: "row",
    marginTop: 6,
    paddingTop: 5,
  },
  certification: { flexDirection: "row" },
  sectionTitle: { color: colors.navy, fontWeight: 600, width: 48 },
  certificationSlot: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    textAlign: "center",
  },
  certificationAssetBox: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    marginBottom: 2,
  },
  certificationAssetBoxCompact: { height: 32 },
  signatureBox: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 0.6,
    height: 52,
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  signatureBoxCompact: { height: 32 },
  certificationImage: { height: 42, objectFit: "contain", width: "100%" },
  certificationImageCompact: { height: 28 },
});

export function CorporateQuotationPdf({
  images,
  model,
}: QuotationPdfRendererProps) {
  const { calculation, payload } = model;
  const theme = quotationThemePalette(payload.layout.config.themeColor);
  const themedSharedStyles = {
    ...styles,
    grandTotal: { ...styles.grandTotal, borderTopColor: theme.primary },
    signatureBox: { ...styles.signatureBox, borderBottomColor: theme.border },
  };
  const compactCertification =
    !model.showCertificationName && !model.showCertificationDate;
  const sellerOffice = office(payload.seller);
  const customerOffice = office(payload.customer);
  const sellerContact = [
    payload.seller.contactName,
    payload.seller.contactPhone,
    payload.seller.contactEmail,
  ]
    .filter(Boolean)
    .join(" | ");
  const canUseSideBySideSettlement = canUseHospitalitySideBySideSettlement({
    paymentMethodCount: model.paymentMethods.length,
    paymentContentLength: model.paymentMethods.reduce(
      (total, method) =>
        total +
        [
          method.accountName,
          method.accountNumber,
          method.bankName,
          method.customBankName,
          method.instructions,
          method.promptPayId,
          method.providerName,
        ].join("").length +
        (method.qrSource || method.customBankLogoUrl || method.bankLogoUrl
          ? 240
          : 0),
      0,
    ),
    hasPaymentQr: model.paymentMethods.some((method) =>
      Boolean(method.qrSource),
    ),
    publicNotesLength: payload.publicNotes.length,
  });
  const metadataIsLeft = isQuotationLayoutBlockBefore(
    model,
    "documentMetadata",
    "seller",
  );
  const summaryIsLeft = isQuotationLayoutBlockBefore(
    model,
    "summary",
    "paymentMethods",
  );
  const paymentBlock = payload.layout.config.blocks.find(
    (block) => block.id === "paymentMethods",
  );
  const summaryBlock = payload.layout.config.blocks.find(
    (block) => block.id === "summary",
  );

  return (
    <Document author={payload.seller.name} title={model.documentNumber}>
      <Page size="A4" style={styles.page} wrap>
        <View
          fixed
          style={[styles.topRule, { backgroundColor: theme.primary }]}
        />
        {/* data-pdf-header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.seller}>
            {image(images, payload.seller.logoUrl) ? (
              <PdfImage
                src={image(images, payload.seller.logoUrl)}
                style={styles.logo}
              />
            ) : null}
            <Text style={[styles.bold, { color: theme.dark, fontSize: 13 }]}>
              {payload.seller.name}
            </Text>
            <Text>{payload.seller.address}</Text>
            <Text>
              เลขที่ภาษี {payload.seller.taxId}
              {sellerOffice ? ` (${sellerOffice})` : ""}
            </Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.right}>(ต้นฉบับ)</Text>
            <Text style={[styles.title, { color: theme.primary }]}>
              QUOTATION
            </Text>
            <Text style={styles.right}>ใบเสนอราคา</Text>
            <Text
              style={[
                styles.badge,
                { backgroundColor: theme.primary, color: theme.contrast },
              ]}
            >
              {model.documentNumber}
            </Text>
          </View>
        </View>
        <View
          style={
            metadataIsLeft
              ? [styles.details, { flexDirection: "row-reverse" }]
              : styles.details
          }
          data-corporate-company-metadata
        >
          <View style={[styles.company, { borderColor: theme.border }]}>
            <Text style={[styles.bold, { color: theme.dark }]}>
              ข้อมูลผู้ขาย
            </Text>
            <Detail label="โทร" styles={styles} value={payload.seller.phone} />
            <Detail
              label="อีเมล"
              styles={styles}
              value={payload.seller.email}
            />
            <Detail
              label="เว็บไซต์"
              styles={styles}
              value={payload.seller.website}
            />
            {sellerContact ? (
              <Detail label="ผู้ติดต่อ" styles={styles} value={sellerContact} />
            ) : null}
          </View>
          <View style={[styles.metadata, { borderColor: theme.border }]}>
            <Detail
              label="เลขที่เอกสาร"
              styles={styles}
              value={model.documentNumber}
            />
            <Detail label="วันที่ออก" styles={styles} value={model.issueDate} />
            <Detail
              label="ใช้ได้ถึง"
              styles={styles}
              value={model.validUntil}
            />
            {model.showReference ? (
              <Detail
                label="อ้างอิง"
                styles={styles}
                value={payload.reference}
              />
            ) : null}
            {payload.subject ? (
              <Detail
                label="เรื่อง / ชื่องาน"
                styles={styles}
                value={payload.subject}
              />
            ) : null}
          </View>
        </View>
        {/* data-pdf-customer */}
        <View
          style={[
            styles.recipient,
            { backgroundColor: theme.light, borderLeftColor: theme.primary },
          ]}
          data-corporate-recipient
        >
          <Text style={[styles.bold, { color: theme.dark }]}>
            ผู้รับใบเสนอราคา
          </Text>
          <Text style={styles.bold}>{payload.customer.name}</Text>
          <Text>{payload.customer.address}</Text>
          {payload.customer.taxId ? (
            <Text>เลขที่ภาษี {payload.customer.taxId}</Text>
          ) : null}
          {customerOffice ? <Text>สำนักงาน {customerOffice}</Text> : null}
        </View>
        {/* data-pdf-items */}
        <View style={styles.table}>
          <View
            fixed
            style={[
              styles.tableHeader,
              { backgroundColor: theme.primary, color: theme.contrast },
            ]}
            wrap={false}
          >
            <Text style={styles.descriptionCell}>รายละเอียด</Text>
            <Text style={styles.qtyCell}>จำนวน</Text>
            {model.showUnit ? <Text style={styles.unitCell}>หน่วย</Text> : null}
            <Text style={styles.moneyCell}>ราคา</Text>
            {model.showItemDiscount ? (
              <Text style={styles.discountCell}>ส่วนลด</Text>
            ) : null}
            {model.showItemVat ? <Text style={styles.vatCell}>VAT</Text> : null}
            <Text style={styles.moneyCell}>มูลค่าก่อนภาษี</Text>
          </View>
          {calculation.lines.map((item) => (
            <View
              key={item.id}
              style={[styles.tableRow, { borderBottomColor: theme.border }]}
              wrap={
                !canKeepQuotationPdfItemTogether(item.name, item.description)
              }
            >
              <View style={styles.descriptionCell}>
                <Text style={styles.bold}>
                  {item.position}. {item.name}
                </Text>
                {item.description ? (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={styles.qtyCell}>{item.quantity}</Text>
              {model.showUnit ? (
                <Text style={styles.unitCell}>{item.unit}</Text>
              ) : null}
              <Text style={styles.moneyCell}>
                {formatMoney(item.unitPrice)}
              </Text>
              {model.showItemDiscount ? (
                <Text style={styles.discountCell}>
                  {formatMoney(item.discountAmount)}
                </Text>
              ) : null}
              {model.showItemVat ? (
                <Text style={styles.vatCell}>{vatLabel(item)}</Text>
              ) : null}
              <Text style={styles.moneyCell}>
                {formatMoney(item.preTaxAmount)}
              </Text>
            </View>
          ))}
        </View>
        {/* data-pdf-totals */}
        <View
          style={
            canUseSideBySideSettlement && summaryIsLeft
              ? [
                  styles.summary,
                  styles.summarySideBySide,
                  { flexDirection: "row-reverse" },
                ]
              : [
                  styles.summary,
                  canUseSideBySideSettlement
                    ? styles.summarySideBySide
                    : styles.summarySequential,
                ]
          }
        >
          <View
            style={
              canUseSideBySideSettlement
                ? [
                    styles.paymentColumn,
                    {
                      flexGrow: paymentBlock?.span ?? 7,
                      paddingLeft: summaryIsLeft ? 12 : 0,
                      paddingRight: summaryIsLeft ? 0 : 12,
                    },
                  ]
                : undefined
            }
          >
            {model.paymentMethods.length ? (
              <View data-pdf-payment-methods>
                <Text style={[styles.bold, { color: theme.dark }]}>
                  การชำระเงิน
                </Text>
                {model.paymentMethods.map((method) => (
                  <PaymentMethod
                    images={images}
                    key={method.id}
                    method={method}
                    styles={themedSharedStyles}
                  />
                ))}
              </View>
            ) : null}
            {model.showNotes ? (
              <View style={styles.notes} data-pdf-notes>
                <Text style={[styles.bold, { color: theme.dark }]}>
                  หมายเหตุ
                </Text>
                <Text>{payload.publicNotes}</Text>
              </View>
            ) : null}
          </View>
          <View
            wrap={false}
            style={
              canUseSideBySideSettlement
                ? [
                    styles.settlement,
                    {
                      backgroundColor: theme.light,
                      borderColor: theme.primary,
                      flexGrow: summaryBlock?.span ?? 5,
                    },
                  ]
                : [
                    styles.settlement,
                    styles.settlementSequential,
                    { backgroundColor: theme.light, borderColor: theme.primary },
                  ]
            }
            data-corporate-settlement
          >
            <Text style={[styles.bold, { color: theme.dark }]}>
              สรุปการชำระ
            </Text>
            <Total
              label="มูลค่ารวม"
              styles={themedSharedStyles}
              value={formatBaht(calculation.grossTotal)}
            />
            <Total
              label="ส่วนลด"
              styles={themedSharedStyles}
              value={formatBaht(calculation.discountTotal)}
            />
            {model.showPreTax ? (
              <Total
                label="มูลค่าก่อนภาษี"
                styles={themedSharedStyles}
                value={formatBaht(calculation.preTaxTotal)}
              />
            ) : null}
            {model.showTax ? (
              <Total
                label="ภาษีมูลค่าเพิ่ม"
                styles={styles}
                value={formatBaht(calculation.vatTotal)}
              />
            ) : null}
            <Total
              emphasized
              label="จำนวนเงินทั้งสิ้น"
              styles={themedSharedStyles}
              value={formatBaht(calculation.grandTotal)}
            />
            {model.showWithholdingTax ? (
              <Total
                label="หักภาษี ณ ที่จ่าย"
                styles={themedSharedStyles}
                value={formatBaht(calculation.withholdingTaxTotal)}
              />
            ) : null}
            <Total
              label="จำนวนเงินที่ชำระ"
              styles={themedSharedStyles}
              value={formatBaht(calculation.amountDue)}
            />
            <Text
              style={[
                styles.right,
                {
                  borderTopColor: theme.border,
                  borderTopWidth: 0.4,
                  marginTop: 4,
                  paddingTop: 4,
                },
              ]}
            >
              {model.amountInWords}
            </Text>
          </View>
        </View>
        {/* data-pdf-certification */}
        <View
          style={[styles.certificationSection, { borderTopColor: theme.primary }]}
          wrap={false}
        >
          <Text style={[styles.sectionTitle, { color: theme.dark }]}>รับรอง</Text>
          <View style={[styles.grow, styles.certification]}>
            {model.showCertificationQr ? (
              <View style={styles.certificationSlot}>
                {/* data-pdf-public-qr */}
                <Text style={styles.bold}>สแกนเพื่อเปิดด้วยเว็บไซต์</Text>
                <View
                  style={
                    compactCertification
                      ? [
                          styles.certificationAssetBox,
                          styles.certificationAssetBoxCompact,
                        ]
                      : styles.certificationAssetBox
                  }
                >
                  {image(images, model.publicQrDataUrl) ? (
                    <PdfImage
                      src={image(images, model.publicQrDataUrl)}
                      style={
                        compactCertification
                          ? [
                              styles.certificationImage,
                              styles.certificationImageCompact,
                            ]
                          : styles.certificationImage
                      }
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            <Signer
              compact={compactCertification}
              images={images}
              issueDate={model.issueDate}
              label="ผู้ออกเอกสาร"
              showDate={model.showCertificationDate}
              showName={model.showCertificationName}
              signer={model.certification.issuer}
              styles={themedSharedStyles}
            />
            <Signer
              compact={compactCertification}
              images={images}
              issueDate={model.issueDate}
              label="ผู้อนุมัติเอกสาร"
              showDate={model.showCertificationDate}
              showName={model.showCertificationName}
              signer={model.certification.approver}
              styles={themedSharedStyles}
            />
            <View style={styles.certificationSlot}>
              <Text style={styles.bold}>ตราประทับ</Text>
              <View
                style={
                  compactCertification
                    ? [
                        styles.certificationAssetBox,
                        styles.certificationAssetBoxCompact,
                      ]
                    : styles.certificationAssetBox
                }
              >
                {image(images, model.certification.companyStampUrl) ? (
                  <PdfImage
                    src={image(images, model.certification.companyStampUrl)}
                    style={
                      compactCertification
                        ? [
                            styles.certificationImage,
                            styles.certificationImageCompact,
                          ]
                        : styles.certificationImage
                    }
                  />
                ) : null}
              </View>
            </View>
            <View style={styles.certificationSlot}>
              <Text style={styles.bold}>ผู้รับเอกสาร (ลูกค้า)</Text>
              <View
                style={
                  compactCertification
                    ? [
                        themedSharedStyles.signatureBox,
                        styles.signatureBoxCompact,
                      ]
                    : themedSharedStyles.signatureBox
                }
              />
              {model.showCertificationName ? (
                <Text>{payload.customer.name}</Text>
              ) : null}
              {model.showCertificationDate ? (
                <Text>วันที่ ____________________</Text>
              ) : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
