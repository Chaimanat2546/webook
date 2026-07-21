# Quotation Seller Settings Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนหน้าข้อมูลผู้ขายหลักเป็น settings workspace สอง section ที่เปลี่ยนด้วย URL, แสดงตัวอย่างโลโก้ก่อนบันทึก, ใช้ข้อความภาษาไทย และซ่อนหมายเหตุเฉพาะธนาคารใน editor รายใบ

**Architecture:** ใช้ route เดิม `/admin/quotations/settings/company` และ query `section=company|payments` เป็น source of truth เพื่อให้ navigation เป็น link จริงและแสดง content ครั้งละหนึ่ง section แยก master company form และ master payment settings เป็น export คนละตัวจาก component เดิม โดยไม่แก้ schema, action หรือ snapshot data; logo preview ใช้ native `URL.createObjectURL` พร้อม cleanup ใน React effect

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui primitives, Lucide icons, Node test runner

## Global Constraints

- Sidebar มีเพียง `ข้อมูลผู้ขายหลัก` และ `ช่องทางชำระเงิน`
- Navigation ต้องเปลี่ยน content ไม่ใช่เลื่อนไป anchor ในหน้าเดียวกัน
- ค่า `section` ที่ไม่รองรับต้อง fallback เป็น `company`
- House Workspace Shell ไม่ใช้กับหน้านี้ เพราะเป็นคนละ admin module; reuse เฉพาะ grid และ nav language
- Desktop เป็น sidebar ซ้าย/content ขวา; mobile/tablet เป็น navigation แนวนอน
- แสดง content ของ section ที่เลือกเพียง section เดียว
- ข้อความที่ผู้ใช้เห็นใน flow นี้ต้องเป็นภาษาไทยที่เข้าใจง่าย
- ซ่อนหมายเหตุเฉพาะ `mode="quotation"` และ `type="bank_transfer"`; master editor ยังแสดง
- การซ่อนหมายเหตุห้ามลบค่าที่บันทึกไว้เดิม
- ใช้ validation และ upload action เดิม ไม่เพิ่ม dependency
- ไม่แก้ schema, RLS, snapshot behavior หรือเพิ่มระบบลบโลโก้
- รักษาการแก้ formatting ที่มีอยู่แล้วใน `components/admin/quotations/company-profile-form.tsx`; ห้าม discard

---

## File Map

- Modify: `app/admin/quotations/settings/company/page.tsx` — resolve section query, render responsive settings navigation, and mount only the selected content
- Modify: `components/admin/quotations/company-profile-form.tsx` — separate company/payment exports, Thai copy, and local logo preview lifecycle
- Modify: `components/admin/quotations/payment-method-list.tsx` — hide bank instructions only in quotation mode
- Modify: `tests/quotation-ui.test.ts` — source-contract regressions following the repository's existing UI-test pattern
- Modify: `docs/quotation-management.md` — document two-section settings navigation and logo preview

### Task 1: Two-Section Settings Navigation

**Files:**
- Modify: `app/admin/quotations/settings/company/page.tsx`
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Produces: named exports `CompanyProfileForm` and `PaymentMethodsSettings`
- Consumes: `searchParams: Promise<{ section?: string }>` and existing repository results

- [ ] **Step 1: Write the failing navigation regression**

Add this test to the existing `describe("quotation UI", ...)` block in `tests/quotation-ui.test.ts`:

```ts
it("switches seller settings sections through URL navigation", () => {
  const page = source("../app/admin/quotations/settings/company/page.tsx");
  const form = source("../components/admin/quotations/company-profile-form.tsx");

  assert.match(page, /searchParams: Promise<\{ section\?: string \}>/);
  assert.match(page, /section === "payments" \? "payments" : "company"/);
  assert.match(page, /\?section=company/);
  assert.match(page, /\?section=payments/);
  assert.match(page, /aria-current=\{selectedSection === item\.id \? "page" : undefined\}/);
  assert.match(page, /selectedSection === "company"[\s\S]*<CompanyProfileForm/);
  assert.match(page, /selectedSection === "payments"[\s\S]*<PaymentMethodsSettings/);
  assert.match(form, /export function PaymentMethodsSettings/);
  assert.doesNotMatch(form, /<PaymentMethodsSettings[\s\S]*initialMethods=\{initialPaymentMethods\}/);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="switches seller settings sections" tests/quotation-ui.test.ts
```

Expected: FAIL because the page has no `searchParams`, section links, or separate payment export

- [ ] **Step 3: Separate the two settings components**

In `components/admin/quotations/company-profile-form.tsx`:

1. Remove `banks` and `initialPaymentMethods` from `CompanyProfileForm` props
2. Return only the seller `<form>` from `CompanyProfileForm`
3. Export the existing payment component with this signature:

```ts
export function PaymentMethodsSettings({
  banks,
  initialMethods,
}: {
  banks: BankOption[];
  initialMethods: CompanyPaymentMethod[];
}) {
  // Keep the existing state, save action, validation, and PaymentMethodList.
}
```

Do not change save actions or payment behavior in this task

- [ ] **Step 4: Implement URL-driven navigation**

Update `app/admin/quotations/settings/company/page.tsx` to accept and resolve the query:

```tsx
import { Building2, CreditCard } from "lucide-react";
import Link from "next/link";

import {
  CompanyProfileForm,
  PaymentMethodsSettings,
} from "../../../../../components/admin/quotations/company-profile-form";
import { cn } from "../../../../../lib/utils";

const sections = [
  {
    href: "/admin/quotations/settings/company?section=company",
    icon: Building2,
    id: "company",
    label: "ข้อมูลผู้ขายหลัก",
  },
  {
    href: "/admin/quotations/settings/company?section=payments",
    icon: CreditCard,
    id: "payments",
    label: "ช่องทางชำระเงิน",
  },
] as const;

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const selectedSection = section === "payments" ? "payments" : "company";

  // Keep requireAdmin, permission checks, and existing repository loading.
  // Render the shell below after seller data is prepared.
}
```

Use one responsive shell and render only the selected component:

```tsx
<div className="mx-auto grid w-full max-w-6xl gap-4">
  <Link className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline" href="/admin/quotations">
    กลับไปหน้ารายการใบเสนอราคา
  </Link>
  <header>
    <h1 className="text-xl font-semibold">ตั้งค่าข้อมูลใบเสนอราคา</h1>
    <p className="text-sm text-muted-foreground">จัดการข้อมูลผู้ขายและช่องทางรับชำระเงินของบัญชีนี้</p>
  </header>
  <div className="grid overflow-hidden rounded-lg border lg:grid-cols-[14rem_minmax(0,1fr)]">
    <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
      <div className="hidden border-b px-4 py-3 text-sm font-semibold lg:block">การตั้งค่า</div>
      <nav aria-label="ตั้งค่าข้อมูลใบเสนอราคา" className="flex gap-1 overflow-x-auto p-2 lg:grid lg:overflow-visible">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              aria-current={selectedSection === item.id ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm",
                selectedSection === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={item.href}
              key={item.id}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
    <main className="min-w-0 p-4 lg:p-6">
      {selectedSection === "company" ? (
        <CompanyProfileForm initialSeller={seller} />
      ) : null}
      {selectedSection === "payments" ? (
        <PaymentMethodsSettings banks={banks} initialMethods={paymentMethods} />
      ) : null}
    </main>
  </div>
</div>
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="seller settings sections|approved seller snapshot" tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: focused tests PASS and typecheck exits 0

Commit only the task files:

```powershell
git add -- app/admin/quotations/settings/company/page.tsx components/admin/quotations/company-profile-form.tsx tests/quotation-ui.test.ts
git commit -m "feat: add quotation settings navigation"
```

### Task 2: Thai Seller Copy And Immediate Logo Preview

**Files:**
- Modify: `components/admin/quotations/company-profile-form.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing `validateQuotationAssetFile(file)` and `saveCompanyProfileAction(formData)`
- Produces: native local preview lifecycle through `logoPreviewUrl: string`

- [ ] **Step 1: Write failing copy and preview regressions**

Add:

```ts
it("uses clear Thai seller copy and previews a selected logo before save", () => {
  const form = source("../components/admin/quotations/company-profile-form.tsx");

  for (const copy of [
    "ข้อมูลจดทะเบียน",
    "ชื่อบริษัท / ผู้ขาย",
    "เลขประจำตัวผู้เสียภาษี",
    "สำนักงานใหญ่",
    "ที่อยู่",
    "ช่องทางติดต่อบริษัท",
    "ผู้ติดต่อฝ่ายขาย",
    "โลโก้ผู้ขาย",
    "เลือกโลโก้ใหม่",
    "บันทึกข้อมูลผู้ขาย",
    "บันทึกช่องทางชำระเงิน",
  ]) assert.match(form, new RegExp(copy));

  assert.match(form, /URL\.createObjectURL\(file\)/);
  assert.match(form, /URL\.revokeObjectURL\(logoPreviewUrl\)/);
  assert.match(form, /onChange=\{handleLogoChange\}/);
  assert.match(form, /const displayedLogoUrl = logoPreviewUrl \|\| logoUrl/);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run the matching test name. Expected: FAIL on missing Thai copy and object URL lifecycle

- [ ] **Step 3: Add immediate validated preview with native browser APIs**

Change the React import and state:

```tsx
import { useEffect, useState, useTransition } from "react";

const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
const displayedLogoUrl = logoPreviewUrl || logoUrl;

useEffect(() => {
  return () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
  };
}, [logoPreviewUrl]);
```

Add the file-change handler:

```tsx
function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  setError("");
  if (!file) {
    setLogoPreviewUrl("");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    event.target.value = "";
    setLogoPreviewUrl("");
    setError("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
    return;
  }
  try {
    validateQuotationAssetFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoUnavailable(false);
  } catch {
    event.target.value = "";
    setLogoPreviewUrl("");
    setError("รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP");
  }
}
```

Bind `onChange={handleLogoChange}` to the file input and render `displayedLogoUrl`. After a successful save, call `setLogoPreviewUrl("")` before setting the returned persistent URL

- [ ] **Step 4: Replace user-visible English copy**

Use these exact mappings in `CompanyProfileForm`:

```text
Legal identity -> ข้อมูลจดทะเบียน
Company name -> ชื่อบริษัท / ผู้ขาย
Tax ID -> เลขประจำตัวผู้เสียภาษี
Office type -> ประเภทสำนักงาน
Head office -> สำนักงานใหญ่
Branch -> สาขา
Branch number -> เลขที่สาขา
Address -> ที่อยู่
Company contact -> ช่องทางติดต่อบริษัท
Phone -> เบอร์โทรศัพท์
Email -> อีเมล
Website -> เว็บไซต์
Sales contact -> ผู้ติดต่อฝ่ายขาย
Contact name -> ชื่อผู้ติดต่อ
Contact phone -> เบอร์โทรศัพท์ผู้ติดต่อ
Contact email -> อีเมลผู้ติดต่อ
Logo -> โลโก้ผู้ขาย
Replace logo -> เลือกโลโก้ใหม่
Saving -> กำลังบันทึก...
Save -> บันทึกข้อมูลผู้ขาย
Payment methods saved -> บันทึกช่องทางชำระเงินแล้ว
Save payment methods -> บันทึกช่องทางชำระเงิน
```

Translate component-owned fallback errors and file help text. Preserve server-provided Thai validation messages without remapping them

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="Thai seller copy|approved seller snapshot" tests/quotation-ui.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: tests and typecheck PASS; lint has 0 errors. If the existing `<img>` warning remains, record it without changing image storage behavior

Commit:

```powershell
git add -- components/admin/quotations/company-profile-form.tsx tests/quotation-ui.test.ts
git commit -m "feat: localize seller settings and preview logos"
```

### Task 3: Hide Bank Notes Only In Per-Quotation Editing

**Files:**
- Modify: `components/admin/quotations/payment-method-list.tsx`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing props `mode: "master" | "quotation"` and `method.type`
- Produces: boolean render condition only; no data normalization changes

- [ ] **Step 1: Write the failing visibility regression**

Add:

```ts
it("hides bank notes only in the per-quotation payment editor", () => {
  const payments = source("../components/admin/quotations/payment-method-list.tsx");

  assert.match(
    payments,
    /mode !== "quotation" \|\| method\.type !== "bank_transfer"[\s\S]*label="หมายเหตุ"/,
  );
  assert.match(payments, /update\("instructions", event\.target\.value/);
  assert.doesNotMatch(payments, /instructions:\s*""/);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run the matching test name. Expected: FAIL because instructions render for every type and mode

- [ ] **Step 3: Add the minimal render condition**

Wrap only the existing instructions field:

```tsx
{mode !== "quotation" || method.type !== "bank_transfer" ? (
  <Field
    error={error("instructions")}
    field={`paymentMethods.${index}.instructions`}
    label="หมายเหตุ"
  >
    <Textarea
      className="mt-3 min-h-16"
      onChange={(event) =>
        update("instructions", event.target.value as T["instructions"])
      }
      value={method.instructions}
    />
  </Field>
) : null}
```

Do not clear `method.instructions` on type or mode changes

- [ ] **Step 4: Run focused tests and commit**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="bank notes|payment validation errors" tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: PASS

Commit:

```powershell
git add -- components/admin/quotations/payment-method-list.tsx tests/quotation-ui.test.ts
git commit -m "fix: hide per-quotation bank notes"
```

### Task 4: Documentation And Responsive Verification

**Files:**
- Modify: `docs/quotation-management.md`
- Verify: `app/admin/quotations/settings/company/page.tsx`
- Verify: `components/admin/quotations/company-profile-form.tsx`
- Verify: `components/admin/quotations/payment-method-list.tsx`

**Interfaces:**
- Consumes: completed UI behavior from Tasks 1-3
- Produces: documented behavior and final verification evidence

- [ ] **Step 1: Update the existing feature documentation**

Add a concise `Seller Settings Navigation` subsection to `docs/quotation-management.md`:

```markdown
### Seller Settings Navigation

`/admin/quotations/settings/company` has two URL-driven sections:
`?section=company` for the seller profile and `?section=payments` for master
payment methods. The seller form previews a selected logo locally before save.
Master bank notes remain editable; the per-quotation bank-transfer editor hides
that field without deleting a previously saved value.
```

- [ ] **Step 2: Run the complete automated checks**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Expected: typecheck/build exit 0, all tests pass, lint has 0 errors

- [ ] **Step 3: Inspect the rendered UI at required widths**

Start the existing dev server if it is not already running, then verify:

```text
390x844   mobile: horizontal settings nav; no page overflow
768x1024  tablet: horizontal settings nav; fields remain readable
1280x800  laptop: left sidebar and right content; one section only
1536x960  desktop: same hierarchy without over-wide inputs
```

For both query values, verify active state, keyboard navigation, visible focus,
Thai copy, save feedback, logo preview before save, replacement preview, and
bank-note visibility in master versus quotation mode

- [ ] **Step 4: Apply the Gridgeist review checklist**

Fix only observed issues in this order: content clarity, hierarchy, alignment,
responsive overflow, accessibility, then polish. Do not add cards, animation,
routes, or abstractions not required by the approved spec

- [ ] **Step 5: Commit documentation or final verified adjustments**

```powershell
git add -- docs/quotation-management.md app/admin/quotations/settings/company/page.tsx components/admin/quotations/company-profile-form.tsx components/admin/quotations/payment-method-list.tsx tests/quotation-ui.test.ts
git commit -m "docs: update quotation seller settings flow"
```

Skip the commit if Task 4 makes no file changes; report verification only
