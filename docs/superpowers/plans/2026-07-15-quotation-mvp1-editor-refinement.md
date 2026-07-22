# Quotation MVP 1 Editor Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับ MVP 1 ที่มีอยู่ให้สร้างข้อมูลผู้ขายหลักได้จริง และเปลี่ยนหน้าสร้าง/แก้ไขใบเสนอราคาเป็น Full-width Responsive Editor ตามต้นแบบที่อนุมัติ โดยยังคง A4 เฉพาะ Preview/Print

**Architecture:** คง data flow เดิมจาก Client Editor ไป Server Action, quotation service และ transactional Supabase RPC เปลี่ยนเฉพาะ validation/payload ที่จำเป็นและเพิ่ม migration ใหม่ให้ `quotation_items.unit` เป็น nullable แยก read-only document renderer ออกจาก editor เพื่อใช้ร่วมกันใน Preview และ Browser Print โดยไม่เพิ่ม PDF service หรือ dependency ใหม่

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind CSS, ShadcnUI ที่มีอยู่, Supabase PostgreSQL/RLS/RPC, Cloudflare Media Worker/R2, Node test runner

## Global Constraints

- ขอบเขตนี้คือ MVP 1 refinement เท่านั้น ห้ามเพิ่ม WHT, payment methods, installments, Public Share, QR, workflow หรือ business status
- หน้า Create/Edit เป็น Full-width Responsive; A4 ใช้เฉพาะ Preview/Print
- `quantity` ต้องกรอกและมากกว่า `0`; `unit` เว้นว่างได้
- ไม่มีช่องชื่องานใน UI/Preview/Print; legacy database column `subject` ยังอยู่และห้าม drop
- `reference` อยู่ในกลุ่มข้อมูลเอกสารและไม่บังคับ
- `branchNumber` บังคับเฉพาะ `officeType = "branch"`; เลือกสำนักงานใหญ่แล้วต้องล้างค่า
- VAT ยังคงกำหนดต่อรายการ และ price mode อยู่เหนือรายการสินค้า
- ยอดรวมอยู่ด้านขวาล่างเท่านั้น
- Share และ Download แสดงเป็น disabled future actions เท่านั้น ห้ามสร้าง Public route/token/API
- สร้าง migration ใหม่ด้วย `supabase migration new quotation_mvp1_editor_refinement`; ห้ามประดิษฐ์ timestamp หรือแก้ `20260714114823_quotation_management_mvp1.sql`
- ห้ามเพิ่ม dependency หรือแก้ `package.json`/lockfile
- รักษา server-side recalculation, permission check, RLS และ transactional RPC เดิม
- Migration นี้ไม่สร้าง table/function ใน exposed schema จึงไม่เพิ่ม GRANT/RLS ใหม่; สิทธิ์เดิมของ `quotation_items` ต้องคงอยู่
- House Workspace Shell ไม่ใช้กับโมดูลใบเสนอราคา

---

## File Map

**Create**

- CLI-generated migration ภายใต้ `supabase/migrations/` ที่ลงท้าย `_quotation_mvp1_editor_refinement.sql` — ทำ `quotation_items.unit` ให้ nullable โดยไม่แตะ migration เดิม
- `components/admin/quotations/quotation-document.tsx` — read-only renderer สำหรับ Preview และ Print
- `docs/quotation-management.md` — behavior, validation, responsive layout และ manual test checklist ของระบบที่ทำงานจริง

**Modify**

- `server/services/quotations.ts` — normalize office/branch, optional unit, legacy subject และ nullable RPC unit
- `components/admin/quotations/company-profile-form.tsx` — บังคับเลขสาขาเฉพาะสาขาและแสดง field errors ตรงช่อง
- `components/admin/quotations/quotation-editor.tsx` — Full-width Editor, responsive item cards, header/seller/action rows, Preview/Print/Delete และ dirty warning
- `app/admin/quotations/[id]/page.tsx` — รองรับ `?print=1` จากหน้ารายการ
- `app/globals.css` — print isolation และ A4 page rules
- `tests/quotation-service.test.ts` — service regression tests
- `tests/quotation-migration.test.ts` — migration regression test
- `tests/quotation-database-integration.test.ts` — nullable unit through the real local RPC
- `tests/quotation-ui.test.ts` — approved layout/action/field source tests
- `tests/quotation-assets.test.ts` — ยืนยัน Media Worker รองรับ quotation logo path
- `README.md` — routes และ usage summary
- `docs/architecture.md` — quotation data/print/storage flow

**Intentionally unchanged**

- `lib/quotation-calculator.ts` — unit ไม่เข้าการคำนวณอยู่แล้ว
- `lib/quotation-types.ts` — คง `subject` เป็น legacy empty property เพื่อไม่ขยาย migration/refactor
- `supabase/migrations/20260714114823_quotation_management_mvp1.sql` — migration เดิม immutable
- `package.json` และ lockfile — dependency ปัจจุบันเพียงพอ

---

### Task 1: Normalize Branches, Optional Unit, And Legacy Subject

**Files:**

- Create via Supabase CLI: migration ภายใต้ `supabase/migrations/` ที่ลงท้าย `_quotation_mvp1_editor_refinement.sql`
- Modify: `server/services/quotations.ts`
- Test: `tests/quotation-service.test.ts`
- Test: `tests/quotation-migration.test.ts`
- Test: `tests/quotation-database-integration.test.ts`

**Interfaces:**

- Consumes: `QuotationPayload`, `SellerSnapshot`, `QuotationItemInput`, `prepareQuotationPayload(value)`
- Produces: `prepareQuotationPayload(value)` ที่คืน `rpcPayload.items[].unit: string | null`, normalize `branchNumber` และคง `payload.subject === ""`

- [ ] **Step 1: Write failing service and migration tests**

เพิ่ม tests ต่อไปนี้ใน `tests/quotation-service.test.ts`:

```ts
it("requires quantity but permits an empty unit", () => {
  const withEmptyUnit = validPayload();
  withEmptyUnit.items[0]!.unit = "";
  const prepared = prepareQuotationPayload(withEmptyUnit);
  assert.equal(prepared.payload.items[0]!.unit, "");
  assert.equal(prepared.rpcPayload.items[0]!.unit, null);

  const withoutQuantity = validPayload();
  withoutQuantity.items[0]!.quantity = "";
  assert.throws(
    () => prepareQuotationPayload(withoutQuantity),
    (error) => error instanceof QuotationValidationError && Boolean(error.fieldErrors["items.0.quantity"]),
  );
});

it("requires branch numbers only for branch offices", () => {
  const branch = validPayload();
  branch.seller.officeType = "branch";
  branch.seller.branchNumber = "";
  branch.customer.officeType = "branch";
  branch.customer.branchNumber = "";
  assert.throws(() => prepareQuotationPayload(branch), (error) => {
    assert.equal(error instanceof QuotationValidationError, true);
    return error instanceof QuotationValidationError
      && Boolean(error.fieldErrors["seller.branchNumber"])
      && Boolean(error.fieldErrors["customer.branchNumber"]);
  });

  const headOffice = validPayload();
  headOffice.seller.branchNumber = "99999";
  headOffice.customer.branchNumber = "88888";
  const prepared = prepareQuotationPayload(headOffice);
  assert.equal(prepared.payload.seller.branchNumber, "");
  assert.equal(prepared.payload.customer.branchNumber, "");
});

it("keeps the legacy subject empty", () => {
  const payload = validPayload();
  payload.subject = "must not be saved";
  const prepared = prepareQuotationPayload(payload);
  assert.equal(prepared.payload.subject, "");
  assert.equal(prepared.rpcPayload.subject, "");
});
```

เพิ่มการอ่าน migration ใหม่และ test ต่อไปนี้ใน `tests/quotation-migration.test.ts`:

```ts
const refinementName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_mvp1_editor_refinement.sql"));
assert.ok(refinementName, "quotation editor refinement migration must exist");
const refinementSql = readFileSync(
  new URL(`../supabase/migrations/${refinementName}`, import.meta.url),
  "utf8",
);

it("allows quotation item units to be empty without changing quantity", () => {
  assert.match(refinementSql, /alter table public\.quotation_items\s+alter column unit drop not null/i);
  assert.doesNotMatch(refinementSql, /alter column quantity drop not null/i);
  assert.doesNotMatch(refinementSql, /drop column subject/i);
});
```

เปลี่ยน helper ใน `tests/quotation-database-integration.test.ts` ให้รับ unit ที่ nullable:

```ts
function payload(
  id: string | null,
  date = issueDate,
  sellerSnapshot = seller,
  unit: string | null = "งาน",
) {
  return {
    id,
    currency: "THB",
    customer_snapshot: { name: "Customer", address: "Customer address" },
    document_discount_type: null,
    document_discount_value: "0.00",
    internal_notes: "",
    issue_date: date,
    items: [{
      position: 1,
      sku: "",
      name: "Item",
      description: "",
      quantity: "1.000",
      unit,
      unit_price: "100.00",
      discount_type: null,
      discount_value: "0.00",
      gross_amount: "100.00",
      discount_amount: "0.00",
      document_discount_allocation: "0.00",
      vat_treatment: "taxable",
      vat_rate: "7.00",
      taxable_amount: "100.00",
      vat_amount: "7.00",
      line_total: "107.00",
    }],
    price_mode: "vat_exclusive",
    public_notes: "",
    reference: "",
    seller_snapshot: sellerSnapshot,
    subject: "",
    totals: { subtotal: "100.00", itemDiscountTotal: "0.00", documentDiscountTotal: "0.00", taxableTotal: "100.00", vatTotal: "7.00", grandTotal: "107.00" },
    valid_until: date,
    validity_days: 0,
  };
}
```

เพิ่ม integration test ภายใน describe เดิม:

```ts
it("persists a null unit while quantity remains required", async () => {
  const created = await save(allowed, payload(null, issueDate, seller, null));
  const item = await allowed.from("quotation_items").select("quantity,unit").eq("quotation_id", created.id).single();
  assert.equal(item.error, null, item.error?.message);
  assert.equal(item.data.quantity, 1);
  assert.equal(item.data.unit, null);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-migration.test.ts
```

Expected: FAIL เพราะยังบังคับ unit, ไม่ normalize branch/subject และยังไม่มี refinement migration

- [ ] **Step 3: Implement the minimal normalization and migration**

สร้างไฟล์ผ่าน CLI ก่อน:

```powershell
npx supabase migration new quotation_mvp1_editor_refinement
```

Expected: CLI รายงาน path ใหม่ที่ลงท้าย `_quotation_mvp1_editor_refinement.sql` ภายใต้ `supabase/migrations/` ตามรูปแบบทางการของ Supabase จากนั้นใส่ SQL ต่อไปนี้ในไฟล์ที่ CLI สร้าง:

```sql
alter table public.quotation_items
  alter column unit drop not null;
```

ใน `server/services/quotations.ts` เปลี่ยน RPC item type:

```ts
unit: string | null;
```

เพิ่ม helper ข้าง `discountTypeValue`:

```ts
function branchNumber(
  source: Record<string, unknown>,
  officeType: "branch" | "head_office",
  field: string,
  errors: Record<string, string>,
): string {
  if (officeType === "head_office") return "";
  const value = bounded(stringValue(source, "branchNumber"), 200, field, errors);
  if (!value) errors[field] = "กรุณากรอกเลขสาขา";
  return value;
}
```

ใน `prepareSellerSnapshot` สร้าง office type ก่อน object และใช้ค่าที่ normalize แล้ว:

```ts
const office = enumValue(
  source.officeType,
  ["branch", "head_office"],
  "seller.officeType",
  errors,
  "head_office",
);
const seller: SellerSnapshot = {
  address: bounded(stringValue(source, "address"), 2_000, "seller.address", errors),
  branchNumber: branchNumber(source, office, "seller.branchNumber", errors),
  contactEmail: bounded(stringValue(source, "contactEmail"), 200, "seller.contactEmail", errors),
  contactName: bounded(stringValue(source, "contactName"), 200, "seller.contactName", errors),
  contactPhone: bounded(stringValue(source, "contactPhone"), 200, "seller.contactPhone", errors),
  email: bounded(stringValue(source, "email"), 200, "seller.email", errors),
  logoUrl: bounded(stringValue(source, "logoUrl"), 2_048, "seller.logoUrl", errors),
  name: bounded(stringValue(source, "name"), 200, "seller.name", errors),
  officeType: office,
  phone: bounded(stringValue(source, "phone"), 200, "seller.phone", errors),
  taxId: bounded(stringValue(source, "taxId"), 200, "seller.taxId", errors),
  website: bounded(stringValue(source, "website"), 2_048, "seller.website", errors),
};
```

ใน customer parsing ใช้รูปแบบเดียวกัน:

```ts
const customerOffice = enumValue(
  customerSource.officeType,
  ["branch", "head_office"],
  "customer.officeType",
  errors,
  "head_office",
);
const customer: CustomerSnapshot = {
  address: bounded(stringValue(customerSource, "address"), 2_000, "customer.address", errors),
  branchNumber: branchNumber(customerSource, customerOffice, "customer.branchNumber", errors),
  contactName: bounded(stringValue(customerSource, "contactName"), 200, "customer.contactName", errors),
  email: bounded(stringValue(customerSource, "email"), 200, "customer.email", errors),
  name: bounded(stringValue(customerSource, "name"), 200, "customer.name", errors),
  officeType: customerOffice,
  phone: bounded(stringValue(customerSource, "phone"), 200, "customer.phone", errors),
  serviceLocation: bounded(stringValue(customerSource, "serviceLocation"), 2_000, "customer.serviceLocation", errors),
  shippingAddress: bounded(stringValue(customerSource, "shippingAddress"), 2_000, "customer.shippingAddress", errors),
  taxId: bounded(stringValue(customerSource, "taxId"), 200, "customer.taxId", errors),
};
```

เปลี่ยน item parsing ให้ไม่สร้าง required error สำหรับ unit:

```ts
const unit = bounded(stringValue(item, "unit"), 200, `${prefix}.unit`, errors);
```

เปลี่ยน default item ทั้ง `emptyQuotationPayload` และ `addItem` ใน Task 3 ให้ `unit: ""` และบังคับ legacy subject เป็น empty string:

```ts
subject: "",
```

ใน payload normalization และ RPC mapping ใช้:

```ts
subject: "",
```

```ts
unit: line.unit || null,
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-service.test.ts tests/quotation-migration.test.ts
npm run typecheck
```

Expected: focused tests PASS และ typecheck PASS

- [ ] **Step 5: Commit Task 1**

```powershell
$migrations = @(Get-ChildItem 'supabase/migrations/*_quotation_mvp1_editor_refinement.sql')
if ($migrations.Count -ne 1) { throw 'Expected exactly one quotation refinement migration' }
$migrationPath = $migrations[0].FullName
git add -- server/services/quotations.ts tests/quotation-service.test.ts tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts $migrationPath
git commit -m "fix: refine quotation branch and unit validation"
```

---

### Task 2: Make The Main Seller Profile Reliably Creatable

**Files:**

- Modify: `components/admin/quotations/company-profile-form.tsx`
- Test: `tests/quotation-ui.test.ts`
- Test: `tests/quotation-assets.test.ts`
- Verify/deploy: `workers/media/src/index.ts` using existing `workers/media/wrangler.jsonc`

**Interfaces:**

- Consumes: `saveCompanyProfileAction(formData)`, `prepareSellerSnapshot(value)`, existing Media Worker `quotations/assets/<uuid>.webp` support
- Produces: seller profile form that saves without a logo and requires branch number only when Branch is selected

- [ ] **Step 1: Write failing seller-profile UI assertions**

เพิ่ม assertions ใน test `collects the approved seller snapshot fields and normalizes the logo` ภายใน `tests/quotation-ui.test.ts`:

```ts
assert.match(form, /officeType === "branch"[\s\S]*name="branchNumber"[\s\S]*required/);
assert.match(form, /name="branchNumber" type="hidden" value=""/);
assert.match(form, /error=\{fieldErrors\.branchNumber\}/);
assert.match(form, /aria-invalid=\{Boolean\(error\)\}/);
```

เพิ่มใน `tests/quotation-assets.test.ts`:

```ts
it("keeps quotation logo uploads optional for the seller profile", () => {
  const source = readFileSync("app/admin/quotations/actions.ts", "utf8");
  assert.match(source, /const logo = value instanceof File && value\.size > 0/);
  assert.ok(source.indexOf("if (logo)") < source.indexOf("saveQuotationCompanyProfile(supabase, seller)"));
});
```

- [ ] **Step 2: Run the focused UI and asset tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-assets.test.ts
```

Expected: quotation UI test FAIL เพราะ branch field ยังไม่ required และ field errors ยังไม่แสดงรายช่อง

- [ ] **Step 3: Add field-error rendering and conditional branch requirement**

ใน `CompanyProfileForm` เพิ่ม state:

```ts
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
```

ก่อน submit ให้ล้าง error และหลัง action ให้เก็บ error:

```ts
setFieldErrors({});
```

```ts
if (result.ok) {
  setFieldErrors({});
  setLogoUrl(result.logoUrl);
  setLogoUnavailable(false);
  setMessage("บันทึกข้อมูลผู้ขายแล้ว");
} else {
  setFieldErrors(result.fieldErrors);
  setError(result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกข้อมูลผู้ขายได้");
}
```

เปลี่ยน branch control:

```tsx
{officeType === "branch" ? (
  <Field
    error={fieldErrors.branchNumber}
    label="เลขสาขา"
    name="branchNumber"
    required
    value={initialSeller.branchNumber}
  />
) : (
  <input name="branchNumber" type="hidden" value="" />
)}
```

เปลี่ยน helper `Field` ให้แสดง field error:

```tsx
function Field({
  error,
  label,
  name,
  required,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return <div className="grid gap-2">
    <Label htmlFor={name}>{label}</Label>
    <Input aria-invalid={Boolean(error)} defaultValue={value} id={name} name={name} required={required} type={type} />
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
```

ส่ง `error={fieldErrors.<field>}` ให้ fields ที่มีอยู่ทั้งหมด โดยไม่เปลี่ยนชื่อ FormData keys

- [ ] **Step 4: Run tests and perform the no-logo profile smoke check**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-assets.test.ts tests/quotation-service.test.ts
npm run typecheck
```

Expected: PASS

ตรวจเฉพาะ project reference โดยไม่พิมพ์ API key:

```powershell
node --use-system-ca --eval "const fs=require('node:fs'); const {loadEnvConfig}=require('@next/env'); loadEnvConfig(process.cwd()); const appRef=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]; const linkedRef=fs.readFileSync('supabase/.temp/project-ref','utf8').trim(); console.log(JSON.stringify({appRef,linkedRef,match:appRef===linkedRef}));"
```

Expected: `match` เป็น `true`. หากเป็น `false`, ใช้ App URL เป็นหลักสำหรับ smoke test และห้าม push migration ไป linked project จนผู้ใช้ยืนยัน target.

Run the local app, open `/admin/quotations/settings/company`, leave Logo empty, save required seller fields, then open `/admin/quotations/new`.

Expected: profile saves, Create page opens, and its seller snapshot matches the saved profile.

- [ ] **Step 5: Commit the seller-profile code**

```powershell
git add -- components/admin/quotations/company-profile-form.tsx tests/quotation-ui.test.ts tests/quotation-assets.test.ts
git commit -m "fix: make quotation seller profile creation reliable"
```

- [ ] **Step 6: Deploy the already-tested Media Worker prefix and verify logo upload**

This step changes external Cloudflare state. Request explicit user approval during execution, then run:

```powershell
npx wrangler deploy --config workers/media/wrangler.jsonc
```

Expected: Wrangler reports a successful deployment for the configured media Worker.

Return to `/admin/quotations/settings/company`, upload a PNG/JPEG/WebP under 10 MB, and save.

Expected: upload to `quotations/assets/<uuid>.webp` succeeds, the saved logo renders, and a new quotation copies that URL into its seller snapshot. If the Worker still returns `400`, stop and verify that the deployed Worker name and the hostname from `getQuotationAssetEnv().workerUrl` refer to the same Worker; do not weaken key validation.

---

### Task 3: Replace Inline A4 With The Approved Full-Width Responsive Editor

**Files:**

- Modify: `components/admin/quotations/quotation-editor.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**

- Consumes: `QuotationPayload`, `calculateQuotation`, `saveQuotationAction`, `Button`, `Input`, `Textarea`
- Produces: stable layout hooks `data-quotation-editor`, `data-seller-actions`, `data-customer-section`, `data-document-section`, `data-item-table`, `data-item-cards`, `data-quotation-totals`

- [ ] **Step 1: Replace the obsolete Inline A4 source test with responsive layout assertions**

แทน test `uses one inline A4 payload for editing and calculation` ใน `tests/quotation-ui.test.ts` ด้วย:

```ts
it("uses the approved full-width responsive quotation editor", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /data-quotation-editor/);
  assert.match(editor, /data-seller-actions/);
  assert.match(editor, /data-customer-section/);
  assert.match(editor, /data-document-section/);
  assert.match(editor, /data-item-table/);
  assert.match(editor, /data-item-cards/);
  assert.match(editor, /data-quotation-totals/);
  assert.match(editor, /md:hidden/);
  assert.match(editor, /hidden[^"]*md:block/);
  assert.doesNotMatch(editor, /quotation-paper|min-h-\[297mm\]|w-\[210mm\]/);
  assert.doesNotMatch(editor, /field="subject"|data-field="subject"|label="หัวข้อ"/);
  assert.ok(editor.indexOf("data-document-section") < editor.indexOf('field="reference"'));
  assert.ok(editor.indexOf('field="priceMode"') < editor.indexOf("data-item-table"));
});

it("clears branch numbers when head office is selected", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /function updateSellerOfficeType/);
  assert.match(editor, /branchNumber: officeType === "branch" \? current\.seller\.branchNumber : ""/);
  assert.match(editor, /function updateCustomerOfficeType/);
  assert.match(editor, /branchNumber: officeType === "branch" \? current\.customer\.branchNumber : ""/);
  assert.match(editor, /payload\.seller\.officeType === "branch"/);
  assert.match(editor, /payload\.customer\.officeType === "branch"/);
});
```

- [ ] **Step 2: Run quotation UI tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the editor still renders a fixed A4 article and always shows branch/subject fields

- [ ] **Step 3: Implement the full-width structure and field behavior**

เพิ่ม office handlers ข้าง `updateCustomer`:

```ts
function updateSellerOfficeType(officeType: SellerSnapshot["officeType"]) {
  changed("seller.officeType");
  setPayload((current) => ({
    ...current,
    seller: {
      ...current.seller,
      branchNumber: officeType === "branch" ? current.seller.branchNumber : "",
      officeType,
    },
  }));
}

function updateCustomerOfficeType(officeType: CustomerSnapshot["officeType"]) {
  changed("customer.officeType");
  setPayload((current) => ({
    ...current,
    customer: {
      ...current.customer,
      branchNumber: officeType === "branch" ? current.customer.branchNumber : "",
      officeType,
    },
  }));
}
```

เปลี่ยน `addItem` default เป็น:

```ts
{
  description: "",
  discountType: null,
  discountValue: "0",
  id: crypto.randomUUID(),
  name: "",
  position: 0,
  quantity: "1",
  sku: "",
  unit: "",
  unitPrice: "0.00",
  vatRate: "7.00",
  vatTreatment: "taxable",
}
```

เปลี่ยน outer A4 container เป็นโครงนี้ โดยย้าย controls เดิมเข้า section ที่ตรงกัน:

```tsx
<div className="space-y-4" data-dirty={isDirty} data-quotation-editor>
  <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
    <div>
      <h1 className="text-xl font-semibold">{documentNumber ? "แก้ไขใบเสนอราคา" : "สร้างใบเสนอราคา"}</h1>
      <p className="text-sm text-primary">{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</p>
    </div>
    <div className="flex items-center gap-2" data-header-actions />
  </header>

  <section className="flex flex-wrap items-center justify-between gap-4 border-b pb-3" data-seller-actions>
    <div className="flex min-w-0 items-center gap-3">
      {payload.seller.logoUrl && !logoUnavailable ? (
        <img alt="โลโก้ผู้ขาย" className="max-h-12 max-w-24 object-contain" onError={() => setLogoUnavailable(true)} src={payload.seller.logoUrl} />
      ) : (
        <div className="grid h-10 w-16 place-items-center rounded border text-xs text-muted-foreground">โลโก้</div>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">{payload.seller.name || "ยังไม่มีชื่อผู้ขาย"}</p>
        <p className="truncate text-sm text-muted-foreground">
          {payload.seller.officeType === "branch" ? `สาขา ${payload.seller.branchNumber || "-"}` : "สำนักงานใหญ่"}
          {payload.seller.taxId ? ` · ${payload.seller.taxId}` : ""}
        </p>
      </div>
      <Button onClick={() => setSellerExpanded((open) => !open)} size="sm" type="button" variant="ghost">
        แก้ไขเฉพาะใบ
      </Button>
    </div>
    <div className="flex items-center gap-1" data-document-actions />
  </section>

  {sellerExpanded ? <section className="grid gap-3 rounded-lg border p-4 md:grid-cols-2" data-seller-edit /> : null}

  <div className="grid items-start gap-4 lg:grid-cols-[minmax(390px,520px)_minmax(36px,1fr)_minmax(340px,430px)]">
    <section className="grid gap-3 rounded-lg border p-4 lg:col-start-1" data-customer-section />
    <section className="grid gap-3 rounded-lg border p-4 lg:col-start-3" data-document-section />
  </div>

  <section className="space-y-3">
    <Field error={fieldErrors.priceMode} field="priceMode" label="รูปแบบราคา">
      <select data-field="priceMode" value={payload.priceMode} />
    </Field>
    <div className="hidden overflow-x-auto md:block" data-item-table />
    <div className="grid gap-3 md:hidden" data-item-cards />
  </section>

  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <section data-public-notes />
    <section className="space-y-2" data-quotation-totals />
  </div>
  <section className="rounded-xl border p-4" data-internal-notes />
</div>
```

ข้อกำหนดของ controls ภายในโครงนี้:

- seller edit section ใช้ seller controls เดิมทั้งหมด แต่ render `branchNumber` เฉพาะ `payload.seller.officeType === "branch"`
- customer section ใช้ customer controls เดิมและ render `branchNumber` เฉพาะ `payload.customer.officeType === "branch"`
- document section มี `issueDate`, `validityDays`, `validUntil`, read-only currency `THB — บาท`, และ `reference`; ลบ Subject input
- desktop table คง item inputs เดิม แต่ Unit ไม่มี required marker/error requirement
- mobile card หนึ่งใบต่อ item ใช้ inputs เดียวกัน: name/description, quantity/unit, unit price/discount, VAT และ row total พร้อม move/delete actions
- price mode อยู่ก่อน desktop table/mobile cards
- totals section ใช้ calculation เดิมด้านขวาล่างและไม่แสดง duplicate total ที่ส่วนบน

- [ ] **Step 4: Run UI, service, calculator and type checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-service.test.ts tests/quotation-calculator.test.ts
npm run typecheck
```

Expected: all selected tests PASS และ typecheck PASS

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add responsive quotation editor layout"
```

---

### Task 4: Add Read-Only Preview, Browser Print, And Document Actions

**Files:**

- Create: `components/admin/quotations/quotation-document.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `app/admin/quotations/[id]/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**

- Consumes: `QuotationPayload`, `QuotationCalculation`, `deleteQuotationAction(id)`, `window.print()`
- Produces: `QuotationDocument({ calculation, documentNumber, payload })`, optional `printOnLoad` editor prop, actual Preview/Print/Delete actions, disabled Share/Download placeholders

- [ ] **Step 1: Write failing Preview/Print/action assertions**

เพิ่มใน `tests/quotation-ui.test.ts`:

```ts
it("uses one read-only quotation document for preview and print", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const document = source("../components/admin/quotations/quotation-document.tsx");
  const editPage = source("../app/admin/quotations/[id]/page.tsx");
  const css = source("../app/globals.css");

  assert.match(editor, /QuotationDocument/);
  assert.match(editor, /window\.print\(\)/);
  assert.match(editor, /printOnLoad/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /deleteQuotationAction/);
  assert.match(editor, /แชร์/);
  assert.match(editor, /ดาวน์โหลด/);
  assert.match(editor, /disabled[\s\S]*แชร์/);
  assert.match(editor, /disabled[\s\S]*ดาวน์โหลด/);
  assert.match(document, /data-quotation-document/);
  assert.doesNotMatch(document, /<Input|<Textarea|field="subject"|payload\.subject/);
  assert.match(document, /item\.unit \?/);
  assert.match(editPage, /searchParams/);
  assert.match(editPage, /printOnLoad=\{print === "1"\}/);
  assert.match(css, /@page[\s\S]*size:\s*A4/);
  assert.match(css, /quotation-printing/);
});
```

- [ ] **Step 2: Run quotation UI tests and verify failure**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because the document renderer, print state and actions do not exist

- [ ] **Step 3: Create the read-only document renderer**

สร้าง `components/admin/quotations/quotation-document.tsx` ด้วย public interface นี้:

```tsx
import { formatThaiBahtText, type QuotationCalculation } from "../../../lib/quotation-calculator";
import type { QuotationPayload } from "../../../lib/quotation-types";

export function QuotationDocument({
  calculation,
  documentNumber,
  payload,
}: {
  calculation: QuotationCalculation;
  documentNumber: string | null;
  payload: QuotationPayload;
}) {
  return <article className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-[11px] text-slate-900" data-quotation-document>
    <header className="grid grid-cols-2 gap-8 border-b pb-4">
      <div>
        {payload.seller.logoUrl ? <img alt="โลโก้ผู้ขาย" className="mb-2 max-h-16 max-w-40 object-contain" src={payload.seller.logoUrl} /> : null}
        <p className="font-semibold">{payload.seller.name}</p>
        <p className="whitespace-pre-line">{payload.seller.address}</p>
        <p>เลขผู้เสียภาษี {payload.seller.taxId}</p>
        <p>{payload.seller.officeType === "branch" ? `สาขา ${payload.seller.branchNumber}` : "สำนักงานใหญ่"}</p>
        {payload.seller.phone ? <p>โทร {payload.seller.phone}</p> : null}
        {payload.seller.email ? <p>{payload.seller.email}</p> : null}
        {payload.seller.website ? <p>{payload.seller.website}</p> : null}
      </div>
      <div className="text-right">
        <h1 className="text-2xl font-bold">ใบเสนอราคา</h1>
        <p>{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</p>
        <p>วันที่ออก {payload.issueDate}</p>
        <p>ใช้ได้ถึง {payload.validUntil}</p>
        <p>เลขอ้างอิง {payload.reference || "-"}</p>
      </div>
    </header>

    <section className="mt-4 max-w-[105mm]">
      <p className="font-semibold">ลูกค้า: {payload.customer.name}</p>
      <p className="whitespace-pre-line">{payload.customer.address}</p>
      {payload.customer.taxId ? <p>เลขผู้เสียภาษี {payload.customer.taxId}</p> : null}
      <p>{payload.customer.officeType === "branch" ? `สาขา ${payload.customer.branchNumber}` : "สำนักงานใหญ่"}</p>
      {payload.customer.contactName ? <p>ผู้ติดต่อ {payload.customer.contactName}</p> : null}
      {payload.customer.phone ? <p>โทร {payload.customer.phone}</p> : null}
      {payload.customer.email ? <p>{payload.customer.email}</p> : null}
      {payload.customer.shippingAddress ? <p className="whitespace-pre-line">ที่อยู่จัดส่ง {payload.customer.shippingAddress}</p> : null}
      {payload.customer.serviceLocation ? <p className="whitespace-pre-line">สถานที่บริการ {payload.customer.serviceLocation}</p> : null}
    </section>

    <table className="mt-5 w-full border-collapse">
      <thead><tr className="border-y bg-slate-100 text-left"><th className="p-2">#</th><th className="p-2">รายการ</th><th className="p-2 text-right">จำนวน</th><th className="p-2">หน่วย</th><th className="p-2 text-right">ราคา</th><th className="p-2 text-right">ส่วนลด</th><th className="p-2 text-right">VAT</th><th className="p-2 text-right">รวม</th></tr></thead>
      <tbody>{calculation.lines.map((item) => <tr className="border-b align-top" key={item.id}>
        <td className="p-2">{item.position}</td>
        <td className="p-2"><p className="font-medium">{item.name}</p>{item.description ? <p className="whitespace-pre-line">{item.description}</p> : null}</td>
        <td className="p-2 text-right">{item.quantity}</td>
        <td className="p-2">{item.unit ? item.unit : ""}</td>
        <td className="p-2 text-right">{item.unitPrice}</td>
        <td className="p-2 text-right">{item.discountAmount}</td>
        <td className="p-2 text-right">{item.vatTreatment === "taxable" ? `${item.vatRate}%` : item.vatTreatment === "exempt" ? "ยกเว้น" : "-"}</td>
        <td className="p-2 text-right">{item.lineTotal}</td>
      </tr>)}</tbody>
    </table>

    <div className="mt-5 grid grid-cols-[1fr_80mm] gap-8">
      <div>{payload.publicNotes ? <><p className="font-semibold">หมายเหตุ</p><p className="whitespace-pre-line">{payload.publicNotes}</p></> : null}</div>
      <div className="space-y-1">
        <Total label="รวมก่อนส่วนลด" value={calculation.subtotal} />
        <Total label="ส่วนลดรายการ" value={calculation.itemDiscountTotal} />
        <Total label="ส่วนลดท้ายเอกสาร" value={calculation.documentDiscountTotal} />
        <Total label="มูลค่าก่อน VAT" value={calculation.taxableTotal} />
        {calculation.vatSummary.map((vat) => <Total
          key={`${vat.vatTreatment}-${vat.vatRate}`}
          label={vat.vatTreatment === "taxable" ? `VAT ${vat.vatRate}%` : vat.vatTreatment === "exempt" ? "ยกเว้น VAT" : "ไม่คิด VAT"}
          value={vat.vatAmount}
        />)}
        <Total label="VAT" value={calculation.vatTotal} />
        <Total bold label="ยอดรวมสุทธิ" value={calculation.grandTotal} />
        <p className="pt-2 text-right">{formatThaiBahtText(calculation.grandTotal)}</p>
      </div>
    </div>
  </article>;
}

function Total({ bold, label, value }: { bold?: boolean; label: string; value: string }) {
  return <div className={bold ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between"}><span>{label}</span><span>{value}</span></div>;
}
```

- [ ] **Step 4: Wire Preview, saved-only Print, Delete and responsive actions**

ใน `quotation-editor.tsx`:

1. import `useCallback`, `useEffect`, `useRef`, Lucide icons ที่มีอยู่, `deleteQuotationAction`, `QuotationDocument`, `Dialog` และ `DropdownMenu` primitives ที่มีอยู่
2. เพิ่ม prop และ state:

```ts
export interface QuotationEditorProps {
  documentNumber: string | null;
  initialPayload: QuotationPayload;
  printOnLoad?: boolean;
}

const [lastSavedPayload, setLastSavedPayload] = useState<QuotationPayload | null>(
  initialDocumentNumber ? initialPayload : null,
);
const [previewOpen, setPreviewOpen] = useState(false);
const [deleteOpen, setDeleteOpen] = useState(false);
const autoPrintStarted = useRef(false);
const savedCalculation = useMemo(
  () => lastSavedPayload ? calculateQuotation(lastSavedPayload) : null,
  [lastSavedPayload],
);
```

3. หลัง save สำเร็จให้ `setLastSavedPayload(payload)` ก่อน route/refresh
4. เพิ่ม print helpers:

```ts
const printSaved = useCallback(() => {
  if (!lastSavedPayload) return;
  document.documentElement.classList.add("quotation-printing");
  const cleanup = () => document.documentElement.classList.remove("quotation-printing");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1_000);
}, [lastSavedPayload]);

useEffect(() => {
  if (!printOnLoad || !lastSavedPayload || autoPrintStarted.current) return;
  autoPrintStarted.current = true;
  printSaved();
}, [lastSavedPayload, printOnLoad, printSaved]);

useEffect(() => {
  if (!isDirty) return;
  const warn = (event: BeforeUnloadEvent) => event.preventDefault();
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}, [isDirty]);
```

5. ใส่ desktop actions ทางขวาของ seller bar: Preview enabled, Share disabled, Print disabled เมื่อยังไม่บันทึก, Download disabled และ More dropdown
6. บน mobile ซ่อน actions รายตัวและให้ More dropdown มี Preview/Print พร้อม Share/Download disabled
7. More dropdown มี Delete เฉพาะ `payload.id`; กดแล้วเปิด confirmation Dialog และเรียก `deleteQuotationAction(payload.id)` จากนั้น `router.push("/admin/quotations")`
8. Header มี Close, main Save และ dropdown `บันทึกและปิด`; close ใช้ native confirm เมื่อ `isDirty`
9. เพิ่ม `beforeunload` listener เมื่อ dirty
10. Render Preview Dialog ด้วย current `payload`/`calculation`; render hidden print root ด้วย `lastSavedPayload` และ calculation ของ saved payload

ใช้ action labels ตรงตามนี้:

```tsx
<span>ดูตัวอย่าง</span>
<span>แชร์</span>
<span>พิมพ์</span>
<span>ดาวน์โหลด</span>
<span>เพิ่มเติม</span>
```

Disabled future actions ต้องมี `title="ยังไม่รองรับใน MVP นี้"` และห้ามมี `onClick`/`href`.

ใน `app/admin/quotations/[id]/page.tsx` เปลี่ยน signature และ editor call:

```tsx
export default async function EditQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const [{ id }, { print }] = await Promise.all([params, searchParams]);
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;
  if (!UUID.test(id)) notFound();
  const quotation = await getQuotationById(supabase, id);
  if (!quotation) notFound();
  return <QuotationEditor documentNumber={quotation.documentNumber} initialPayload={quotation.payload} printOnLoad={print === "1"} />;
}
```

ใน `app/globals.css` เพิ่ม:

```css
@page {
  size: A4;
  margin: 0;
}

@media print {
  html.quotation-printing body * {
    visibility: hidden !important;
  }

  html.quotation-printing [data-quotation-print],
  html.quotation-printing [data-quotation-print] * {
    visibility: visible !important;
  }

  html.quotation-printing [data-quotation-print] {
    display: block !important;
    position: absolute;
    inset: 0;
    width: 210mm;
    min-height: 297mm;
  }

  [data-quotation-document] tr,
  [data-quotation-document] section {
    break-inside: avoid;
  }
}
```

- [ ] **Step 5: Run UI/type checks and manually verify Preview/Print**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-service.test.ts tests/quotation-calculator.test.ts
npm run typecheck
```

Expected: PASS

Manual checks:

- New unsaved quotation: Preview works with `เลขที่ออกเมื่อบันทึก`; Print is disabled
- Saved quotation: Print uses last saved payload; unsaved edits remain visible in Editor/Preview but do not enter print output
- `/admin/quotations/<id>?print=1`: opens browser print once
- Public/internal notes are separated; internal notes never render in document
- Empty reference renders `-`; Subject never renders
- Empty unit renders blank; quantity always renders
- Closing dirty Editor warns; deleting asks confirmation

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- components/admin/quotations/quotation-document.tsx components/admin/quotations/quotation-editor.tsx app/admin/quotations/[id]/page.tsx app/globals.css tests/quotation-ui.test.ts
git commit -m "feat: add quotation preview and print actions"
```

---

### Task 5: Documentation, Responsive Verification, And Full Regression

**Files:**

- Create: `docs/quotation-management.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**

- Consumes: completed MVP 1 refinement behavior
- Produces: operator/developer documentation and verified Definition of Done

- [ ] **Step 1: Write the feature documentation**

สร้าง `docs/quotation-management.md` ด้วย sections และ facts ต่อไปนี้:

```markdown
# Quotation Management

## Scope

Admin users with `allow_tools.allow_quotation = true` can manage one seller profile and create, edit, preview, print, search, and soft-delete quotations. MVP 1 has no business status, approval, customer acceptance, payment tracking, WHT, installments, Public Share, QR, or PDF generator.

## Routes

- `/admin/quotations` — list, search, print, and soft delete
- `/admin/quotations/new` — create from the current seller profile snapshot
- `/admin/quotations/[id]` — edit the saved snapshot
- `/admin/quotations/settings/company` — create or replace the singleton seller profile

## Editor Rules

- Create/Edit is full-width responsive; Preview/Print is A4.
- Customer appears left and document data right on desktop; sections stack on mobile.
- Reference is optional and belongs to document data. There is no job-title field.
- Branch number is required only for Branch and is cleared for Head office.
- Quantity is required and greater than zero. Unit is optional.
- VAT is configured per item. Price mode appears above the item list.
- Share and Download are disabled future actions.

## Save And Snapshot Behavior

Seller and customer values are copied into each quotation. Changing the seller profile does not rewrite saved quotations. The server validates and recalculates all money before the transactional RPC replaces the quotation and its items.

## Preview And Print

Preview uses the current draft. Print is available only after the first successful save and uses the latest saved payload. Browser print CSS isolates the read-only A4 document from Admin navigation and edit controls.

## Asset Behavior

Seller logos are normalized to WebP, limited to 10 MB input and 1600 px on the longest side, and uploaded to `quotations/assets/<uuid>.webp` through the authenticated Media Worker adapter.

## Validation Checklist

- Seller name, address, and tax ID are required.
- Customer name and address are required.
- Branch number is required only for Branch.
- At least one item is required.
- Item name and quantity are required; unit is optional.
- Dates, discounts, VAT, emails, and trusted logo URLs are validated server-side.
- Save failures preserve the current draft and focus the first invalid field.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Verify Create/Edit and Preview/Print at mobile, tablet, laptop, and desktop widths.
```

เพิ่มลิงก์ `docs/quotation-management.md` และ route summary ใน `README.md`. เพิ่ม data flow ต่อไปนี้ใน `docs/architecture.md`:

```text
Quotation Editor
  -> Server Action permission/validation
  -> shared quotation calculator
  -> transactional Supabase RPC
  -> quotations + quotation_items

Seller logo
  -> browser WebP normalization
  -> server storage adapter
  -> authenticated Media Worker
  -> R2 quotations/assets/<uuid>.webp
```

- [ ] **Step 2: Run all automated checks**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands exit `0`. Existing lint warnings may be reported, but new errors or warnings from quotation files must be fixed before continuing.

- [ ] **Step 3: Verify responsive behavior in the local browser**

Run the existing dev server and inspect `/admin/quotations/new` and one saved `/admin/quotations/[id]` at:

```text
390x844 mobile
768x1024 tablet
1366x768 laptop
1920x1080 desktop
```

Expected:

- mobile sections stack and item cards have no clipped input/actions
- tablet/laptop customer and document blocks use balanced width without A4 whitespace
- desktop seller data and document actions share one row
- mobile document actions are reachable through More
- branch input appears only for Branch
- keyboard focus order follows the visible form
- error summary focuses the corresponding visible field
- A4 Preview/Print has no Admin shell, form controls, clipped item rows, or internal notes

- [ ] **Step 4: Apply and verify the migration against local Supabase**

Run local Supabase without resetting data, apply pending migrations, capture local credentials without printing them, and run the integration test:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase migration list --local
npx supabase db lint --local --fail-on error
$local = @{}
npx supabase status -o env | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') {
    $local[$matches[1]] = $matches[2].Trim('"')
  }
}
$env:LOCAL_SUPABASE_URL = $local['API_URL']
$env:LOCAL_SUPABASE_ANON_KEY = $local['ANON_KEY']
$env:LOCAL_SUPABASE_SERVICE_ROLE_KEY = $local['SERVICE_ROLE_KEY']
$env:RUN_LOCAL_SUPABASE_TESTS = '1'
node --import ./tests/register-server-only.mjs --test tests/quotation-database-integration.test.ts
Remove-Item Env:RUN_LOCAL_SUPABASE_TESTS,Env:LOCAL_SUPABASE_URL,Env:LOCAL_SUPABASE_ANON_KEY,Env:LOCAL_SUPABASE_SERVICE_ROLE_KEY
Remove-Variable local
```

Expected: migration list contains the CLI-generated refinement migration, database lint exits `0`, and the integration test passes including `persists a null unit while quantity remains required`. Do not run `db reset` and do not push the migration to a linked remote project in this task.

- [ ] **Step 5: Commit documentation and any verification-only fixes**

```powershell
git add -- README.md docs/architecture.md docs/quotation-management.md
git commit -m "docs: document quotation editor refinement"
```

Final status must report:

- files changed
- migration environment used
- Worker deployment result or explicit skip reason
- typecheck/lint/test/build results
- responsive/print viewports checked
- documentation updated
- unrelated pre-existing worktree changes left untouched
