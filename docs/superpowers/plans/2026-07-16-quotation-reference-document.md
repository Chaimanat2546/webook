# Quotation Reference Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Format quotation money with thousands separators, adapt the shared A4 document to the approved PDF-derived hierarchy, and print only the saved document without an unintended blank page.

**Architecture:** Add one dependency-free string formatter for exact money display and grouped-input normalization. Keep `QuotationDocument` as the single Preview/Print/Public composition, and mount its saved print instance through a body-level React portal so the editor is removed from print layout rather than merely hidden.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS, existing shadcn inputs/dialogs, Node test runner, browser print CSS.

## Global Constraints

- Preserve canonical calculation, payload, RPC, and database money strings without commas.
- Format currency output with comma grouping and exactly two decimals.
- Group only money inputs; quantity and percentage fields keep current behavior.
- Accept `19900` and `19,900`, then display `19,900.00` after blur.
- Do not silently reinterpret malformed grouping such as `1,00`.
- Preview, Print, and Public Read-only must continue to share `QuotationDocument`.
- Print must use the latest saved payload, never an unsaved draft.
- Support real multi-page documents; do not hide blank pages by clipping overflow or forcing a fixed body height.
- Do not add QR codes, payment methods, signatures, stamps, workflow, PDF download, database fields, dependencies, or a second document component.
- Preserve the existing uncommitted change in `docs/quotation-management.md`; inspect and stage documentation hunks deliberately.
- Follow the approved spec at `docs/superpowers/specs/2026-07-16-quotation-reference-document-design.md`.

---

### Task 1: Exact Money Formatting And Grouped Money Inputs

**Files:**
- Create: `lib/quotation-money.ts`
- Create: `tests/quotation-money.test.ts`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `components/admin/quotations/quotation-list.tsx`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: `normalizeMoneyInput(value: string): string | null`.
- Produces: `formatMoney(value: string): string`.
- Produces: `formatBaht(value: string): string`.
- Extends: `Numeric` with `grouped?: boolean`; valid grouped edits emit canonical values while the control owns its focused display text.

- [ ] **Step 1: Write the failing formatter tests**

Create `tests/quotation-money.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatBaht,
  formatMoney,
  normalizeMoneyInput,
} from "../lib/quotation-money.ts";

describe("quotation money presentation", () => {
  it("groups exact decimal strings without floating point", () => {
    assert.equal(formatMoney("0"), "0.00");
    assert.equal(formatMoney("19900"), "19,900.00");
    assert.equal(formatMoney("19900.5"), "19,900.50");
    assert.equal(formatMoney("999999999999.99"), "999,999,999,999.99");
    assert.equal(formatBaht("19900.5"), "19,900.50 บาท");
  });

  it("normalizes only valid grouped or ungrouped money input", () => {
    assert.equal(normalizeMoneyInput("19900"), "19900");
    assert.equal(normalizeMoneyInput("19,900.50"), "19900.50");
    assert.equal(normalizeMoneyInput(""), "");
    assert.equal(normalizeMoneyInput("1,00"), null);
    assert.equal(normalizeMoneyInput("19,900.123"), null);
    assert.equal(normalizeMoneyInput("19,900x"), null);
  });
});
```

- [ ] **Step 2: Add failing UI contract assertions**

Add this test inside the existing `quotation UI` suite:

```ts
it("uses exact grouped money presentation and grouped money inputs", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const list = source("../components/admin/quotations/quotation-list.tsx");
  const price = editor.slice(
    editor.indexOf("function ItemPriceControls"),
    editor.indexOf("function ItemDiscountControls"),
  );
  const discount = editor.slice(
    editor.indexOf("function ItemDiscountControls"),
    editor.indexOf("function ItemVatControls"),
  );
  const vat = editor.slice(
    editor.indexOf("function ItemVatControls"),
    editor.indexOf("export function QuotationEditor"),
  );

  assert.match(editor, /import \{ formatBaht, formatMoney, normalizeMoneyInput \}/);
  assert.match(editor, /grouped\?: boolean/);
  assert.match(editor, /onBlur=\{handleBlur\}/);
  assert.match(price, /<Numeric[\s\S]*?grouped[\s\S]*?field=\{`items\.\$\{index\}\.unitPrice`\}/);
  assert.match(discount, /<Numeric[\s\S]*?grouped[\s\S]*?field=\{`items\.\$\{index\}\.discountAmount`\}/);
  assert.doesNotMatch(vat, /\bgrouped\b/);
  assert.match(list, /formatBaht\(quotation\.grandTotal\)/);
  assert.doesNotMatch(list, /Intl\.NumberFormat|Number\(value\)/);
});
```

Place the `grouped` prop before `field` on both money controls so the source-level contract stays narrow and readable.

- [ ] **Step 3: Run the new tests and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-money.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because `lib/quotation-money.ts`, grouped `Numeric`, and shared list formatting do not exist.

- [ ] **Step 4: Implement the exact string formatter**

Create `lib/quotation-money.ts`:

```ts
const MONEY_INPUT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/;

export function normalizeMoneyInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!MONEY_INPUT.test(trimmed)) return null;
  return trimmed.replaceAll(",", "");
}

export function formatMoney(value: string): string {
  const normalized = normalizeMoneyInput(value);
  if (normalized === null || normalized === "") return value;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${fraction.padEnd(2, "0")}`;
}

export function formatBaht(value: string): string {
  return `${formatMoney(value)} บาท`;
}
```

Do not use `Number`, floating point, or `Intl.NumberFormat` for exact money strings.

- [ ] **Step 5: Extend the existing input path without a new component**

In `components/admin/quotations/quotation-editor.tsx`, import the formatter and extend `TextInput` with optional `onBlur` and `onFocus` callbacks passed directly to `<Input>`:

```ts
import { formatBaht, formatMoney, normalizeMoneyInput } from "../../../lib/quotation-money";
```

```tsx
function TextInput({
  disabled,
  error,
  field,
  inputClassName,
  inputMode,
  label,
  onBlur,
  onChange,
  onFocus,
  size = "fluid",
  value,
}: {
  disabled?: boolean;
  error?: string;
  field: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onChange: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  size?: FieldSize;
  value: string;
}) {
```

Add these props to the existing `<Input>`:

```tsx
onBlur={onBlur}
onFocus={onFocus}
```

Replace the existing `Numeric` with this implementation while retaining the current labelled and unlabelled rendering branches:

```tsx
function Numeric({
  disabled,
  error,
  field,
  grouped = false,
  inputClassName,
  label,
  onChange,
  size = "fluid",
  value,
}: {
  disabled?: boolean;
  error?: string;
  field: string;
  grouped?: boolean;
  inputClassName?: string;
  label?: string;
  onChange: (value: string) => void;
  size?: FieldSize;
  value: string;
}) {
  const [displayValue, setDisplayValue] = useState(
    grouped && value ? formatMoney(value) : value,
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplayValue(grouped && value ? formatMoney(value) : value);
  }, [focused, grouped, value]);

  function handleChange(next: string) {
    if (!grouped) return onChange(next);
    setDisplayValue(next);
    const normalized = normalizeMoneyInput(next);
    onChange(normalized === null ? next : normalized);
  }

  function handleBlur() {
    setFocused(false);
    if (!grouped) return;
    const normalized = normalizeMoneyInput(displayValue);
    if (normalized === null || normalized === "") return;
    onChange(normalized);
    setDisplayValue(formatMoney(normalized));
  }

  const input = (
    <Input
      aria-invalid={Boolean(error)}
      aria-label={label ?? field}
      className={controlClassName(size, inputClassName)}
      data-field={field}
      disabled={disabled}
      inputMode="decimal"
      onBlur={handleBlur}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={() => setFocused(true)}
      value={grouped ? displayValue : value}
    />
  );

  return label ? (
    <Field error={undefined} field={field} label={label}>
      {input}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </Field>
  ) : (
    <>
      {input}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </>
  );
}
```

Set `grouped` only on `ItemPriceControls` and `ItemDiscountControls`:

```tsx
<Numeric
  grouped
  error={errors[`items.${index}.unitPrice`]}
  field={`items.${index}.unitPrice`}
  label={labelled ? "ราคา" : undefined}
  onChange={(value) => onUpdate("unitPrice", value)}
  size="money"
  value={item.unitPrice}
/>
```

```tsx
<Numeric
  grouped
  error={errors[`items.${index}.discountAmount`]}
  field={`items.${index}.discountAmount`}
  label={labelled ? "ส่วนลด" : undefined}
  onChange={(value) => onUpdate("discountAmount", value)}
  size="money"
  value={item.discountAmount}
/>
```

Do not set `grouped` on quantity, VAT rate, validity days, or withholding percentage.

- [ ] **Step 6: Replace editor and list money output**

Replace the editor-local raw money function with:

```ts
const money = (value?: string) => (value ? formatBaht(value) : "—");
```

Format the item pre-tax value with `formatBaht`:

```tsx
{props.calculation?.lines[index]?.preTaxAmount
  ? formatBaht(props.calculation.lines[index]!.preTaxAmount)
  : "—"}
```

In `quotation-list.tsx`, remove the local `Intl.NumberFormat` and import `formatBaht`. Replace both list/card calls with:

```tsx
{formatBaht(quotation.grandTotal)}
```

- [ ] **Step 7: Verify GREEN and commit the formatter slice**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-money.test.ts tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-service.test.ts
npm.cmd run typecheck
git diff --check
```

Expected: all commands exit `0`; malformed grouping remains invalid, and calculator/service behavior is unchanged.

Commit:

```powershell
git add -- lib/quotation-money.ts tests/quotation-money.test.ts tests/quotation-ui.test.ts components/admin/quotations/quotation-editor.tsx components/admin/quotations/quotation-list.tsx
git commit -m "feat: format quotation money values"
```

---

### Task 2: PDF-Derived Shared A4 Document

**Files:**
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: `formatMoney` and `formatBaht` from Task 1.
- Produces: one shared A4 document hierarchy for Preview, Print, and Public Read-only.
- Preserves: `QuotationDocument({ calculation, documentNumber, payload })`.

- [ ] **Step 1: Write the failing document contract test**

Add this test inside `quotation UI`:

```ts
it("adapts the shared A4 document to the approved quotation reference", () => {
  const document = source("../components/admin/quotations/quotation-document.tsx");

  assert.match(document, /import \{ formatBaht, formatMoney \}/);
  assert.match(document, /data-document-header/);
  assert.match(document, /data-document-metadata/);
  assert.match(document, /data-document-customer/);
  assert.match(document, /data-document-items/);
  assert.match(document, /data-document-summary/);
  assert.match(document, /bg-indigo-50/);
  assert.match(document, /table-fixed/);
  assert.match(document, /formatMoney\(item\.unitPrice\)/);
  assert.match(document, /formatMoney\(item\.preTaxAmount\)/);
  assert.match(document, /formatBaht\(calculation\.grandTotal\)/);
  assert.match(document, /whitespace-pre-line text-slate-500 \[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(document, /internalNotes|qrCode|signature|paymentMethod/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the current document lacks the approved sections, exact formatter, indigo surfaces, and fixed table composition.

- [ ] **Step 3: Add local display helpers and the shared formatter**

Import the Task 1 formatter:

```ts
import { formatBaht, formatMoney } from "../../../lib/quotation-money";
```

Add this date helper below `office`:

```ts
function documentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
```

This is presentation-only and does not change stored ISO dates.

- [ ] **Step 4: Replace the shared document composition**

Keep the existing function signature and conditional discount/VAT columns. Replace the article body with this structure:

```tsx
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
        <img
          alt="โลโก้ผู้ขาย"
          className="mb-4 max-h-16 max-w-40 object-contain"
          src={payload.seller.logoUrl}
        />
      ) : null}
      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="font-semibold">ผู้ขาย</dt>
        <dd className="font-semibold [overflow-wrap:anywhere]">{payload.seller.name}</dd>
        <dt className="font-semibold">ที่อยู่</dt>
        <dd className="whitespace-pre-line [overflow-wrap:anywhere]">{payload.seller.address}</dd>
        <dt className="font-semibold">เลขที่ภาษี</dt>
        <dd>{payload.seller.taxId} ({office(payload.seller)})</dd>
        {payload.seller.phone ? <><dt className="font-semibold">โทร</dt><dd>{payload.seller.phone}</dd></> : null}
        {payload.seller.email ? <><dt className="font-semibold">อีเมล</dt><dd className="[overflow-wrap:anywhere]">{payload.seller.email}</dd></> : null}
        {payload.seller.website ? <><dt className="font-semibold">เว็บไซต์</dt><dd className="[overflow-wrap:anywhere]">{payload.seller.website}</dd></> : null}
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
        <dt className="font-semibold">เลขที่เอกสาร</dt><dd>{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</dd>
        <dt className="font-semibold">วันที่ออก</dt><dd>{documentDate(payload.issueDate)}</dd>
        <dt className="font-semibold">ใช้ได้ถึง</dt><dd>{documentDate(payload.validUntil)}</dd>
        <dt className="font-semibold">อ้างอิง</dt><dd>{payload.reference || "-"}</dd>
      </dl>
      {payload.subject ? (
        <p className="mt-3 text-right [overflow-wrap:anywhere]">
          <span className="font-semibold">เรื่อง / ชื่องาน:</span> {payload.subject}
        </p>
      ) : null}
    </div>
  </header>

  <section className="mt-5 border-t pt-4" data-document-customer>
    <dl className="grid max-w-[125mm] grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="font-semibold">ลูกค้า</dt><dd className="font-semibold [overflow-wrap:anywhere]">{payload.customer.name}</dd>
      <dt className="font-semibold">ที่อยู่</dt><dd className="whitespace-pre-line [overflow-wrap:anywhere]">{payload.customer.address}</dd>
      {payload.customer.taxId ? <><dt className="font-semibold">เลขที่ภาษี</dt><dd>{payload.customer.taxId}</dd></> : null}
      <dt className="font-semibold">สำนักงาน</dt><dd>{office(payload.customer)}</dd>
    </dl>
  </section>

  <table className="mt-5 w-full table-fixed border-collapse" data-document-items>
    <thead>
      <tr className="bg-indigo-50 text-left">
        <th className="w-[6%] rounded-l-md p-2">#</th>
        <th className="p-2">คำอธิบาย</th>
        <th className="w-[9%] p-2 text-right">จำนวน</th>
        <th className="w-[8%] p-2">หน่วย</th>
        <th className="w-[14%] p-2 text-right">ราคา</th>
        {showItemDiscount ? <th className="w-[12%] p-2 text-right">ส่วนลด</th> : null}
        {showItemVat ? <th className="w-[8%] p-2 text-right">VAT</th> : null}
        <th className="w-[16%] rounded-r-md p-2 text-right">มูลค่าก่อนภาษี</th>
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
          <td className="p-2 text-right tabular-nums">{item.quantity}</td>
          <td className="p-2 [overflow-wrap:anywhere]">{item.unit}</td>
          <td className="p-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
          {showItemDiscount ? <td className="p-2 text-right tabular-nums">{formatMoney(item.discountAmount)}</td> : null}
          {showItemVat ? <td className="p-2 text-right">{item.vatTreatment === "taxable" ? `${item.vatRate}%` : item.vatTreatment === "exempt" ? "ยกเว้น" : "-"}</td> : null}
          <td className="p-2 text-right tabular-nums">{formatMoney(item.preTaxAmount)}</td>
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
        <><p className="font-semibold">หมายเหตุ</p><p className="whitespace-pre-line [overflow-wrap:anywhere]">{payload.publicNotes}</p></>
      ) : null}
    </div>
    <div className="space-y-1">
      <Total label="รวมก่อนส่วนลด" value={formatBaht(calculation.grossTotal)} />
      {calculation.discountTotal !== "0.00" ? <Total label="ส่วนลด" value={formatBaht(calculation.discountTotal)} /> : null}
      <Total label="มูลค่าก่อนภาษี" value={formatBaht(calculation.preTaxTotal)} />
      <Total label="VAT" value={formatBaht(calculation.vatTotal)} />
      <Total emphasized label="จำนวนเงินรวมทั้งสิ้น" value={formatBaht(calculation.grandTotal)} />
      <Total label="หักภาษี ณ ที่จ่าย" value={formatBaht(calculation.withholdingTaxTotal)} />
      <Total bold label="ยอดชำระ" value={formatBaht(calculation.amountDue)} />
      <p className="pt-2 text-right [overflow-wrap:anywhere]">{formatThaiBahtText(calculation.amountDue)}</p>
    </div>
  </section>
</article>
```

- [ ] **Step 5: Update the existing `Total` helper**

Replace it with:

```tsx
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
      ].filter(Boolean).join(" ")}
    >
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}
```

- [ ] **Step 6: Verify GREEN and commit the document slice**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-money.test.ts
node --import ./tests/register-server-only.mjs --test tests/quotation-public-share.test.ts
npm.cmd run typecheck
git diff --check
```

Expected: all commands exit `0`; Public Read-only still uses the shared document and no internal notes appear.

Commit:

```powershell
git add -- components/admin/quotations/quotation-document.tsx tests/quotation-ui.test.ts
git commit -m "style: align quotation document with reference"
```

---

### Task 3: Body-Level Print Isolation Without Blank Pages

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `app/globals.css`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: saved `lastSavedPayload`, `savedCalculation`, and `documentNumber`.
- Produces: body-level `[data-quotation-print]` portal active only during printing.
- Preserves: `printSaved()` action and `printOnLoad` behavior.

- [ ] **Step 1: Replace the old print assertions with a failing isolation contract**

Update the two print tests in `tests/quotation-ui.test.ts` to assert:

```ts
it("prints the saved document through an isolated body-level portal", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const css = source("../app/globals.css");

  assert.match(editor, /import \{ createPortal \} from "react-dom"/);
  assert.match(editor, /const \[isPrinting, setIsPrinting\] = useState\(false\)/);
  assert.match(editor, /setIsPrinting\(true\)/);
  assert.match(editor, /createPortal\(/[\s\S]*data-quotation-print[\s\S]*document\.body/);
  assert.match(editor, /window\.addEventListener\("afterprint", cleanup/);
  assert.match(editor, /setIsPrinting\(false\)/);
  assert.match(css, /body > :not\(\[data-quotation-print\]\)/);
  assert.match(css, /display: none !important/);
  assert.match(css, /thead \{ display: table-header-group/);
  assert.doesNotMatch(css, /body \* \{ visibility: hidden/);
  assert.doesNotMatch(css, /height: 297mm|overflow: hidden/);
});
```

Retain the existing assertions that `canPrint` requires a saved payload and that `QuotationDocument` excludes internal notes.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the existing hidden nested document and visibility-based CSS remain.

- [ ] **Step 3: Mount the print document through a portal**

In `quotation-editor.tsx`, import:

```ts
import { createPortal } from "react-dom";
```

Add state beside the existing dialog state:

```ts
const [isPrinting, setIsPrinting] = useState(false);
```

Replace `printSaved` with:

```ts
const printSaved = useCallback(() => {
  if (!canPrint) return;
  setIsPrinting(true);
}, [canPrint]);
```

Add this effect immediately after it:

```ts
useEffect(() => {
  if (!isPrinting) return;
  let finished = false;
  const printStyle = document.createElement("style");
  printStyle.textContent = "@page { size: A4; margin: 0; }";

  function cleanup() {
    if (finished) return;
    finished = true;
    document.documentElement.classList.remove("quotation-printing");
    printStyle.remove();
    setIsPrinting(false);
  }

  document.head.append(printStyle);
  document.documentElement.classList.add("quotation-printing");
  window.addEventListener("afterprint", cleanup, { once: true });
  const frame = window.requestAnimationFrame(() => window.print());
  const timeout = window.setTimeout(cleanup, 1_000);

  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timeout);
    window.removeEventListener("afterprint", cleanup);
    document.documentElement.classList.remove("quotation-printing");
    printStyle.remove();
  };
}, [isPrinting]);
```

Remove the existing always-mounted hidden `[data-quotation-print]` block. Add this portal at the end of the component JSX:

```tsx
{isPrinting && lastSavedPayload && savedCalculation
  ? createPortal(
      <div data-quotation-print>
        <QuotationDocument
          calculation={savedCalculation}
          documentNumber={documentNumber}
          payload={lastSavedPayload}
        />
      </div>,
      document.body,
    )
  : null}
```

The portal is a print host, not a second document component.

- [ ] **Step 4: Replace visibility-based print CSS**

Replace the quotation rules inside `@media print` with:

```css
@media print {
  html.quotation-printing body > :not([data-quotation-print]) {
    display: none !important;
  }
  html.quotation-printing [data-quotation-print] {
    display: block !important;
    width: 210mm;
    margin: 0;
  }
  [data-quotation-document] {
    margin: 0 !important;
  }
  [data-quotation-document] thead {
    display: table-header-group;
  }
  [data-quotation-document] tr,
  [data-quotation-document] section,
  [data-document-summary] {
    break-inside: avoid;
  }
}
```

Do not add a fixed print height or overflow clipping.

- [ ] **Step 5: Verify GREEN and commit the print slice**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test "tests/quotation-*.test.ts"
npm.cmd run typecheck
npm.cmd run lint
git diff --check
```

Expected: quotation tests and typecheck pass; lint has no errors. Existing unrelated `<img>` warnings may remain unchanged.

Commit:

```powershell
git add -- components/admin/quotations/quotation-editor.tsx app/globals.css tests/quotation-ui.test.ts
git commit -m "fix: isolate quotation print layout"
```

---

### Task 4: Documentation And Rendered Acceptance

**Files:**
- Modify: `docs/quotation-management.md`
- Modify: `docs/superpowers/specs/2026-07-16-quotation-reference-document-design.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: the completed formatter, shared document, and print-host behavior.
- Produces: verified MVP documentation and final implementation status.

- [ ] **Step 1: Update current behavior documentation without overwriting existing edits**

First inspect:

```powershell
git diff -- docs/quotation-management.md
```

Integrate these statements into the existing relevant sections while preserving every pre-existing unrelated line:

```markdown
- Money inputs accept grouped or ungrouped values and display comma grouping with two decimals after blur.
- Calculations and stored values remain canonical decimal strings without commas.
- Edit totals, Preview, Print, Public Read-only, and quotation lists group currency consistently.
- Preview, Print, and Public Read-only share the PDF-derived A4 document composition.
- Printing mounts only the latest saved document in an isolated print host, preventing editor layout from creating a blank page.
```

Do not add PDF download, QR, payment, or signature scope.

- [ ] **Step 2: Run the complete automated gate**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
```

Expected: every command exits `0`; lint may report only the previously accepted `<img>` warnings.

- [ ] **Step 3: Verify the grouped input interaction**

In authenticated Create/Edit:

1. Enter `19900` in unit price and blur; expect `19,900.00`.
2. Enter `19,900.50` and blur; expect `19,900.50` with live totals based on canonical `19900.50`.
3. Enable item discount, enter `1,000`, and blur; expect `1,000.00`.
4. Enter malformed `1,00`; confirm it is not converted to `100.00` and Save reports the existing field validation.
5. Confirm quantity, VAT rate, and withholding percentage do not gain money grouping.

- [ ] **Step 4: Compare the A4 document with the supplied PDF**

Using the same realistic saved quotation, capture A4 Preview and compare it beside `QO-2026070800002.pdf` at the same page scale. Confirm:

- seller/logo hierarchy, right-side title, pale metadata panel, customer block, table header, and lower-right summary follow the reference;
- only current MVP data appears;
- all currency cells use comma grouping and two decimals;
- long Thai and English text wraps without overlap;
- discount and VAT columns remain conditional;
- public notes show and internal notes do not.

Reject the comparison if either image is cropped, still loading, or shown at a different page scale.

- [ ] **Step 5: Verify Print and Public Read-only**

With the saved quotation:

1. Print from Edit and confirm Print Preview contains no unintended blank page.
2. Confirm a normal one-page quotation prints as one page.
3. Add enough saved items to produce a real second page; confirm the table header repeats and no content is clipped.
4. Open `/q/[token]` without login and confirm it uses the same A4 composition and grouped currency.
5. Confirm Print still uses the saved payload when a newer unsaved draft exists.

If the authenticated browser or native print preview is unavailable, record this rendered acceptance as blocked and do not mark the spec implemented.

- [ ] **Step 6: Mark verified status and progress**

Only after Steps 2-5 pass, change the spec status to:

```markdown
**Status:** Implemented and verified
```

Append to `.superpowers/sdd/progress.md`:

```markdown
## Quotation Reference Document (2026-07-16)

Plan: `docs/superpowers/plans/2026-07-16-quotation-reference-document.md`

- Task 1: complete (exact grouped money formatter and inputs)
- Task 2: complete (shared PDF-derived A4 document)
- Task 3: complete (body-level print isolation)
- Task 4: complete (automated and rendered acceptance)
```

- [ ] **Step 7: Commit documentation deliberately**

Inspect all three diffs before staging. If `docs/quotation-management.md` still includes a pre-existing unrelated edit that cannot be separated safely, stage only the intended hunk or leave that file unstaged and report it.

```powershell
git diff -- docs/quotation-management.md docs/superpowers/specs/2026-07-16-quotation-reference-document-design.md .superpowers/sdd/progress.md
git add -- docs/superpowers/specs/2026-07-16-quotation-reference-document-design.md .superpowers/sdd/progress.md
git add -p -- docs/quotation-management.md
git commit -m "docs: verify quotation document presentation"
```

---

## Completion Checklist

- [ ] Money outputs use exact comma grouping and two decimals without floating point.
- [ ] Unit price and fixed discount inputs accept grouped/un-grouped values and format on blur.
- [ ] Invalid grouping is not silently converted.
- [ ] Quantity and percentages remain unchanged.
- [ ] Preview, Print, and Public Read-only share the approved A4 document.
- [ ] The document follows the supplied PDF hierarchy using only current MVP data.
- [ ] Print contains no unintended blank page and supports real multi-page content.
- [ ] Print uses the last saved payload while Preview may use the current draft.
- [ ] No new dependency, database field, or out-of-scope document section is added.
- [ ] Focused tests, full tests, typecheck, lint, build, and diff checks pass.
- [ ] Same-scale A4 comparison, grouped-input interaction, native Print Preview, and Public Read-only checks pass.
- [ ] Documentation and progress reflect only behavior that was actually verified.
