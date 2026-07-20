# Quotation Certification Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Preview, Print, Public Read-only, and downloaded PDF render the approved compact five-slot certification row.

**Architecture:** Keep the existing shared HTML `QuotationDocument` for Preview, Print, and Public Read-only, and mirror the same ordering in the existing React PDF renderer. Reuse the current normalized document view model and image-loading paths; customer identification comes from `payload.customer.name`, so no schema, RPC, validator, or database change is needed.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, `@react-pdf/renderer`, Node.js test runner.

## Global Constraints

- The row order is: รับรอง | สแกนเพื่อเปิดด้วยเว็บไซต์ | ผู้ออกเอกสาร | ผู้อนุมัติเอกสาร | ตราประทับ | ผู้รับเอกสาร (ลูกค้า).
- The receiver displays the quotation customer name and leaves only signature and date blank.
- Do not display signer or receiver positions in this document section.
- Missing QR, signature, or stamp images keep a clean bounded slot and do not reorder the row.
- Keep the full certification row together during HTML Print and PDF pagination.
- Keep the fixed A4 five-column layout on Preview, Print, PDF, and Public Read-only; narrow Preview/Public screens continue to scroll the A4 document horizontally.
- Long signer and customer names must wrap inside their own column.
- Do not add dependencies, fields, migrations, RPC changes, or new abstractions.

---

### Task 1: Shared HTML Certification Row

**Files:**
- Modify: `tests/quotation-ui.test.ts:172-192`
- Modify: `components/admin/quotations/quotation-document.tsx:304-347`
- Modify: `components/admin/quotations/quotation-document.tsx:437-463`

**Interfaces:**
- Consumes: `QuotationDocumentViewModel.publicQrDataUrl`, `.issueDate`, `.certification`, and `.payload.customer.name` from `lib/quotation-document-view.ts`.
- Produces: one `data-document-certification` section containing `data-document-public-qr`, two `data-document-signer` slots, `data-document-stamp`, and `data-document-receiver` in that order.

- [ ] **Step 1: Replace the old HTML layout assertions with the approved five-slot contract**

Update the test body in `tests/quotation-ui.test.ts`:

```ts
it("renders one compact five-slot certification row", () => {
  const document = source("../components/admin/quotations/quotation-document.tsx");
  const imagePath = new URL("../components/admin/quotations/document-image.tsx", import.meta.url);

  assert.ok(existsSync(imagePath), "document image fallback should exist");
  const image = readFileSync(imagePath, "utf8");
  const certificationMarker = document.indexOf("data-document-certification");
  const certification = document.slice(
    document.lastIndexOf("<section", certificationMarker),
    document.indexOf("function PaymentMethod"),
  );
  const signer = document.slice(
    document.indexOf("function SignerSlot"),
    document.indexOf("function Total"),
  );

  assert.match(certification, /grid-cols-5/);
  assert.match(certification, /data-document-public-qr/);
  assert.match(certification, /สแกนเพื่อเปิดด้วยเว็บไซต์/);
  assert.equal(certification.match(/<SignerSlot/g)?.length, 2);
  assert.match(certification, /label="ผู้ออกเอกสาร"/);
  assert.match(certification, /label="ผู้อนุมัติเอกสาร"/);
  assert.match(certification, /data-document-stamp/);
  assert.match(certification, /data-document-receiver/);
  assert.match(certification, /ผู้รับเอกสาร \(ลูกค้า\)/);
  assert.match(certification, /model\.payload\.customer\.name/);
  assert.ok(certification.indexOf("data-document-public-qr") < certification.indexOf("data-document-stamp"));
  assert.ok(certification.indexOf("data-document-stamp") < certification.indexOf("data-document-receiver"));
  assert.doesNotMatch(certification, /ตำแหน่ง/);
  assert.doesNotMatch(signer, /signer\.position/);
  assert.match(certification, /break-inside-avoid/);
  assert.match(certification, /\[overflow-wrap:anywhere\]/);
  assert.match(certification, /<DocumentImage[\s\S]*?object-contain/);
  assert.doesNotMatch(document, /<(?:Input|input)[\s>]/);
  assert.match(image, /useState\(false\)/);
  assert.match(image, /onError=\{\(\) => setUnavailable\(true\)\}/);
  assert.match(image, /if \(unavailable\) return null/);
});
```

- [ ] **Step 2: Run the focused UI test and verify the new contract fails**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL in `renders one compact five-slot certification row` because the current renderer uses separate QR and three-column certification sections.

- [ ] **Step 3: Replace the separate QR/certification markup with one five-slot row**

Replace the current QR and certification sections in `quotation-document.tsx` with:

```tsx
<section
  className="break-inside-avoid grid grid-cols-[16mm_minmax(0,1fr)] gap-5 border-b py-3"
  data-document-certification
>
  <h2 className="flex items-start gap-1 font-semibold">
    <ReceiptText aria-hidden="true" className="mt-0.5 size-3" />
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
    <SignerSlot issueDate={model.issueDate} label="ผู้ออกเอกสาร" signer={model.certification.issuer} />
    <SignerSlot issueDate={model.issueDate} label="ผู้อนุมัติเอกสาร" signer={model.certification.approver} />
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
```

Update `SignerSlot` so long values stay bounded and positions are not rendered:

```tsx
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
```

- [ ] **Step 4: Run the focused UI test and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm run typecheck
```

Expected: the quotation UI test passes and TypeScript reports no errors.

- [ ] **Step 5: Commit the shared HTML renderer change**

```powershell
git add -- tests/quotation-ui.test.ts components/admin/quotations/quotation-document.tsx
git commit -m "feat: align quotation certification row"
```

---

### Task 2: Matching React PDF Certification Row

**Files:**
- Modify: `tests/quotation-pdf.test.ts:53-70`
- Modify: `components/admin/quotations/quotation-pdf.tsx:84-97`
- Modify: `components/admin/quotations/quotation-pdf.tsx:226-247`
- Modify: `components/admin/quotations/quotation-pdf.tsx:357-381`

**Interfaces:**
- Consumes: the same `QuotationDocumentViewModel` fields as Task 1 and the existing `ResolvedImages` lookup.
- Produces: one `data-pdf-certification` section with the Public QR marker inside it and the same five-slot order as the HTML renderer.

- [ ] **Step 1: Change the PDF source assertions to require the unified row**

Replace the certification/order test in `tests/quotation-pdf.test.ts` with:

```ts
it("keeps the approved order, paginated ledger, and five-slot certification row", () => {
  const sections = [
    "data-pdf-header",
    "data-pdf-customer",
    "data-pdf-items",
    "data-pdf-totals",
    "data-pdf-payment-methods",
    "data-pdf-notes",
    "data-pdf-certification",
  ];
  for (let index = 1; index < sections.length; index += 1) {
    assert.ok(pdfSource.indexOf(sections[index - 1]!) < pdfSource.indexOf(sections[index]!));
  }

  const certification = pdfSource.slice(
    pdfSource.indexOf("data-pdf-certification"),
    pdfSource.indexOf("style={styles.footer}"),
  );
  const signer = pdfSource.slice(
    pdfSource.indexOf("function Signer"),
    pdfSource.indexOf("function QuotationPdfDocument"),
  );

  assert.ok(certification.indexOf("data-pdf-public-qr") > -1);
  assert.match(certification, /สแกนเพื่อเปิดด้วยเว็บไซต์/);
  assert.match(certification, /ผู้ออกเอกสาร/);
  assert.match(certification, /ผู้อนุมัติเอกสาร/);
  assert.match(certification, /ตราประทับ/);
  assert.match(certification, /ผู้รับเอกสาร \(ลูกค้า\)/);
  assert.match(certification, /payload\.customer\.name/);
  assert.doesNotMatch(certification, /ตำแหน่ง/);
  assert.doesNotMatch(signer, /signer\.position/);
  assert.match(pdfSource, /fixed[\s\S]*render=\{\(\{ pageNumber, totalPages \}\)/);
  assert.match(certification, /wrap=\{false\}/);
});
```

- [ ] **Step 2: Run the focused PDF test and verify it fails**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts
```

Expected: FAIL because the QR is still before `data-pdf-certification`, positions are still rendered, and the receiver does not use the customer name.

- [ ] **Step 3: Replace PDF-only QR/certification styles with compact slot styles**

In the PDF `StyleSheet`, replace `publicQr`, `certification`, `certificationSlot`, `signatureBox`, `signature`, `receiverLine`, and `stamp` with:

```ts
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
signatureBox: {
  alignItems: "center",
  borderBottomColor: colors.border,
  borderBottomWidth: 0.6,
  height: 60,
  justifyContent: "flex-end",
  marginBottom: 3,
},
certificationImage: { height: 48, objectFit: "contain", width: "100%" },
```

- [ ] **Step 4: Stop rendering signer positions in the PDF**

Keep the current `Signer` signature and replace its return value with:

```tsx
return (
  <View style={styles.certificationSlot}>
    <Text style={styles.bold}>{label}</Text>
    <View style={styles.signatureBox}>
      {image(images, signer.signatureUrl) ? (
        <PdfImage src={image(images, signer.signatureUrl)} style={styles.certificationImage} />
      ) : null}
    </View>
    {signer.name ? <Text>({signer.name})</Text> : null}
    <Text>วันที่ {issueDate}</Text>
  </View>
);
```

- [ ] **Step 5: Render QR, signers, stamp, and receiver inside one unsplittable PDF section**

Replace the separate PDF QR/certification block with:

```tsx
{/* data-pdf-certification */}
<View style={[styles.section, styles.row]} wrap={false}>
  <Text style={styles.sectionTitle}>รับรอง</Text>
  <View style={[styles.grow, styles.certification]}>
    {/* data-pdf-public-qr */}
    <View style={styles.certificationSlot}>
      <Text style={styles.bold}>สแกนเพื่อเปิดด้วยเว็บไซต์</Text>
      <View style={styles.certificationAssetBox}>
        {image(images, model.publicQrDataUrl) ? (
          <PdfImage src={image(images, model.publicQrDataUrl)} style={styles.certificationImage} />
        ) : null}
      </View>
    </View>
    <Signer images={images} issueDate={model.issueDate} label="ผู้ออกเอกสาร" signer={model.certification.issuer} />
    <Signer images={images} issueDate={model.issueDate} label="ผู้อนุมัติเอกสาร" signer={model.certification.approver} />
    <View style={styles.certificationSlot}>
      <Text style={styles.bold}>ตราประทับ</Text>
      <View style={styles.certificationAssetBox}>
        {image(images, model.certification.companyStampUrl) ? (
          <PdfImage
            src={image(images, model.certification.companyStampUrl)}
            style={styles.certificationImage}
          />
        ) : null}
      </View>
    </View>
    <View style={styles.certificationSlot}>
      <Text style={styles.bold}>ผู้รับเอกสาร (ลูกค้า)</Text>
      <View style={styles.signatureBox} />
      <Text>{payload.customer.name}</Text>
      <Text>วันที่ __________________</Text>
    </View>
  </View>
</View>
```

- [ ] **Step 6: Run the focused PDF test and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts
npm run typecheck
```

Expected: the PDF tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the PDF renderer change**

```powershell
git add -- tests/quotation-pdf.test.ts components/admin/quotations/quotation-pdf.tsx
git commit -m "feat: align quotation PDF certification row"
```

---

### Task 3: Behavior Documentation And Final Verification

**Files:**
- Modify: `docs/quotation-management.md:123-136`

**Interfaces:**
- Consumes: the completed HTML and PDF document behavior from Tasks 1 and 2.
- Produces: current product documentation and evidence that all supported renderers still pass project checks.

- [ ] **Step 1: Update the quotation behavior documentation**

Replace the obsolete receiver/signing-slot bullets under `Certification, Public Share, And PDF` with:

```markdown
- Preview, Print, Public Read-only, and PDF show one compact certification row
  containing the Public QR, issuer, approver, company stamp, and customer
  receiver in that order.
- Issuer and approver show signature, name, and quotation issue date without
  position. The receiver shows the saved customer name and leaves signature
  and date blank for handwriting; no acceptance data is stored.
```

Change the PDF capability sentence from `three signing slots` to
`the compact five-slot certification row`.

- [ ] **Step 2: Run focused and full automated verification**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: every command exits with code 0.

- [ ] **Step 3: Verify Preview/Public layout at supported viewport widths**

With the local app running, inspect a saved quotation Preview and its `/q/{token}` Public Read-only page at widths 390, 768, 1280, and 1536 pixels. Confirm:

```text
- The A4 document scrolls horizontally at narrow widths without changing the printed five-slot order.
- The row order is QR, issuer, approver, stamp, receiver.
- Signer and receiver positions are absent.
- The receiver customer name wraps and signature/date remain blank.
- Missing optional signature/stamp images preserve alignment.
- Long unbroken names stay inside their slots.
```

- [ ] **Step 4: Verify downloaded PDF pagination and appearance**

Download a saved quotation PDF and render/inspect every page. Confirm:

```text
- The certification row follows notes and matches Preview/Public ordering.
- The five slots stay on one page and are not clipped.
- QR, signatures, and stamp preserve aspect ratio.
- No empty trailing page appears.
```

- [ ] **Step 5: Review the final diff for accidental scope expansion**

Run:

```powershell
git diff --check
git status --short
git diff --stat HEAD~2
```

Expected: only the two renderers, their two tests, and quotation documentation are changed by the implementation tasks; no schema, migration, dependency, or lockfile changes appear.

- [ ] **Step 6: Commit documentation and verification contract**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: describe quotation certification row"
```
