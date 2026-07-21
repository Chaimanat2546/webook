# Quotation Item Options And Schema Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace percentage/document discounts with optional fixed per-item discounts, make per-item VAT optional, show pre-tax item values, and reset the local quotation schema to the approved minimal columns.

**Architecture:** Keep one normalized `QuotationPayload` and one decimal-safe calculator shared by Create, Edit, Preview, Print, and Public Read-only. The editor keeps transient visibility state inferred from item values; only item discount/VAT values persist. A new Supabase migration truncates quotation data, removes obsolete columns, renames summary totals, and replaces the existing save/public RPC implementations without changing their public signatures or security boundary.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind, existing shadcn/Radix dropdown components, Node test runner, Supabase PostgreSQL/RLS.

## Global Constraints

- Treat `docs/superpowers/specs/2026-07-16-quotation-item-options-schema-cleanup-design.md` as the source of truth.
- Preserve all unrelated and pre-existing working-tree changes; stage only files named by each task.
- Do not edit an existing migration. Create the cleanup migration with `npx.cmd supabase migration new quotation_item_options_schema_cleanup`.
- Reset only `public.quotations`, its cascading `public.quotation_items`, and `private.quotation_number_counters`; never reset `public.quotation_company_profiles` or another module.
- Add no dependency and no persisted feature flags or settings JSON.
- Use fixed per-item discount amounts only. Document-level discount and VAT-inclusive price mode do not exist in the final application contract.
- The user-facing currency copy is `บาท`; there is no currency field or selector.
- Preserve permission checks, RLS, token-scoped Public Read-only, soft delete, document numbering, seller/customer snapshots, and saved-only share/print behavior.
- Keep the approved Gridgeist Document Workbench layout mobile-first. The House Workspace Shell does not apply because quotations are not a per-house workspace.
- Use the existing native `window.confirm` pattern only when disabling a feature would clear non-zero values.

---

## File Map

- `lib/quotation-types.ts` — final editor/service payload without currency, price mode, or document discount.
- `lib/quotation-calculator.ts` — fixed item discount, pre-tax item value, VAT, withholding, and summary totals.
- `server/services/quotations.ts` — trust-boundary normalization, field errors, default item values, and compact RPC payload.
- `server/repositories/quotations.ts` — map the compact database/public rows back into `QuotationPayload`.
- `components/admin/quotations/quotation-editor.tsx` — document settings dropdown, transient feature visibility, dynamic item grid, and revised totals.
- `components/admin/quotations/quotation-document.tsx` — conditional discount/VAT columns and pre-tax item values for Preview/Print/Public.
- `tests/quotation-calculator.test.ts` — money rules and rounding regression coverage.
- `tests/quotation-service.test.ts` — defaults, normalization, and validation coverage.
- `tests/quotation-ui.test.ts` — source-level UI contract for optional controls and removed fields.
- `tests/quotation-migration.test.ts` — static migration scope, schema, function, and security assertions.
- `tests/quotation-database-integration.test.ts` — local PostgreSQL persistence, constraints, RLS, and public read behavior.
- `supabase/migrations/*_quotation_item_options_schema_cleanup.sql` — CLI-generated cleanup migration; the timestamp is generated at execution time.
- `docs/quotation-management.md` — current operator/developer behavior and calculation rules.

---

### Task 1: Simplify The Application Contract, Calculator, And Document Workbench

**Files:**
- Modify: `lib/quotation-types.ts`
- Modify: `lib/quotation-calculator.ts`
- Modify: `server/services/quotations.ts`
- Modify: `server/repositories/quotations.ts`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `components/admin/quotations/quotation-document.tsx`
- Modify: `tests/quotation-calculator.test.ts`
- Modify: `tests/quotation-service.test.ts`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: `QuotationItemInput.discountAmount: string`.
- Produces: `QuotationLineCalculation.preTaxAmount`, `grossAmount`, `vatAmount`, and `lineTotal` as two-decimal strings.
- Produces: `QuotationCalculation.grossTotal`, `discountTotal`, `preTaxTotal`, `vatTotal`, `grandTotal`, `withholdingTaxTotal`, and `amountDue`.
- Produces: `QuotationPayload` without `currency`, `priceMode`, `documentDiscountType`, or `documentDiscountValue`.
- Produces: `PreparedQuotation.rpcPayload` with compact raw item values and camel-case summary totals consumed by Task 2.

- [ ] **Step 1: Replace calculator tests with the approved formulas**

Keep the Thai-baht-text, invalid numeric, and VAT-exclusive half-satang tests that still apply. Delete VAT-inclusive and unused VAT-grouping tests. Replace discount/document/price-mode cases with these exact cases:

```ts
function baseInput(
  overrides: Partial<QuotationCalculationInput> = {},
): QuotationCalculationInput {
  return {
    items: [{
      description: "",
      discountAmount: "500.00",
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "บริการ",
      position: 1,
      quantity: "2",
      unit: "งาน",
      unitPrice: "10000.00",
      vatRate: "7.00",
      vatTreatment: "taxable",
    }],
    withholdingTaxRate: null,
    ...overrides,
  };
}

it("calculates fixed item discount, pre-tax value, VAT, and grand total", () => {
  const result = calculateQuotation(baseInput());
  assert.equal(result.lines[0]!.grossAmount, "20000.00");
  assert.equal(result.lines[0]!.preTaxAmount, "19500.00");
  assert.equal(result.lines[0]!.vatAmount, "1365.00");
  assert.equal(result.lines[0]!.lineTotal, "20865.00");
  assert.equal(result.grossTotal, "20000.00");
  assert.equal(result.discountTotal, "500.00");
  assert.equal(result.preTaxTotal, "19500.00");
  assert.equal(result.vatTotal, "1365.00");
  assert.equal(result.grandTotal, "20865.00");
});

it("calculates withholding from the pre-tax total", () => {
  const result = calculateQuotation(baseInput({ withholdingTaxRate: "3.00" }));
  assert.equal(result.withholdingTaxTotal, "585.00");
  assert.equal(result.amountDue, "20280.00");
});

it("keeps exempt and no-VAT items at zero VAT", () => {
  const result = calculateQuotation(baseInput({
    items: [
      { ...baseInput().items[0]!, id: "exempt", vatRate: "0", vatTreatment: "exempt" },
      { ...baseInput().items[0]!, id: "none", vatRate: "0", vatTreatment: "none" },
    ],
  }));
  assert.equal(result.vatTotal, "0.00");
  assert.deepEqual(result.lines.map((line) => line.preTaxAmount), ["19500.00", "19500.00"]);
});

it("rejects a fixed discount above the item gross", () => {
  assert.throws(
    () => calculateQuotation(baseInput({
      items: [{ ...baseInput().items[0]!, discountAmount: "20000.01" }],
    })),
    /Discount cannot exceed item gross/,
  );
});
```

- [ ] **Step 2: Replace service and UI contract tests**

Change the test payload item to `discountAmount: "0"`; remove currency, price mode, and document-discount fields. Add these service assertions:

```ts
it("creates discount-off and VAT-off item defaults", () => {
  const payload = emptyQuotationPayload(
    validPayload().seller,
    new Date("2026-07-13T18:00:00.000Z"),
  );
  assert.equal(payload.items[0]!.discountAmount, "0");
  assert.equal(payload.items[0]!.vatTreatment, "none");
  assert.equal(payload.items[0]!.vatRate, "0");
});

it("accepts only a fixed item discount not above gross", () => {
  const valid = validPayload();
  valid.items[0]!.discountAmount = "500.00";
  assert.equal(prepareQuotationPayload(valid).payload.items[0]!.discountAmount, "500.00");

  valid.items[0]!.discountAmount = "10000.01";
  assert.throws(
    () => prepareQuotationPayload(valid),
    (error) => error instanceof QuotationValidationError
      && Boolean(error.fieldErrors["items.0.discountAmount"]),
  );
});

it("requires a zero rate for exempt and no-VAT items", () => {
  for (const vatTreatment of ["exempt", "none"] as const) {
    const value = validPayload();
    value.items[0] = { ...value.items[0]!, vatRate: "7", vatTreatment };
    assert.throws(
      () => prepareQuotationPayload(value),
      (error) => error instanceof QuotationValidationError
        && Boolean(error.fieldErrors["items.0.vatRate"]),
    );
  }
});
```

Replace stale UI assertions with the approved contract:

```ts
it("offers transient item discount and VAT document settings", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /ตั้งค่าเอกสาร/);
  assert.match(editor, /DropdownMenuCheckboxItem/);
  assert.match(editor, /ส่วนลดเฉพาะรายการ/);
  assert.match(editor, /VAT เฉพาะรายการ/);
  assert.match(editor, /items\.some\(\(item\) => Number\(item\.discountAmount\) > 0\)/);
  assert.match(editor, /items\.some\(\(item\) => item\.vatTreatment !== "none"\)/);
  assert.match(editor, /window\.confirm/);
});

it("uses fixed item discounts and pre-tax item values", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const document = source("../components/admin/quotations/quotation-document.tsx");
  assert.match(editor, /field=\{`items\.\$\{index\}\.discountAmount`\}/);
  assert.match(editor, /calculation\?\.lines\[index\]\?\.preTaxAmount/);
  assert.match(editor + document, /มูลค่าก่อนภาษี/);
  assert.doesNotMatch(editor + document, /documentDiscount|discountType|discountValue/);
  assert.doesNotMatch(editor, /<option value="percent">%<\/option>/);
});
```

- [ ] **Step 3: Run the focused tests and confirm they fail for the old contract**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-service.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because `discountAmount`, `preTaxAmount`, document settings, and the compact payload do not exist yet.

- [ ] **Step 4: Replace the shared TypeScript contracts**

Use these final interfaces in `lib/quotation-calculator.ts` and `lib/quotation-types.ts`:

```ts
export type VatTreatment = "exempt" | "none" | "taxable";

export interface QuotationItemInput {
  description: string;
  discountAmount: string;
  id: string;
  name: string;
  position: number;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

export interface QuotationCalculationInput {
  items: QuotationItemInput[];
  withholdingTaxRate: string | null;
}

export interface QuotationLineCalculation extends QuotationItemInput {
  grossAmount: string;
  lineTotal: string;
  preTaxAmount: string;
  vatAmount: string;
}

export interface QuotationCalculation {
  amountDue: string;
  discountTotal: string;
  grandTotal: string;
  grossTotal: string;
  lines: QuotationLineCalculation[];
  preTaxTotal: string;
  vatTotal: string;
  withholdingTaxTotal: string;
}

export interface QuotationPayload {
  customer: CustomerSnapshot;
  id: string | null;
  internalNotes: string;
  issueDate: string;
  items: QuotationItemInput[];
  publicNotes: string;
  reference: string;
  seller: SellerSnapshot;
  subject: string;
  validUntil: string;
  validityDays: string;
  withholdingTaxRate: string | null;
}
```

Delete `DiscountType`, `PriceMode`, document-discount allocation, and the proportional-allocation helper after `rg` confirms there are no intended callers.

- [ ] **Step 5: Implement the minimal calculator**

Keep the existing decimal parsing, rounding, VAT summary, and Thai-baht-text helpers. Replace `calculateQuotation` with the direct item path:

```ts
export function calculateQuotation(
  input: QuotationCalculationInput,
): QuotationCalculation {
  if (input.items.length === 0) throw new Error("Quotation requires at least one item");
  const withholdingRate = input.withholdingTaxRate === null
    ? ZERO
    : parseScaled(input.withholdingTaxRate, PERCENT_SCALE, "Withholding tax rate");
  if (withholdingRate > PERCENT_DENOMINATOR) {
    throw new Error("Withholding tax rate must be between 0 and 100");
  }

  const lines = input.items.map((item, index) => {
    const quantity = parseScaled(item.quantity, QUANTITY_SCALE, "Quantity");
    if (quantity <= ZERO) throw new Error("Quantity must be greater than zero");
    const gross = roundDiv(
      quantity * parseScaled(item.unitPrice, MONEY_SCALE, "Unit price"),
      tenPow(QUANTITY_SCALE),
    );
    const discount = parseScaled(item.discountAmount || "0", MONEY_SCALE, "Discount");
    if (discount > gross) {
      throw new Error(`Discount cannot exceed item gross for item ${index + 1}`);
    }
    const preTax = gross - discount;
    const rate = item.vatTreatment === "taxable"
      ? parseScaled(item.vatRate, PERCENT_SCALE, "VAT rate")
      : ZERO;
    if (rate > PERCENT_DENOMINATOR) throw new Error("VAT rate must be between 0 and 100");
    const vat = item.vatTreatment === "taxable"
      ? roundDiv(preTax * rate, PERCENT_DENOMINATOR)
      : ZERO;
    return {
      ...item,
      grossAmount: formatScaled(gross, MONEY_SCALE),
      lineTotal: formatScaled(preTax + vat, MONEY_SCALE),
      preTaxAmount: formatScaled(preTax, MONEY_SCALE),
      vatAmount: formatScaled(vat, MONEY_SCALE),
    };
  });

  const sum = (field: "discountAmount" | "grossAmount" | "lineTotal" | "preTaxAmount" | "vatAmount") =>
    lines.reduce(
      (total, line) => total + parseScaled(line[field], MONEY_SCALE, field),
      ZERO,
    );
  const grossTotal = sum("grossAmount");
  const discountTotal = sum("discountAmount");
  const preTaxTotal = sum("preTaxAmount");
  const vatTotal = sum("vatAmount");
  const grandTotal = sum("lineTotal");
  const withholdingTax = roundDiv(preTaxTotal * withholdingRate, PERCENT_DENOMINATOR);
  return {
    amountDue: formatScaled(grandTotal - withholdingTax, MONEY_SCALE),
    discountTotal: formatScaled(discountTotal, MONEY_SCALE),
    grandTotal: formatScaled(grandTotal, MONEY_SCALE),
    grossTotal: formatScaled(grossTotal, MONEY_SCALE),
    lines,
    preTaxTotal: formatScaled(preTaxTotal, MONEY_SCALE),
    vatTotal: formatScaled(vatTotal, MONEY_SCALE),
    withholdingTaxTotal: formatScaled(withholdingTax, MONEY_SCALE),
  };
}
```

- [ ] **Step 6: Normalize the compact payload at the server boundary**

In `emptyQuotationPayload`, use `discountAmount: "0"`, `vatTreatment: "none"`, and `vatRate: "0"`. In `prepareQuotationPayload`, remove currency, price mode, and document-discount parsing. Normalize each item with this rule:

```ts
const discountAmount = numeric(
  stringValue(item, "discountAmount") || "0",
  MONEY,
  `${prefix}.discountAmount`,
  errors,
);
const vatTreatment = enumValue(
  item.vatTreatment,
  ["exempt", "none", "taxable"],
  `${prefix}.vatTreatment`,
  errors,
  "none",
);
const vatRate = numeric(
  stringValue(item, "vatRate") || "0",
  PERCENT,
  `${prefix}.vatRate`,
  errors,
  true,
);
if (vatTreatment !== "taxable" && Number(vatRate) !== 0) {
  errors[`${prefix}.vatRate`] = "รายการที่ยกเว้นหรือไม่คิด VAT ต้องใช้อัตรา 0";
}
```

After calculating, build only this RPC shape:

```ts
items: calculation.lines.map((line) => ({
  description: line.description,
  discount_amount: line.discountAmount,
  name: line.name,
  position: line.position,
  quantity: line.quantity,
  unit: line.unit || null,
  unit_price: line.unitPrice,
  vat_rate: line.vatRate,
  vat_treatment: line.vatTreatment,
})),
totals: {
  amountDue: calculation.amountDue,
  discountTotal: calculation.discountTotal,
  grandTotal: calculation.grandTotal,
  grossTotal: calculation.grossTotal,
  preTaxTotal: calculation.preTaxTotal,
  vatTotal: calculation.vatTotal,
  withholdingTaxTotal: calculation.withholdingTaxTotal,
},
```

Map the one-based calculator error from Step 5 exactly at the service boundary:

```ts
const discountItem = /Discount cannot exceed item gross for item (\d+)/.exec(message);
const field = discountItem
  ? `items.${Number(discountItem[1]) - 1}.discountAmount`
  : /Quantity|Unit price|VAT|item/.test(message)
    ? "items"
    : "_form";
```

- [ ] **Step 7: Update repository row mapping**

Remove currency, price mode, document-discount, SKU, discount type, and discount value from `quotationSelect` and database row types. Read the item value directly:

```ts
quotation_items(
  id,position,name,description,quantity,unit,unit_price,
  discount_amount,vat_treatment,vat_rate
)
```

```ts
items: (row.quotation_items ?? [])
  .map((item) => ({
    description: stringValue(item.description),
    discountAmount: stringValue(item.discount_amount),
    id: stringValue(item.id),
    name: stringValue(item.name),
    position: Number(item.position),
    quantity: stringValue(item.quantity),
    unit: stringValue(item.unit),
    unitPrice: stringValue(item.unit_price),
    vatRate: stringValue(item.vat_rate),
    vatTreatment: vatTreatment(item.vat_treatment),
  }))
  .sort((left, right) => left.position - right.position),
```

Keep seller/company profile mapping, list pagination, save, soft delete, and public token lookup unchanged.
Change the VAT parser default to off:

```ts
function vatTreatment(value: unknown): VatTreatment {
  return value === "taxable" || value === "exempt" ? value : "none";
}
```

- [ ] **Step 8: Implement transient document settings and the dynamic item ledger**

Import the existing `DropdownMenuCheckboxItem`. Initialize local visibility from item data:

```ts
const [showItemDiscount, setShowItemDiscount] = useState(() =>
  initialPayload.items.some((item) => Number(item.discountAmount) > 0),
);
const [showItemVat, setShowItemVat] = useState(() =>
  initialPayload.items.some((item) => item.vatTreatment !== "none"),
);
```

Use these transitions:

```ts
function toggleItemDiscount(enabled: boolean) {
  if (!enabled && payload.items.some((item) => Number(item.discountAmount) > 0)
    && !window.confirm("การปิดส่วนลดเฉพาะรายการจะล้างส่วนลดทุกรายการ ต้องการดำเนินการต่อหรือไม่")) return;
  setShowItemDiscount(enabled);
  if (!enabled) {
    changed("items");
    setPayload((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, discountAmount: "0" })),
    }));
  }
}

function toggleItemVat(enabled: boolean) {
  if (!enabled && payload.items.some((item) => item.vatTreatment !== "none")
    && !window.confirm("การปิด VAT เฉพาะรายการจะล้างค่า VAT ทุกรายการ ต้องการดำเนินการต่อหรือไม่")) return;
  setShowItemVat(enabled);
  changed("items");
  setPayload((current) => ({
    ...current,
    items: current.items.map((item) => ({
      ...item,
      vatRate: enabled ? "7.00" : "0",
      vatTreatment: enabled ? "taxable" : "none",
    })),
  }));
}
```

Do not call `changed("items")` when merely showing an empty discount column. Add the settings menu beside `03 รายการ`:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="sm" type="button" variant="outline">ตั้งค่าเอกสาร</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuCheckboxItem
      checked={showItemDiscount}
      onCheckedChange={(checked) => toggleItemDiscount(checked === true)}
      onSelect={(event) => event.preventDefault()}
    >
      ส่วนลดเฉพาะรายการ
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem
      checked={showItemVat}
      onCheckedChange={(checked) => toggleItemVat(checked === true)}
      onSelect={(event) => event.preventDefault()}
    >
      VAT เฉพาะรายการ
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Pass `showItemDiscount` and `showItemVat` through `ItemProps`. Render `ItemDiscountControls` and `ItemVatControls` only when enabled. Replace the discount component with one `Numeric` bound to `discountAmount`; when VAT treatment changes to exempt/none, also set `vatRate` to `0`.

Use four static Tailwind grid-template literals selected by one helper so the header and rows share the same columns and Tailwind can detect every class. Do not reserve a blank discount or VAT track. Reorder desktop grid children with normal DOM order and `xl:order-last` for delete rather than duplicating controls.

Display:

```tsx
{props.calculation?.lines[index]?.preTaxAmount
  ? `${props.calculation.lines[index]!.preTaxAmount} บาท`
  : "—"}
```

New items use `discountAmount: "0"` and choose `taxable/7.00` only when `showItemVat` is true; otherwise use `none/0`.

- [ ] **Step 9: Replace document-level discount totals and document columns**

Delete `setDocumentDiscountEnabled` and the entire document-discount control row. Render the summary in this order:

```tsx
<Totals label="รวมก่อนส่วนลด" value={money(calculation?.grossTotal)} />
{calculation?.discountTotal !== "0.00" ? (
  <Totals label="ส่วนลด" value={money(calculation?.discountTotal)} />
) : null}
<Totals label="มูลค่าก่อนภาษี" value={money(calculation?.preTaxTotal)} />
<Totals label="VAT" value={money(calculation?.vatTotal)} />
<Totals bold label="จำนวนเงินรวมทั้งสิ้น" value={money(calculation?.grandTotal)} />
```

Keep withholding and amount due after these rows.

In `QuotationDocument`, derive saved feature usage from `payload.items`, conditionally render the `ส่วนลด` and `VAT` headers/cells, rename the final column to `มูลค่าก่อนภาษี (บาท)`, and display `item.preTaxAmount`. Use the same summary rows as the editor. Do not add feature props; deriving from the payload keeps Preview, Print, and Public consistent.

- [ ] **Step 10: Run application tests and static checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-calculator.test.ts tests/quotation-service.test.ts tests/quotation-ui.test.ts
npm run typecheck
npm run lint
```

Expected: all focused tests PASS, TypeScript exits `0`, and ESLint exits `0`.

- [ ] **Step 11: Commit the application slice**

```powershell
git add -- lib/quotation-types.ts lib/quotation-calculator.ts server/services/quotations.ts server/repositories/quotations.ts components/admin/quotations/quotation-editor.tsx components/admin/quotations/quotation-document.tsx tests/quotation-calculator.test.ts tests/quotation-service.test.ts tests/quotation-ui.test.ts
git commit -m "feat: simplify quotation item discounts and VAT"
```

---

### Task 2: Reset And Clean The Supabase Quotation Schema

**Files:**
- Create: `supabase/migrations/*_quotation_item_options_schema_cleanup.sql` using the Supabase CLI-generated timestamp
- Modify: `tests/quotation-migration.test.ts`
- Modify: `tests/quotation-database-integration.test.ts`

**Interfaces:**
- Consumes: compact `PreparedQuotation.rpcPayload` from Task 1.
- Produces: unchanged public RPC signatures `save_quotation(jsonb)` and `get_public_quotation(uuid)`.
- Produces: `quotations.gross_total`, `discount_total`, `pre_tax_total`, `vat_total`, `grand_total`, `withholding_tax_total`, and `amount_due`.
- Produces: compact `quotation_items` rows with raw input only.

- [ ] **Step 1: Add static migration expectations**

Load the new migration by suffix, matching the existing test style:

```ts
const cleanupName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_item_options_schema_cleanup.sql"));
assert.ok(cleanupName, "quotation schema cleanup migration must be created by the Supabase CLI");
const cleanupSql = readFileSync(
  new URL(`../supabase/migrations/${cleanupName}`, import.meta.url),
  "utf8",
);
```

Add one focused test:

```ts
it("resets only quotation data and installs the compact schema", () => {
  assert.match(cleanupSql, /truncate table public\.quotations cascade/i);
  assert.match(cleanupSql, /truncate table private\.quotation_number_counters/i);
  assert.doesNotMatch(cleanupSql, /truncate table public\.quotation_company_profiles/i);
  for (const column of ["currency", "price_mode", "document_discount_type", "document_discount_value", "document_discount_total"]) {
    assert.match(cleanupSql, new RegExp(`drop column ${column}`, "i"));
  }
  assert.match(cleanupSql, /rename column subtotal to gross_total/i);
  assert.match(cleanupSql, /rename column item_discount_total to discount_total/i);
  assert.match(cleanupSql, /rename column taxable_total to pre_tax_total/i);
  for (const column of ["sku", "discount_type", "discount_value", "document_discount_allocation", "gross_amount", "taxable_amount", "vat_amount", "line_total", "created_at", "updated_at"]) {
    assert.match(cleanupSql, new RegExp(`drop column ${column}`, "i"));
  }
  assert.match(cleanupSql, /discount_amount <= round\(quantity \* unit_price, 2\)/i);
  assert.match(cleanupSql, /vat_treatment = 'taxable' or vat_rate = 0/i);
  assert.match(cleanupSql, /create or replace function private\.save_quotation/i);
  assert.match(cleanupSql, /create or replace function private\.get_public_quotation/i);
  const replacementFunctions = cleanupSql.slice(
    cleanupSql.indexOf("create or replace function private.save_quotation"),
  );
  assert.doesNotMatch(replacementFunctions, /document_discount|price_mode|currency/i);
});
```

- [ ] **Step 2: Update the database integration payload and constraint cases**

Replace the payload helper with the compact shape:

```ts
function payload(
  id: string | null,
  date = issueDate,
  sellerSnapshot = seller,
  unit: string | null = "งาน",
) {
  return {
    customer_snapshot: { name: "Customer", address: "Customer address" },
    id,
    internal_notes: "",
    issue_date: date,
    items: [{
      description: "",
      discount_amount: "0.00",
      name: "Item",
      position: 1,
      quantity: "1.000",
      unit,
      unit_price: "100.00",
      vat_rate: "7.00",
      vat_treatment: "taxable",
    }],
    public_notes: "",
    reference: "",
    seller_snapshot: sellerSnapshot,
    subject: "",
    totals: {
      amountDue: "104.00",
      discountTotal: "0.00",
      grandTotal: "107.00",
      grossTotal: "100.00",
      preTaxTotal: "100.00",
      vatTotal: "7.00",
      withholdingTaxTotal: "3.00",
    },
    valid_until: date,
    validity_days: 0,
    withholding_tax_rate: "3.00",
  };
}
```

Add constraint assertions using the allowed client:

```ts
it("rejects inconsistent item and quotation money", async () => {
  const excessiveDiscount = payload(null);
  excessiveDiscount.items[0]!.discount_amount = "100.01";
  assert.equal((await allowed.rpc("save_quotation", { p_payload: excessiveDiscount })).error?.code, "23514");

  const hiddenVat = payload(null);
  hiddenVat.items[0]!.vat_treatment = "none";
  assert.equal((await allowed.rpc("save_quotation", { p_payload: hiddenVat })).error?.code, "23514");

  const inconsistentTotals = payload(null);
  inconsistentTotals.totals.preTaxTotal = "99.00";
  assert.equal((await allowed.rpc("save_quotation", { p_payload: inconsistentTotals })).error?.code, "23514");
});
```

- [ ] **Step 3: Run migration tests and confirm they fail before the migration exists**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
```

Expected: FAIL because the CLI-generated cleanup migration is absent.

- [ ] **Step 4: Create the migration with the installed Supabase CLI**

Run:

```powershell
npx.cmd supabase migration new quotation_item_options_schema_cleanup
```

Expected: one new file ending in `_quotation_item_options_schema_cleanup.sql`. Do not install or upgrade Supabase; the project already has `supabase` in `devDependencies`.

- [ ] **Step 5: Implement the schema reset and column cleanup**

Write the following schema operations at the top of the generated migration:

```sql
truncate table public.quotations cascade;
truncate table private.quotation_number_counters;

alter table public.quotations
  drop constraint if exists quotations_subtotal_check,
  drop constraint if exists quotations_item_discount_total_check,
  drop constraint if exists quotations_taxable_total_check,
  drop constraint if exists quotations_vat_total_check,
  drop constraint if exists quotations_grand_total_check,
  drop constraint if exists quotations_withholding_tax_total_check,
  drop constraint if exists quotations_amount_due_check,
  drop column currency,
  drop column price_mode,
  drop column document_discount_type,
  drop column document_discount_value,
  drop column document_discount_total;

alter table public.quotations rename column subtotal to gross_total;
alter table public.quotations rename column item_discount_total to discount_total;
alter table public.quotations rename column taxable_total to pre_tax_total;

alter table public.quotations
  add constraint quotations_gross_total_nonnegative check (gross_total >= 0),
  add constraint quotations_discount_total_valid check (discount_total >= 0 and discount_total <= gross_total),
  add constraint quotations_pre_tax_total_valid check (pre_tax_total = gross_total - discount_total),
  add constraint quotations_vat_total_nonnegative check (vat_total >= 0),
  add constraint quotations_grand_total_valid check (grand_total = pre_tax_total + vat_total),
  add constraint quotations_withholding_total_nonnegative check (withholding_tax_total >= 0),
  add constraint quotations_amount_due_valid check (amount_due = grand_total - withholding_tax_total and amount_due >= 0);

alter table public.quotation_items
  drop constraint if exists quotation_items_discount_amount_check,
  drop constraint if exists quotation_items_vat_rate_check,
  drop column sku,
  drop column discount_type,
  drop column discount_value,
  drop column document_discount_allocation,
  drop column gross_amount,
  drop column taxable_amount,
  drop column vat_amount,
  drop column line_total,
  drop column created_at,
  drop column updated_at,
  add constraint quotation_items_discount_amount_valid
    check (discount_amount >= 0 and discount_amount <= round(quantity * unit_price, 2)),
  add constraint quotation_items_vat_rate_valid check (vat_rate between 0 and 100),
  add constraint quotation_items_vat_treatment_rate_valid
    check (vat_treatment = 'taxable' or vat_rate = 0);
```

- [ ] **Step 6: Replace the private save function with the compact payload**

Keep the existing signature, permission check, stable document number, and edit-not-found behavior. Add a database item-count guard and use only final columns:

```sql
create or replace function private.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_document_number text;
  v_item jsonb;
  v_updated integer;
begin
  if not private.has_quotation_permission() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;
  if jsonb_array_length(p_payload -> 'items') not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Quotation requires 1 to 100 items';
  end if;

  v_id := nullif(p_payload ->> 'id', '')::uuid;
  if v_id is null then
    v_id := gen_random_uuid();
    v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
    insert into public.quotations (
      id, document_number, issue_date, valid_until, validity_days, reference,
      subject, seller_snapshot, customer_snapshot, gross_total, discount_total,
      pre_tax_total, vat_total, grand_total, withholding_tax_rate,
      withholding_tax_total, amount_due, public_notes, internal_notes,
      created_by, updated_by
    ) values (
      v_id, v_document_number, (p_payload ->> 'issue_date')::date,
      (p_payload ->> 'valid_until')::date,
      nullif(p_payload ->> 'validity_days', '')::integer,
      coalesce(p_payload ->> 'reference', ''), coalesce(p_payload ->> 'subject', ''),
      p_payload -> 'seller_snapshot', p_payload -> 'customer_snapshot',
      (p_payload #>> '{totals,grossTotal}')::numeric,
      (p_payload #>> '{totals,discountTotal}')::numeric,
      (p_payload #>> '{totals,preTaxTotal}')::numeric,
      (p_payload #>> '{totals,vatTotal}')::numeric,
      (p_payload #>> '{totals,grandTotal}')::numeric,
      nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
      (p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
      (p_payload #>> '{totals,amountDue}')::numeric,
      coalesce(p_payload ->> 'public_notes', ''),
      coalesce(p_payload ->> 'internal_notes', ''), auth.uid(), auth.uid()
    );
  else
    update public.quotations set
      issue_date = (p_payload ->> 'issue_date')::date,
      valid_until = (p_payload ->> 'valid_until')::date,
      validity_days = nullif(p_payload ->> 'validity_days', '')::integer,
      reference = coalesce(p_payload ->> 'reference', ''),
      subject = coalesce(p_payload ->> 'subject', ''),
      seller_snapshot = p_payload -> 'seller_snapshot',
      customer_snapshot = p_payload -> 'customer_snapshot',
      gross_total = (p_payload #>> '{totals,grossTotal}')::numeric,
      discount_total = (p_payload #>> '{totals,discountTotal}')::numeric,
      pre_tax_total = (p_payload #>> '{totals,preTaxTotal}')::numeric,
      vat_total = (p_payload #>> '{totals,vatTotal}')::numeric,
      grand_total = (p_payload #>> '{totals,grandTotal}')::numeric,
      withholding_tax_rate = nullif(p_payload ->> 'withholding_tax_rate', '')::numeric,
      withholding_tax_total = (p_payload #>> '{totals,withholdingTaxTotal}')::numeric,
      amount_due = (p_payload #>> '{totals,amountDue}')::numeric,
      public_notes = coalesce(p_payload ->> 'public_notes', ''),
      internal_notes = coalesce(p_payload ->> 'internal_notes', ''),
      updated_by = auth.uid(), updated_at = now()
    where quotations.id = v_id and quotations.deleted_at is null
    returning quotations.document_number into v_document_number;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception using errcode = 'P0002', message = 'Quotation not found';
    end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.quotation_items (
      quotation_id, position, name, description, quantity, unit, unit_price,
      discount_amount, vat_treatment, vat_rate
    ) values (
      v_id, (v_item ->> 'position')::integer, v_item ->> 'name',
      coalesce(v_item ->> 'description', ''), (v_item ->> 'quantity')::numeric,
      nullif(v_item ->> 'unit', ''), (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'discount_amount')::numeric, v_item ->> 'vat_treatment',
      (v_item ->> 'vat_rate')::numeric
    );
  end loop;
  return query select v_id, v_document_number;
end;
$$;
```

- [ ] **Step 7: Replace the private public-read function**

Keep token filtering, soft-delete filtering, the reduced customer snapshot, and no internal notes:

```sql
create or replace function private.get_public_quotation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', q.id,
    'document_number', q.document_number,
    'issue_date', q.issue_date,
    'valid_until', q.valid_until,
    'validity_days', q.validity_days,
    'reference', q.reference,
    'subject', q.subject,
    'seller_snapshot', q.seller_snapshot,
    'customer_snapshot', jsonb_build_object(
      'name', coalesce(q.customer_snapshot ->> 'name', ''),
      'address', coalesce(q.customer_snapshot ->> 'address', ''),
      'taxId', coalesce(q.customer_snapshot ->> 'taxId', ''),
      'officeType', coalesce(q.customer_snapshot ->> 'officeType', 'head_office'),
      'branchNumber', coalesce(q.customer_snapshot ->> 'branchNumber', '')
    ),
    'withholding_tax_rate', q.withholding_tax_rate,
    'public_notes', q.public_notes,
    'quotation_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'position', i.position,
        'name', i.name,
        'description', i.description,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'discount_amount', i.discount_amount,
        'vat_treatment', i.vat_treatment,
        'vat_rate', i.vat_rate
      ) order by i.position)
      from public.quotation_items i
      where i.quotation_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotations q
  where q.public_token = p_token
    and q.deleted_at is null;
$$;
```

Because function signatures do not change, preserve the existing public wrappers and grants; verify them after reset.

- [ ] **Step 8: Apply and verify the local migration**

Run:

```powershell
npx.cmd supabase migration up --local
npx.cmd supabase migration list --local
```

Expected: the cleanup migration is applied locally and listed as applied. If the local stack is unavailable, stop and report the skipped database check; do not target a linked/remote project.

Then run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-migration.test.ts
$env:RUN_LOCAL_SUPABASE_TESTS='1'; npm run test -- --test-name-pattern="quotation local database integration"
```

Expected: static migration tests PASS. Integration tests PASS when `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_ANON_KEY`, and `LOCAL_SUPABASE_SERVICE_ROLE_KEY` are configured; otherwise explicitly report that they were skipped.

- [ ] **Step 9: Run Supabase advisors if available**

Run:

```powershell
npx.cmd supabase db advisors --local
```

Expected: no new security or performance findings caused by the quotation migration. If this installed CLI version does not expose `db advisors`, record the skipped check and continue with the integration/RLS tests.

- [ ] **Step 10: Commit the persistence slice**

Use the actual CLI-generated migration filename in place of the suffix glob when staging:

```powershell
git add -- supabase/migrations/*_quotation_item_options_schema_cleanup.sql tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "refactor: clean quotation schema"
```

---

### Task 3: Update Current Documentation And Verify The Complete Feature

**Files:**
- Modify: `docs/quotation-management.md`
- Modify: `docs/superpowers/specs/2026-07-16-quotation-item-options-schema-cleanup-design.md`

**Interfaces:**
- Consumes: final application and database behavior from Tasks 1–2.
- Produces: current human-facing behavior documentation and a verified implementation handoff.

- [ ] **Step 1: Update quotation behavior documentation**

Replace the stale editor and calculation statements in `docs/quotation-management.md` with:

```markdown
- Per-item discount and VAT controls are enabled from `ตั้งค่าเอกสาร`.
- New quotations start with both optional item features off.
- Item discounts are fixed amounts only. Disabling the feature clears all item discounts.
- Enabling VAT starts items at 7%; disabling it stores every item as no VAT at 0%.
- The item ledger, Preview/Print, and Public Read-only display `มูลค่าก่อนภาษี` after item discount and before VAT.

The server recalculates money before saving:

1. `gross total = sum(quantity × unit price)`
2. `discount total = sum(fixed item discounts)`
3. `pre-tax total = gross total − discount total`
4. `VAT total = sum(item pre-tax amount × item VAT rate)`
5. `grand total = pre-tax total + VAT total`
6. `withholding tax = pre-tax total × withholding percentage`
7. `amount due = grand total − withholding tax`
```

Document that the local cleanup migration resets quotation documents/items and removes unused quotation columns while preserving the seller company profile. Do not rewrite historical design specs.

- [ ] **Step 2: Mark the approved spec implemented only after verification**

Change the status line in `docs/superpowers/specs/2026-07-16-quotation-item-options-schema-cleanup-design.md` to:

```markdown
**Status:** Implemented and verified
```

Do this only after every available automated and manual check below succeeds.

- [ ] **Step 3: Run the full automated verification**

Run in order:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: every command exits `0`. Confirm the database integration test reports PASS when its local environment variables are available, not merely SKIP.

- [ ] **Step 4: Inspect the final schema**

Against local Supabase, verify exact final columns:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('quotations', 'quotation_items')
order by table_name, ordinal_position;
```

Expected: only the columns approved in the design spec remain. Also verify `quotation_company_profiles` still contains its prior row and the quotation tables contain only new test/manual data created after migration.

- [ ] **Step 5: Perform responsive and public-flow visual verification**

Start the existing app without installing dependencies:

```powershell
npm run dev
```

Inspect authenticated Create and Edit at approximately 390 px, 768 px, 1280 px, and 1536 px widths:

- both optional columns hidden on a new quotation;
- settings dropdown is keyboard accessible;
- enabling discount adds one fixed-amount field without an empty type track;
- enabling VAT initializes 7% and adds VAT controls;
- disabling a non-zero feature asks before clearing;
- the desktop ledger reflows with neither, either, and both optional columns;
- mobile cards show only enabled controls;
- each item displays `มูลค่าก่อนภาษี`;
- summary order and conditional discount row match the spec.

Save a quotation and inspect Preview, Print, and `/q/[token]` without login. Confirm they use only the latest saved values, conditionally show optional columns, never show internal notes, and return unavailable after soft delete.

- [ ] **Step 6: Commit documentation and verification status**

```powershell
git add -- docs/quotation-management.md docs/superpowers/specs/2026-07-16-quotation-item-options-schema-cleanup-design.md
git commit -m "docs: update quotation item calculation rules"
```

`docs/architecture.md` needs no change because the Editor → Server Action → calculator → transactional RPC flow and the public security boundary remain unchanged. Before every `git add`, inspect `git diff -- <file>` and do not stage unrelated pre-existing edits.

---

## Completion Checklist

- [ ] No runtime application, replacement RPC, public payload, or final schema reference remains for `documentDiscount`, `discountType`, `discountValue`, `currency`, or `priceMode`; historical migrations and their historical assertions remain unchanged.
- [ ] No final quotation item column remains for SKU, document allocation, duplicated calculated amounts, or item timestamps.
- [ ] New quotations start discount-off and VAT-off; VAT enable starts at 7%.
- [ ] Editor visibility is inferred from saved values and is not stored as a feature flag.
- [ ] Item and document displays use pre-tax values and the approved summary order.
- [ ] Server and database constraints reject invalid discounts, VAT rates, and inconsistent totals.
- [ ] Quotation data and numbering reset; seller profile and unrelated data remain.
- [ ] RLS, permission checks, token-only public read, soft delete, and saved-only share/print still pass.
- [ ] Typecheck, lint, tests, build, migration checks, and `git diff --check` pass.
- [ ] Documentation reflects actual behavior and records any intentionally skipped local checks.
