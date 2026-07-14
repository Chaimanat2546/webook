# Quotation Management MVP 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable quotation-management slice: permission-gated CRUD, one seller profile, per-quotation customer snapshots, exact money calculations, an inline A4 editor, preview, browser print, logo storage, and soft delete.

**Architecture:** Keep client state in one quotation editor, but route every mutation through Server Actions, a server validation/calculation service, and Supabase repositories. Use one shared pure BigInt calculator on client and server; save the quotation header and item rows through a transactional PostgreSQL RPC. Reuse the existing Media Worker/R2 and admin shell, adding only a trusted quotation-asset prefix.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS, existing shadcn/ui components, Supabase Auth/PostgreSQL/RLS, Cloudflare Worker/R2, Node test runner.

## Global Constraints

- Implement MVP 1 only. Do not create MVP 2 payment/signature tables or MVP 3 installment tables.
- Do not add document business status, workflow, approval, customer response, public QR, public quotation routes, PDF generation, email, or payment state.
- Use the normal Admin Shell. The House Workspace Shell does not apply.
- Require `public.users.allow_tools.allow_quotation = true` on every quotation page and mutation.
- Do not access Supabase directly from quotation Client Components.
- Recalculate all money server-side before save. Never persist client-submitted totals without recalculation.
- Use native `BigInt` scaled integers internally; never serialize `BigInt` through React, JSON, or Server Action results.
- Use browser `window.print()` and print CSS; do not install a PDF dependency.
- Use existing dependencies and shadcn components. Do not run dependency-install commands.
- Create the migration with the Supabase CLI. Never edit an existing migration.
- Work local -> staging -> production. Never test new SQL on production first.
- UI must be mobile-first and verified at mobile, tablet, laptop, and desktop sizes.
- Follow [the approved design](../specs/2026-07-14-quotation-management-design.md).

## File Map

Create:

- `lib/quotation-calculator.ts` — shared BigInt calculator and Thai baht text.
- `lib/quotation-dates.ts` — Bangkok issue-date and calendar validity helpers shared by server and client.
- `lib/quotation-types.ts` — serializable quotation, seller, and customer payload types shared by server and client.
- `lib/quotation-assets.ts` — trusted quotation asset names, keys, and URLs.
- `lib/quotation-image-resize.ts` — quotation image dimension policy.
- `server/services/quotations.ts` — payload normalization, validation, and server recalculation.
- `server/repositories/quotations.ts` — quotation/profile reads and RPC mutations.
- `server/storage/quotation-assets.ts` — Media Worker upload and cleanup.
- `app/admin/quotations/actions.ts` — save/delete/profile Server Actions.
- `app/admin/quotations/new/page.tsx` — create route.
- `app/admin/quotations/[id]/page.tsx` — edit route.
- `app/admin/quotations/settings/company/page.tsx` — seller-profile settings route.
- `components/admin/quotations/quotation-editor.tsx` — inline A4 editor, mobile sheet, preview, print, delete.
- `components/admin/quotations/quotation-list.tsx` — responsive list/table.
- `components/admin/quotations/company-profile-form.tsx` — seller profile and logo form.
- `tests/quotation-auth-ui.test.ts`
- `tests/quotation-calculator.test.ts`
- `tests/quotation-service.test.ts`
- `tests/quotation-migration.test.ts`
- `tests/quotation-database-integration.test.ts`
- `tests/quotation-repository-actions.test.ts`
- `tests/quotation-assets.test.ts`
- `tests/quotation-ui.test.ts`
- `docs/quotation-management.md`
- Supabase CLI-generated migration ending in `_quotation_management_mvp1.sql`.

Modify:

- `lib/env.ts` — expose the existing Media Worker configuration under a quotation-specific name.
- `server/auth/admin.ts` — add quotation permission helper.
- `app/admin/layout.tsx` — pass server-resolved quotation permission to the shell.
- `components/layout/admin-shell.tsx` — pass the permission to navigation.
- `components/layout/admin-desktop-sidebar.tsx` — render the permission-gated quotation item.
- `workers/media/src/index.ts` — accept `quotations/assets/` keys.
- `app/globals.css` — A4 preview and print-only layout rules.
- `README.md` — document the new MVP and permission.
- `docs/architecture.md` — document quotation data and storage flow.

---

### Task 1: Quotation Permission And Admin Navigation

**Files:**

- Create: `tests/quotation-auth-ui.test.ts`
- Create: `app/admin/quotations/page.tsx`
- Modify: `server/auth/admin.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`

**Interfaces:**

- Produces: `canUseQuotation(user): boolean`.
- Produces: `AdminShell({ canUseQuotation, children, defaultSidebarOpen })`.
- Produces: `AdminDesktopSidebar({ canUseQuotation, signOutAction })`.
- Consumes: existing `requireAdmin()` and `AdminUserForAuth`.

- [ ] **Step 1: Write the failing permission/navigation test**

Create `tests/quotation-auth-ui.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { canUseQuotation } from "../server/auth/admin.ts";

describe("quotation authorization and navigation", () => {
  it("requires the dedicated quotation permission", () => {
    assert.equal(canUseQuotation({ allow_tools: { allow_quotation: true } }), true);
    assert.equal(canUseQuotation({ allow_tools: { allow_accommodation: true } }), false);
    assert.equal(canUseQuotation({ allow_tools: null }), false);
    assert.equal(canUseQuotation(null), false);
  });

  it("passes server authorization into the admin sidebar", () => {
    const layout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
    const shell = readFileSync(
      new URL("../components/layout/admin-shell.tsx", import.meta.url),
      "utf8",
    );
    const sidebar = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );

    assert.match(layout, /canUseQuotation\(adminUser\)/);
    assert.match(shell, /canUseQuotation: boolean/);
    assert.match(sidebar, /canUseQuotation: boolean/);
    assert.match(sidebar, /canUseQuotation \? \(/);
    assert.match(sidebar, /href="\/admin\/quotations"/);
  });

  it("creates the protected quotation list route", () => {
    const page = new URL("../app/admin/quotations/page.tsx", import.meta.url);
    assert.equal(existsSync(page), true);
    const source = readFileSync(page, "utf8");
    assert.match(source, /canUseQuotation\(adminUser\)/);
    assert.match(source, /ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/quotation-auth-ui.test.ts
```

Expected: FAIL because `canUseQuotation` and the quotation route do not exist.

- [ ] **Step 3: Add the permission helper**

In `server/auth/admin.ts`, extend the existing interface and add the helper beside `canUseAccommodation`:

```ts
export interface AdminAllowTools {
  allow_accommodation?: boolean;
  allow_quotation?: boolean;
}

export function canUseQuotation(user: Pick<AdminUserForAuth, "allow_tools"> | null): boolean {
  return user?.allow_tools?.allow_quotation === true;
}
```

- [ ] **Step 4: Pass the server-owned permission through the shell**

Replace `app/admin/layout.tsx` with:

```tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import { canUseQuotation, requireAdmin } from "../../server/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { adminUser } = await requireAdmin();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell
      canUseQuotation={canUseQuotation(adminUser)}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AdminShell>
  );
}
```

Update the `AdminShell` signature and sidebar call in `components/layout/admin-shell.tsx`:

```tsx
export function AdminShell({
  canUseQuotation,
  children,
  defaultSidebarOpen = true,
}: {
  canUseQuotation: boolean;
  children: ReactNode;
  defaultSidebarOpen?: boolean;
}) {
```

```tsx
<AdminDesktopSidebar
  canUseQuotation={canUseQuotation}
  signOutAction={signOut}
/>
```

Update the sidebar import and prop in `components/layout/admin-desktop-sidebar.tsx`:

```tsx
import { FileTextIcon, HouseIcon, LogOutIcon, MegaphoneIcon } from "lucide-react";
```

```tsx
export function AdminDesktopSidebar({
  canUseQuotation,
  signOutAction,
}: {
  canUseQuotation: boolean;
  signOutAction: () => Promise<void>;
}) {
```

Insert this `SidebarMenuItem` after advertisements:

```tsx
{canUseQuotation ? (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      isActive={pathname.startsWith("/admin/quotations")}
      tooltip="ใบเสนอราคา"
    >
      <Link href="/admin/quotations" onClick={closeMobileSidebar}>
        <FileTextIcon data-icon="inline-start" />
        <span>ใบเสนอราคา</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
) : null}
```

- [ ] **Step 5: Add the initially protected quotation route**

Create `app/admin/quotations/page.tsx`:

```tsx
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";

export default async function QuotationsPage() {
  const { adminUser } = await requireAdmin();

  if (!canUseQuotation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_quotation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">ใบเสนอราคา</h1>
      <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลใบเสนอราคา</p>
    </div>
  );
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
node --test tests/quotation-auth-ui.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- server/auth/admin.ts app/admin/layout.tsx components/layout/admin-shell.tsx components/layout/admin-desktop-sidebar.tsx app/admin/quotations/page.tsx tests/quotation-auth-ui.test.ts
git commit -m "feat: add quotation access control"
```

---

### Task 2: BigInt Quotation Calculator And Thai Baht Text

**Files:**

- Create: `lib/quotation-calculator.ts`
- Create: `tests/quotation-calculator.test.ts`

**Interfaces:**

- Produces: `calculateQuotation(input: QuotationCalculationInput): QuotationCalculation`.
- Produces: `formatThaiBahtText(value: string): string`.
- Produces shared `PriceMode`, `DiscountType`, `VatTreatment`, `QuotationItemInput`, and calculation result types.
- No server, database, React, or browser dependencies.

- [ ] **Step 1: Write failing calculator tests**

Create `tests/quotation-calculator.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateQuotation,
  formatThaiBahtText,
  type QuotationCalculationInput,
} from "../lib/quotation-calculator.ts";

function baseInput(overrides: Partial<QuotationCalculationInput> = {}): QuotationCalculationInput {
  return {
    documentDiscountType: null,
    documentDiscountValue: "0",
    items: [
      {
        description: "",
        discountType: null,
        discountValue: "0",
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "บริการ",
        position: 1,
        quantity: "2",
        sku: "",
        unit: "งาน",
        unitPrice: "10000.00",
        vatRate: "7.00",
        vatTreatment: "taxable",
      },
    ],
    priceMode: "vat_exclusive",
    ...overrides,
  };
}

describe("quotation calculator", () => {
  it("calculates VAT-exclusive item totals", () => {
    const result = calculateQuotation(baseInput());
    assert.equal(result.subtotal, "20000.00");
    assert.equal(result.taxableTotal, "20000.00");
    assert.equal(result.vatTotal, "1400.00");
    assert.equal(result.grandTotal, "21400.00");
  });

  it("extracts VAT from VAT-inclusive prices", () => {
    const result = calculateQuotation(
      baseInput({
        items: [
          {
            ...baseInput().items[0],
            quantity: "1",
            unitPrice: "10700.00",
          },
        ],
        priceMode: "vat_inclusive",
      }),
    );
    assert.equal(result.taxableTotal, "10000.00");
    assert.equal(result.vatTotal, "700.00");
    assert.equal(result.grandTotal, "10700.00");
  });

  it("supports item and document percent discounts", () => {
    const input = baseInput({
      documentDiscountType: "percent",
      documentDiscountValue: "10",
      items: [
        {
          ...baseInput().items[0],
          discountType: "percent",
          discountValue: "10",
        },
      ],
    });
    const result = calculateQuotation(input);
    assert.equal(result.itemDiscountTotal, "2000.00");
    assert.equal(result.documentDiscountTotal, "1800.00");
    assert.equal(result.taxableTotal, "16200.00");
    assert.equal(result.vatTotal, "1134.00");
    assert.equal(result.grandTotal, "17334.00");
  });

  it("supports fixed item and document discounts", () => {
    const result = calculateQuotation(
      baseInput({
        documentDiscountType: "amount",
        documentDiscountValue: "500.00",
        items: [{
          ...baseInput().items[0],
          discountType: "amount",
          discountValue: "500.00",
        }],
      }),
    );
    assert.equal(result.itemDiscountTotal, "500.00");
    assert.equal(result.documentDiscountTotal, "500.00");
    assert.equal(result.taxableTotal, "19000.00");
    assert.equal(result.vatTotal, "1330.00");
    assert.equal(result.grandTotal, "20330.00");
  });

  it("allocates a fixed discount without losing a satang", () => {
    const result = calculateQuotation(
      baseInput({
        documentDiscountType: "amount",
        documentDiscountValue: "0.01",
        items: [
          { ...baseInput().items[0], id: "a", position: 1, quantity: "1", unitPrice: "1.00" },
          { ...baseInput().items[0], id: "b", position: 2, quantity: "1", unitPrice: "1.00" },
          { ...baseInput().items[0], id: "c", position: 3, quantity: "1", unitPrice: "1.00" },
        ],
      }),
    );
    assert.equal(
      result.lines.reduce(
        (sum, line) => sum + Number(line.documentDiscountAllocation),
        0,
      ),
      0.01,
    );
    assert.equal(result.documentDiscountTotal, "0.01");
  });

  it("distinguishes zero-rated, exempt, and no-VAT lines", () => {
    const result = calculateQuotation(
      baseInput({
        items: [
          { ...baseInput().items[0], id: "zero", position: 1, vatRate: "0.00" },
          {
            ...baseInput().items[0],
            id: "exempt",
            position: 2,
            vatRate: "0.00",
            vatTreatment: "exempt",
          },
          {
            ...baseInput().items[0],
            id: "none",
            position: 3,
            vatRate: "0.00",
            vatTreatment: "none",
          },
        ],
      }),
    );
    assert.equal(result.vatTotal, "0.00");
    assert.deepEqual(
      result.lines.map((line) => line.vatTreatment),
      ["taxable", "exempt", "none"],
    );
    assert.deepEqual(
      result.vatSummary.map((row) => `${row.vatTreatment}:${row.vatRate}`),
      ["taxable:0.00", "exempt:0.00", "none:0.00"],
    );
  });

  it("summarizes mixed VAT rates separately", () => {
    const result = calculateQuotation(baseInput({
      items: [
        { ...baseInput().items[0], id: "seven", position: 1, quantity: "1", unitPrice: "100.00" },
        { ...baseInput().items[0], id: "zero", position: 2, quantity: "1", unitPrice: "200.00", vatRate: "0.00" },
      ],
    }));
    assert.deepEqual(result.vatSummary, [
      { taxableAmount: "100.00", vatAmount: "7.00", vatRate: "7.00", vatTreatment: "taxable" },
      { taxableAmount: "200.00", vatAmount: "0.00", vatRate: "0.00", vatTreatment: "taxable" },
    ]);
  });

  it("rejects invalid money and discounts", () => {
    assert.throws(
      () => calculateQuotation(baseInput({ items: [{ ...baseInput().items[0], quantity: "0" }] })),
      /Quantity must be greater than zero/,
    );
    assert.throws(
      () =>
        calculateQuotation(
          baseInput({
            items: [
              {
                ...baseInput().items[0],
                discountType: "amount",
                discountValue: "30000",
              },
            ],
          }),
        ),
      /Discount cannot exceed item gross/,
    );
  });

  it("formats Thai baht text", () => {
    assert.equal(formatThaiBahtText("0.00"), "ศูนย์บาทถ้วน");
    assert.equal(formatThaiBahtText("21.00"), "ยี่สิบเอ็ดบาทถ้วน");
    assert.equal(formatThaiBahtText("1000001.25"), "หนึ่งล้านหนึ่งบาทยี่สิบห้าสตางค์");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/quotation-calculator.test.ts
```

Expected: FAIL because `lib/quotation-calculator.ts` does not exist.

- [ ] **Step 3: Implement the pure calculator**

Create `lib/quotation-calculator.ts` with these exact exported types and functions. Keep all intermediate values as non-negative `BigInt`:

```ts
export type DiscountType = "amount" | "percent" | null;
export type PriceMode = "vat_exclusive" | "vat_inclusive";
export type VatTreatment = "exempt" | "none" | "taxable";

export interface QuotationItemInput {
  description: string;
  discountType: DiscountType;
  discountValue: string;
  id: string;
  name: string;
  position: number;
  quantity: string;
  sku: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

export interface QuotationCalculationInput {
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
}

export interface QuotationLineCalculation extends QuotationItemInput {
  discountAmount: string;
  documentDiscountAllocation: string;
  grossAmount: string;
  lineTotal: string;
  taxableAmount: string;
  vatAmount: string;
}

export interface QuotationCalculation {
  documentDiscountTotal: string;
  grandTotal: string;
  itemDiscountTotal: string;
  lines: QuotationLineCalculation[];
  subtotal: string;
  taxableTotal: string;
  vatSummary: VatSummaryLine[];
  vatTotal: string;
}

export interface VatSummaryLine {
  taxableAmount: string;
  vatAmount: string;
  vatRate: string;
  vatTreatment: VatTreatment;
}

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 3;
const PERCENT_SCALE = 2;
const PERCENT_DENOMINATOR = 10_000n;

function tenPow(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function parseScaled(value: string, scale: number, label: string): bigint {
  const normalized = value.trim();
  if (normalized.length > 32) throw new Error(`${label} is too large`);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${label} is invalid`);
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > scale) throw new Error(`${label} has too many decimal places`);
  return BigInt(whole) * tenPow(scale) + BigInt(fraction.padEnd(scale, "0") || "0");
}

function formatScaled(value: bigint, scale: number): string {
  const divisor = tenPow(scale);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(scale, "0");
  return scale === 0 ? whole.toString() : `${whole}.${fraction}`;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Denominator must be positive");
  return (numerator + denominator / 2n) / denominator;
}

function discountAmount(type: DiscountType, value: string, base: bigint): bigint {
  if (type === null) return 0n;
  if (type === "amount") return parseScaled(value || "0", MONEY_SCALE, "Discount");
  const rate = parseScaled(value || "0", PERCENT_SCALE, "Discount percent");
  if (rate > PERCENT_DENOMINATOR) throw new Error("Discount percent must be between 0 and 100");
  return roundDiv(base * rate, PERCENT_DENOMINATOR);
}

function allocateProportionally(total: bigint, weights: bigint[]): bigint[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (total === 0n) return weights.map(() => 0n);
  if (weightTotal === 0n) throw new Error("Cannot allocate discount across zero-value items");

  const rows = weights.map((weight, index) => {
    const product = total * weight;
    return { allocation: product / weightTotal, index, remainder: product % weightTotal };
  });
  let remaining = total - rows.reduce((sum, row) => sum + row.allocation, 0n);
  const order = [...rows].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (const row of order) {
    if (remaining === 0n) break;
    rows[row.index]!.allocation += 1n;
    remaining -= 1n;
  }

  return rows.map((row) => row.allocation);
}

export function calculateQuotation(input: QuotationCalculationInput): QuotationCalculation {
  if (input.items.length === 0) throw new Error("Quotation requires at least one item");

  const prepared = input.items.map((item) => {
    const quantity = parseScaled(item.quantity, QUANTITY_SCALE, "Quantity");
    if (quantity <= 0n) throw new Error("Quantity must be greater than zero");
    const unitPrice = parseScaled(item.unitPrice, MONEY_SCALE, "Unit price");
    const gross = roundDiv(quantity * unitPrice, tenPow(QUANTITY_SCALE));
    const itemDiscount = discountAmount(item.discountType, item.discountValue, gross);
    if (itemDiscount > gross) throw new Error("Discount cannot exceed item gross");
    const afterItemDiscount = gross - itemDiscount;
    return { afterItemDiscount, gross, item, itemDiscount };
  });

  const discountBase = prepared.reduce((sum, item) => sum + item.afterItemDiscount, 0n);
  const documentDiscount = discountAmount(
    input.documentDiscountType,
    input.documentDiscountValue,
    discountBase,
  );
  if (documentDiscount > discountBase) throw new Error("Document discount cannot exceed subtotal");
  const allocations = allocateProportionally(
    documentDiscount,
    prepared.map((item) => item.afterItemDiscount),
  );

  const lines = prepared.map((preparedItem, index) => {
    const allocation = allocations[index] ?? 0n;
    const adjusted = preparedItem.afterItemDiscount - allocation;
    const rate =
      preparedItem.item.vatTreatment === "taxable"
        ? parseScaled(preparedItem.item.vatRate, PERCENT_SCALE, "VAT rate")
        : 0n;
    if (rate > PERCENT_DENOMINATOR) throw new Error("VAT rate must be between 0 and 100");

    let taxable = adjusted;
    let vat = 0n;
    let total = adjusted;
    if (preparedItem.item.vatTreatment === "taxable" && rate > 0n) {
      if (input.priceMode === "vat_exclusive") {
        vat = roundDiv(taxable * rate, PERCENT_DENOMINATOR);
        total = taxable + vat;
      } else {
        taxable = roundDiv(adjusted * PERCENT_DENOMINATOR, PERCENT_DENOMINATOR + rate);
        vat = adjusted - taxable;
      }
    }

    return {
      ...preparedItem.item,
      discountAmount: formatScaled(preparedItem.itemDiscount, MONEY_SCALE),
      documentDiscountAllocation: formatScaled(allocation, MONEY_SCALE),
      grossAmount: formatScaled(preparedItem.gross, MONEY_SCALE),
      lineTotal: formatScaled(total, MONEY_SCALE),
      taxableAmount: formatScaled(taxable, MONEY_SCALE),
      vatAmount: formatScaled(vat, MONEY_SCALE),
    };
  });

  function sum(field: "discountAmount" | "grossAmount" | "lineTotal" | "taxableAmount" | "vatAmount") {
    return lines.reduce(
      (total, line) => total + parseScaled(line[field], MONEY_SCALE, field),
      0n,
    );
  }

  const vatGroups = new Map<string, {
    taxableAmount: bigint;
    vatAmount: bigint;
    vatRate: string;
    vatTreatment: VatTreatment;
  }>();
  for (const line of lines) {
    const key = `${line.vatTreatment}:${line.vatRate}`;
    const current = vatGroups.get(key) ?? {
      taxableAmount: 0n,
      vatAmount: 0n,
      vatRate: line.vatRate,
      vatTreatment: line.vatTreatment,
    };
    current.taxableAmount += parseScaled(line.taxableAmount, MONEY_SCALE, "Taxable amount");
    current.vatAmount += parseScaled(line.vatAmount, MONEY_SCALE, "VAT amount");
    vatGroups.set(key, current);
  }

  return {
    documentDiscountTotal: formatScaled(documentDiscount, MONEY_SCALE),
    grandTotal: formatScaled(sum("lineTotal"), MONEY_SCALE),
    itemDiscountTotal: formatScaled(sum("discountAmount"), MONEY_SCALE),
    lines,
    subtotal: formatScaled(sum("grossAmount"), MONEY_SCALE),
    taxableTotal: formatScaled(sum("taxableAmount"), MONEY_SCALE),
    vatSummary: [...vatGroups.values()].map((row) => ({
      taxableAmount: formatScaled(row.taxableAmount, MONEY_SCALE),
      vatAmount: formatScaled(row.vatAmount, MONEY_SCALE),
      vatRate: row.vatRate,
      vatTreatment: row.vatTreatment,
    })),
    vatTotal: formatScaled(sum("vatAmount"), MONEY_SCALE),
  };
}

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readThaiSixDigits(value: string): string {
  const padded = value.padStart(6, "0");
  let output = "";
  for (let index = 0; index < padded.length; index += 1) {
    const digit = Number(padded[index]);
    if (digit === 0) continue;
    const position = padded.length - index - 1;
    if (position === 1 && digit === 1) output += "";
    else if (position === 1 && digit === 2) output += "ยี่";
    else if (position === 0 && digit === 1 && Number(value) > 10) output += "เอ็ด";
    else output += THAI_DIGITS[digit];
    output += THAI_POSITIONS[position];
  }
  return output;
}

function readThaiInteger(value: string): string {
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (normalized === "0") return THAI_DIGITS[0]!;
  if (normalized.length <= 6) return readThaiSixDigits(normalized);
  const head = normalized.slice(0, -6);
  const tail = normalized.slice(-6);
  return `${readThaiInteger(head)}ล้าน${Number(tail) === 0 ? "" : readThaiSixDigits(tail)}`;
}

export function formatThaiBahtText(value: string): string {
  const cents = parseScaled(value, MONEY_SCALE, "Amount");
  const baht = cents / 100n;
  const satang = cents % 100n;
  const bahtText = `${readThaiInteger(baht.toString())}บาท`;
  return satang === 0n
    ? `${bahtText}ถ้วน`
    : `${bahtText}${readThaiInteger(satang.toString())}สตางค์`;
}
```

- [ ] **Step 4: Run the calculator tests**

Run:

```powershell
node --test tests/quotation-calculator.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/quotation-calculator.ts tests/quotation-calculator.test.ts
git commit -m "feat: add quotation calculator"
```

---

### Task 3: Quotation Payload Validation Service

**Files:**

- Create: `lib/quotation-types.ts`
- Create: `lib/quotation-dates.ts`
- Create: `server/services/quotations.ts`
- Create: `tests/quotation-service.test.ts`

**Interfaces:**

- Consumes: `calculateQuotation()` and shared input types from Task 2.
- Produces from `lib/quotation-types.ts`: `QuotationPayload`, `SellerSnapshot`, and `CustomerSnapshot`.
- Produces from the server service: `PreparedQuotation` and payload parsing functions.
- Produces: `prepareQuotationPayload(value: unknown): PreparedQuotation`.
- Produces: `prepareSellerSnapshot(value: unknown): SellerSnapshot` for the company settings action.
- Produces: `QuotationValidationError` with `fieldErrors: Record<string, string>`.
- Produces: `emptyQuotationPayload(seller, now): QuotationPayload` for the create page.

- [ ] **Step 1: Write failing service tests**

Create `tests/quotation-service.test.ts` with a valid payload fixture and exact validation assertions:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addQuotationCalendarDays,
  getBangkokCalendarDate,
} from "../lib/quotation-dates.ts";
import {
  prepareQuotationPayload,
  QuotationValidationError,
} from "../server/services/quotations.ts";
import type { QuotationPayload } from "../lib/quotation-types.ts";

function validPayload(): QuotationPayload {
  return {
    currency: "THB",
    customer: {
      address: "99 ถนนสุขุมวิท กรุงเทพฯ",
      branchNumber: "",
      contactName: "",
      email: "customer@example.com",
      name: "บริษัท ตัวอย่าง จำกัด",
      officeType: "head_office",
      phone: "020000000",
      serviceLocation: "",
      shippingAddress: "",
      taxId: "",
    },
    documentDiscountType: null,
    documentDiscountValue: "0",
    id: null,
    internalNotes: "",
    issueDate: "2026-07-14",
    items: [
      {
        description: "",
        discountType: null,
        discountValue: "0",
        id: "123e4567-e89b-42d3-a456-426614174001",
        name: "ค่าบริการ",
        position: 1,
        quantity: "1",
        sku: "",
        unit: "งาน",
        unitPrice: "10000.00",
        vatRate: "7.00",
        vatTreatment: "taxable",
      },
    ],
    priceMode: "vat_exclusive",
    publicNotes: "",
    reference: "",
    seller: {
      address: "123 ถนนสุขุมวิท กรุงเทพฯ",
      branchNumber: "",
      contactEmail: "",
      contactName: "",
      contactPhone: "",
      email: "seller@example.com",
      logoUrl: "",
      name: "บริษัท วีบุ๊ก จำกัด",
      officeType: "head_office",
      phone: "020000001",
      taxId: "0100000000000",
      website: "",
    },
    subject: "บริการถ่ายภาพ",
    validUntil: "2026-07-29",
    validityDays: "15",
  };
}

describe("quotation service", () => {
  it("uses Bangkok dates and calendar-day validity", () => {
    assert.equal(
      getBangkokCalendarDate(new Date("2026-07-13T18:00:00.000Z")),
      "2026-07-14",
    );
    assert.equal(addQuotationCalendarDays("2026-07-14", 15), "2026-07-29");
  });

  it("normalizes and recalculates a valid payload", () => {
    const result = prepareQuotationPayload(validPayload());
    assert.equal(result.payload.customer.name, "บริษัท ตัวอย่าง จำกัด");
    assert.equal(result.calculation.grandTotal, "10700.00");
    assert.equal(result.amountInWords, "หนึ่งหมื่นเจ็ดร้อยบาทถ้วน");
  });

  it("requires seller, customer, dates, and at least one valid item", () => {
    const payload = validPayload();
    payload.seller.name = "";
    payload.customer.address = "";
    payload.items[0]!.name = "";

    assert.throws(
      () => prepareQuotationPayload(payload),
      (error) => {
        assert.equal(error instanceof QuotationValidationError, true);
        if (!(error instanceof QuotationValidationError)) return false;
        assert.equal(error.fieldErrors["seller.name"], "กรุณากรอกชื่อผู้ขาย");
        assert.equal(error.fieldErrors["customer.address"], "กรุณากรอกที่อยู่ลูกค้า");
        assert.equal(error.fieldErrors["items.0.name"], "กรุณากรอกชื่อรายการ");
        return true;
      },
    );
  });

  it("rejects invalid date and email values", () => {
    const payload = validPayload();
    payload.validityDays = "";
    payload.validUntil = "2026-07-13";
    payload.customer.email = "bad-email";
    assert.throws(
      () => prepareQuotationPayload(payload),
      (error) =>
        error instanceof QuotationValidationError &&
        error.fieldErrors.validUntil === "วันที่ใช้ได้ถึงต้องไม่น้อยกว่าวันที่ออกเอกสาร" &&
        error.fieldErrors["customer.email"] === "รูปแบบอีเมลลูกค้าไม่ถูกต้อง",
    );
  });

  it("recomputes valid-until in validity-days mode", () => {
    const payload = validPayload();
    payload.issueDate = "2026-07-20";
    payload.validityDays = "10";
    payload.validUntil = "2099-01-01";
    const result = prepareQuotationPayload(payload);
    assert.equal(result.payload.validUntil, "2026-07-30");
    assert.equal(result.rpcPayload.validity_days, 10);
  });

  it("does not trust submitted calculation fields", () => {
    const payload = { ...validPayload(), grandTotal: "1.00" };
    const result = prepareQuotationPayload(payload);
    assert.equal(result.calculation.grandTotal, "10700.00");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/quotation-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement exact payload types and validation**

Create `lib/quotation-dates.ts` first:

```ts
export function getBangkokCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addQuotationCalendarDays(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isInteger(days) || days < 0) {
    throw new Error("Invalid quotation date or validity days");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid quotation date or validity days");
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
```

Then create `lib/quotation-types.ts`, importing `DiscountType`, `PriceMode`, and `QuotationItemInput` from the calculator and exporting these exact client-safe types:

```ts
export type OfficeType = "branch" | "head_office";

export interface SellerSnapshot {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  email: string;
  logoUrl: string;
  name: string;
  officeType: OfficeType;
  phone: string;
  taxId: string;
  website: string;
}

export interface CustomerSnapshot {
  address: string;
  branchNumber: string;
  contactName: string;
  email: string;
  name: string;
  officeType: OfficeType;
  phone: string;
  serviceLocation: string;
  shippingAddress: string;
  taxId: string;
}

export interface QuotationPayload {
  currency: "THB";
  customer: CustomerSnapshot;
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  id: string | null;
  internalNotes: string;
  issueDate: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
  publicNotes: string;
  reference: string;
  seller: SellerSnapshot;
  subject: string;
  validUntil: string;
  validityDays: string;
}
```

Then create `server/services/quotations.ts`. Import the shared payload types, but do not mark this server file as client-safe or import it from a Client Component. Use explicit type guards; do not add Zod. The file must trim every string, validate `YYYY-MM-DD` dates by parsing UTC midnight, validate optional email only when non-empty, normalize item positions to `1..N`, call `calculateQuotation()`, and return this exact shape. Export the seller parser as `prepareSellerSnapshot()` and call the same function from `prepareQuotationPayload()` so settings and quotation saves cannot drift:

```ts
export interface PreparedQuotation {
  amountInWords: string;
  calculation: QuotationCalculation;
  payload: QuotationPayload;
  rpcPayload: {
    currency: "THB";
    customer_snapshot: CustomerSnapshot;
    document_discount_type: DiscountType;
    document_discount_value: string;
    id: string | null;
    internal_notes: string;
    issue_date: string;
    items: Array<{
      description: string;
      discount_amount: string;
      discount_type: DiscountType;
      discount_value: string;
      document_discount_allocation: string;
      gross_amount: string;
      id: string;
      line_total: string;
      name: string;
      position: number;
      quantity: string;
      sku: string;
      taxable_amount: string;
      unit: string;
      unit_price: string;
      vat_amount: string;
      vat_rate: string;
      vat_treatment: VatTreatment;
    }>;
    price_mode: PriceMode;
    public_notes: string;
    reference: string;
    seller_snapshot: SellerSnapshot;
    subject: string;
    totals: Pick<
      QuotationCalculation,
      | "documentDiscountTotal"
      | "grandTotal"
      | "itemDiscountTotal"
      | "subtotal"
      | "taxableTotal"
      | "vatTotal"
    >;
    valid_until: string;
    validity_days: number | null;
  };
}
```

Use this error class:

```ts
export class QuotationValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Quotation validation failed");
    this.name = "QuotationValidationError";
  }
}
```

Required validation messages:

```ts
const REQUIRED_MESSAGES = {
  customerAddress: "กรุณากรอกที่อยู่ลูกค้า",
  customerName: "กรุณากรอกชื่อลูกค้า",
  itemName: "กรุณากรอกชื่อรายการ",
  itemUnit: "กรุณากรอกหน่วยนับ",
  sellerAddress: "กรุณากรอกที่อยู่ผู้ขาย",
  sellerName: "กรุณากรอกชื่อผู้ขาย",
  sellerTaxId: "กรุณากรอกเลขประจำตัวผู้เสียภาษีผู้ขาย",
} as const;
```

Use these helpers rather than relying on truthy casts:

```ts
function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalEmail(value: string, field: string, message: string, errors: Record<string, string>) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = message;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
```

`prepareQuotationPayload()` must catch calculator errors and attach them to `items` or `documentDiscountValue` when possible; otherwise place the message under `_form`. It must discard unknown keys such as a client-provided `grandTotal`.

Enforce bounded input before calling the calculator: quotation `id` is null or a UUID; all item IDs are unique UUIDs; 1–100 items; `validityDays` is empty or an integer from 0–36,500; 200 characters for names/SKU/unit/contact/tax/phone/email fields; 2,000 for addresses and item descriptions; 5,000 for each notes field; 2,048 for website/logo strings; quantity at most 9 integer plus 3 fractional digits; money at most 12 integer plus 2 fractional digits; percentage at most 3 integer plus 2 fractional digits and numerically 0–100. When `validityDays` is non-empty, ignore the submitted `validUntil` and recompute it with `addQuotationCalendarDays(issueDate, days)`; when it is empty, validate the direct `validUntil`. `currency` must be exactly `THB`; `officeType`, `priceMode`, discount types, and VAT treatments must match their unions exactly. These bounds must yield field errors rather than allowing unbounded `BigInt` parsing or relying only on PostgreSQL casts.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```powershell
node --test tests/quotation-service.test.ts tests/quotation-calculator.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/quotation-dates.ts lib/quotation-types.ts server/services/quotations.ts tests/quotation-service.test.ts
git commit -m "feat: validate quotation payloads"
```

---

### Task 4: Quotation Schema, RLS, Atomic Numbering, And RPCs

**Files:**

- Create: Supabase CLI-generated `supabase/migrations/*_quotation_management_mvp1.sql`
- Create: `tests/quotation-migration.test.ts`
- Create: `tests/quotation-database-integration.test.ts`

**Interfaces:**

- Produces tables: `quotation_company_profiles`, `quotations`, `quotation_items`.
- Produces public RPCs: `save_quotation(jsonb)`, `soft_delete_quotation(uuid)`, `list_quotations(text, integer, integer)`.
- Produces private helpers: `has_quotation_permission()`, `next_quotation_number(date)`, transactional save/delete functions, and the daily counter table.
- Consumes `allow_tools @> '{"allow_quotation": true}'` with the existing `uid`/email identity fallback.
- Repository row types remain handwritten because this repository does not currently generate Supabase `Database` types.

- [ ] **Step 1: Create the migration with the local CLI**

Run from the repository root:

```powershell
$env:USERPROFILE = "C:\tmp"
& .\node_modules\.bin\supabase.cmd migration new quotation_management_mvp1
$MIGRATION = (Get-ChildItem 'supabase/migrations/*_quotation_management_mvp1.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$MIGRATION
```

Expected: one new timestamped migration path. Do not rename it and do not edit an older migration.

- [ ] **Step 2: Write the failing migration contract test**

Create `tests/quotation-migration.test.ts`:

```ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((name) => name.endsWith("_quotation_management_mvp1.sql"));
assert.ok(migrationName, "quotation migration must be created by the Supabase CLI");
const sql = readFileSync(
  new URL(`../supabase/migrations/${migrationName}`, import.meta.url),
  "utf8",
);

describe("quotation migration", () => {
  it("creates the MVP 1 tables without later-MVP scope", () => {
    assert.match(sql, /create table public\.quotation_company_profiles/i);
    assert.match(sql, /create table public\.quotations/i);
    assert.match(sql, /create table public\.quotation_items/i);
    assert.match(sql, /currency text not null default 'THB'/i);
    assert.doesNotMatch(sql, /amount_in_words/i);
    assert.doesNotMatch(sql, /quotation_(installments|payment_methods|signatures)/i);
  });

  it("uses dedicated permission-gated RLS", () => {
    assert.match(sql, /enable row level security/gi);
    assert.match(sql, /allow_quotation/);
    assert.match(sql, /users\.uid = auth\.uid\(\)/);
    assert.match(sql, /users\.email = auth\.jwt\(\) ->> 'email'/);
    assert.doesNotMatch(sql, /grant .* to anon/i);
  });

  it("numbers and saves quotations atomically", () => {
    assert.match(sql, /quotation_number_counters/);
    assert.match(sql, /QO-/);
    assert.match(sql, /on conflict \(issue_date\).*do update/is);
    assert.match(sql, /when v_running < 10000 then lpad.*else v_running::text/is);
    assert.match(sql, /create function private\.save_quotation/i);
    assert.match(sql, /create function public\.save_quotation/i);
    assert.match(sql, /create function public\.soft_delete_quotation/i);
  });

  it("keeps search and pagination in the database", () => {
    assert.match(sql, /create function public\.list_quotations/i);
    assert.match(sql, /count\(\*\) over \(\)/i);
    assert.match(sql, /limit least\(greatest\(p_page_size, 1\), 100\)/i);
  });
});
```

- [ ] **Step 3: Run the migration test and verify it fails**

```powershell
node --test tests/quotation-migration.test.ts
```

Expected: FAIL because the generated migration is empty.

- [ ] **Step 4: Add the exact schema and security boundary**

Use `apply_patch` on the path printed in Step 1. The migration must contain the following definitions. Keep the schema/column names and constraints exact so the repository in Task 5 matches it:

```sql
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.quotation_company_profiles (
  id smallint primary key default 1 check (id = 1),
  seller_name text not null default '',
  address text not null default '',
  tax_id text not null default '',
  office_type text not null default 'head_office'
    check (office_type in ('head_office', 'branch')),
  branch_number text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  logo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  issue_date date not null,
  valid_until date not null,
  validity_days integer check (validity_days is null or validity_days between 0 and 36500),
  reference text not null default '',
  subject text not null default '',
  currency text not null default 'THB' check (currency = 'THB'),
  price_mode text not null check (price_mode in ('vat_exclusive', 'vat_inclusive')),
  seller_snapshot jsonb not null,
  customer_snapshot jsonb not null,
  document_discount_type text
    check (document_discount_type is null or document_discount_type in ('amount', 'percent')),
  document_discount_value numeric(14,4) not null default 0 check (document_discount_value >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  item_discount_total numeric(14,2) not null check (item_discount_total >= 0),
  document_discount_total numeric(14,2) not null check (document_discount_total >= 0),
  taxable_total numeric(14,2) not null check (taxable_total >= 0),
  vat_total numeric(14,2) not null check (vat_total >= 0),
  grand_total numeric(14,2) not null check (grand_total >= 0),
  public_notes text not null default '',
  internal_notes text not null default '',
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quotations_valid_dates check (valid_until >= issue_date)
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  position integer not null check (position > 0),
  sku text not null default '',
  name text not null,
  description text not null default '',
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_type text check (discount_type is null or discount_type in ('amount', 'percent')),
  discount_value numeric(14,4) not null default 0 check (discount_value >= 0),
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  discount_amount numeric(14,2) not null check (discount_amount >= 0),
  document_discount_allocation numeric(14,2) not null check (document_discount_allocation >= 0),
  vat_treatment text not null check (vat_treatment in ('taxable', 'exempt', 'none')),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 100),
  taxable_amount numeric(14,2) not null check (taxable_amount >= 0),
  vat_amount numeric(14,2) not null check (vat_amount >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quotation_id, position)
);

create table private.quotation_number_counters (
  issue_date date primary key,
  last_value integer not null check (last_value > 0)
);

create index quotations_active_updated_idx
  on public.quotations (updated_at desc) where deleted_at is null;
create index quotations_active_document_idx
  on public.quotations (document_number) where deleted_at is null;
create index quotation_items_quotation_position_idx
  on public.quotation_items (quotation_id, position);

alter table public.quotation_company_profiles enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

grant select, insert, update on public.quotation_company_profiles to authenticated;
grant select on public.quotations, public.quotation_items to authenticated;
```

After those table definitions, add these functions and policies. `next_quotation_number` is called only inside the save transaction, so a failed insert rolls the counter increment back:

```sql
create or replace function private.has_quotation_permission()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users
    where coalesce(users.allow_tools, '{}'::jsonb) @> '{"allow_quotation": true}'::jsonb
      and (users.uid = auth.uid() or users.email = auth.jwt() ->> 'email')
  );
$$;

create or replace function private.next_quotation_number(p_issue_date date)
returns text
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_running integer;
begin
  insert into private.quotation_number_counters (issue_date, last_value)
  values (p_issue_date, 1)
  on conflict (issue_date) do update
    set last_value = private.quotation_number_counters.last_value + 1
  returning last_value into v_running;

  return 'QO-' || to_char(p_issue_date, 'YYYYMMDD') || '-' ||
    case when v_running < 10000 then lpad(v_running::text, 4, '0') else v_running::text end;
end;
$$;

create policy "Quotation users can manage the company profile"
on public.quotation_company_profiles for all to authenticated
using ((select private.has_quotation_permission()))
with check ((select private.has_quotation_permission()));

create policy "Quotation users can read active quotations"
on public.quotations for select to authenticated
using (deleted_at is null and (select private.has_quotation_permission()));

create policy "Quotation users can read active quotation items"
on public.quotation_items for select to authenticated
using (
  (select private.has_quotation_permission())
  and exists (
    select 1 from public.quotations
    where quotations.id = quotation_items.quotation_id
      and quotations.deleted_at is null
  )
);
```

- [ ] **Step 5: Add the complete transactional save and delete functions**

Append this SQL to the same migration:

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

  v_id := nullif(p_payload ->> 'id', '')::uuid;

  if v_id is null then
    v_id := gen_random_uuid();
    v_document_number := private.next_quotation_number((p_payload ->> 'issue_date')::date);
    insert into public.quotations (
      id, document_number, issue_date, valid_until, validity_days, reference, subject,
      currency, price_mode, seller_snapshot, customer_snapshot, document_discount_type,
      document_discount_value, subtotal, item_discount_total, document_discount_total,
      taxable_total, vat_total, grand_total, public_notes,
      internal_notes, created_by, updated_by
    ) values (
      v_id, v_document_number, (p_payload ->> 'issue_date')::date,
      (p_payload ->> 'valid_until')::date, nullif(p_payload ->> 'validity_days', '')::integer,
      coalesce(p_payload ->> 'reference', ''), coalesce(p_payload ->> 'subject', ''),
      p_payload ->> 'currency', p_payload ->> 'price_mode', p_payload -> 'seller_snapshot',
      p_payload -> 'customer_snapshot', nullif(p_payload ->> 'document_discount_type', ''),
      (p_payload ->> 'document_discount_value')::numeric,
      (p_payload #>> '{totals,subtotal}')::numeric,
      (p_payload #>> '{totals,itemDiscountTotal}')::numeric,
      (p_payload #>> '{totals,documentDiscountTotal}')::numeric,
      (p_payload #>> '{totals,taxableTotal}')::numeric,
      (p_payload #>> '{totals,vatTotal}')::numeric,
      (p_payload #>> '{totals,grandTotal}')::numeric,
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
      currency = p_payload ->> 'currency',
      price_mode = p_payload ->> 'price_mode',
      seller_snapshot = p_payload -> 'seller_snapshot',
      customer_snapshot = p_payload -> 'customer_snapshot',
      document_discount_type = nullif(p_payload ->> 'document_discount_type', ''),
      document_discount_value = (p_payload ->> 'document_discount_value')::numeric,
      subtotal = (p_payload #>> '{totals,subtotal}')::numeric,
      item_discount_total = (p_payload #>> '{totals,itemDiscountTotal}')::numeric,
      document_discount_total = (p_payload #>> '{totals,documentDiscountTotal}')::numeric,
      taxable_total = (p_payload #>> '{totals,taxableTotal}')::numeric,
      vat_total = (p_payload #>> '{totals,vatTotal}')::numeric,
      grand_total = (p_payload #>> '{totals,grandTotal}')::numeric,
      public_notes = coalesce(p_payload ->> 'public_notes', ''),
      internal_notes = coalesce(p_payload ->> 'internal_notes', ''),
      updated_by = auth.uid(),
      updated_at = now()
    where quotations.id = v_id and quotations.deleted_at is null
    returning quotations.document_number into v_document_number;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception using errcode = 'P0002', message = 'Quotation not found';
    end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items')
  loop
    insert into public.quotation_items (
      quotation_id, position, sku, name, description, quantity, unit, unit_price,
      discount_type, discount_value, gross_amount, discount_amount,
      document_discount_allocation, vat_treatment, vat_rate, taxable_amount,
      vat_amount, line_total
    ) values (
      v_id, (v_item ->> 'position')::integer, coalesce(v_item ->> 'sku', ''),
      v_item ->> 'name', coalesce(v_item ->> 'description', ''),
      (v_item ->> 'quantity')::numeric, v_item ->> 'unit',
      (v_item ->> 'unit_price')::numeric, nullif(v_item ->> 'discount_type', ''),
      (v_item ->> 'discount_value')::numeric, (v_item ->> 'gross_amount')::numeric,
      (v_item ->> 'discount_amount')::numeric,
      (v_item ->> 'document_discount_allocation')::numeric,
      v_item ->> 'vat_treatment', (v_item ->> 'vat_rate')::numeric,
      (v_item ->> 'taxable_amount')::numeric, (v_item ->> 'vat_amount')::numeric,
      (v_item ->> 'line_total')::numeric
    );
  end loop;

  return query select v_id, v_document_number;
end;
$$;

create or replace function private.soft_delete_quotation(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_deleted_id uuid;
begin
  if not private.has_quotation_permission() then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;

  update public.quotations
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where id = p_id and deleted_at is null
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception using errcode = 'P0002', message = 'Quotation not found';
  end if;
  return v_deleted_id;
end;
$$;
```

- [ ] **Step 6: Add public wrappers and database-side list pagination**

Append:

```sql
create or replace function public.save_quotation(p_payload jsonb)
returns table (id uuid, document_number text)
language sql
security invoker
set search_path = pg_catalog, public
as $$ select * from private.save_quotation(p_payload); $$;

create or replace function public.soft_delete_quotation(p_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public
as $$ select private.soft_delete_quotation(p_id); $$;

create or replace function public.list_quotations(
  p_search text default '',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  document_number text,
  issue_date date,
  valid_until date,
  customer_name text,
  grand_total numeric,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    quotations.id,
    quotations.document_number,
    quotations.issue_date,
    quotations.valid_until,
    coalesce(quotations.customer_snapshot ->> 'name', ''),
    quotations.grand_total,
    quotations.updated_at,
    count(*) over ()
  from public.quotations
  where quotations.deleted_at is null
    and (
      nullif(trim(p_search), '') is null
      or quotations.document_number ilike '%' || trim(p_search) || '%'
      or quotations.reference ilike '%' || trim(p_search) || '%'
      or quotations.subject ilike '%' || trim(p_search) || '%'
      or coalesce(quotations.customer_snapshot ->> 'name', '') ilike '%' || trim(p_search) || '%'
    )
  order by quotations.updated_at desc, quotations.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100);
$$;

revoke all on function private.has_quotation_permission() from public;
revoke all on function private.next_quotation_number(date) from public;
revoke all on function private.save_quotation(jsonb) from public;
revoke all on function private.soft_delete_quotation(uuid) from public;
revoke all on function public.save_quotation(jsonb) from public, anon;
revoke all on function public.soft_delete_quotation(uuid) from public, anon;
revoke all on function public.list_quotations(text, integer, integer) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.has_quotation_permission() to authenticated;
grant execute on function private.save_quotation(jsonb) to authenticated;
grant execute on function private.soft_delete_quotation(uuid) to authenticated;
grant execute on function public.save_quotation(jsonb) to authenticated;
grant execute on function public.soft_delete_quotation(uuid) to authenticated;
grant execute on function public.list_quotations(text, integer, integer) to authenticated;
```

Granting `USAGE` lets the security-invoker wrappers and RLS policy execute already-granted private helpers. The `private` schema must remain absent from Supabase/PostgREST exposed schemas, `next_quotation_number` receives no authenticated execute grant, and every granted private mutation repeats the permission check before using owner privileges.

- [ ] **Step 7: Add an opt-in local Supabase integration test**

Create `tests/quotation-database-integration.test.ts`. It must skip during ordinary `npm run test` and run only when `RUN_LOCAL_SUPABASE_TESTS=1`, so CI without a local stack remains deterministic:

```ts
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1";
const url = process.env.LOCAL_SUPABASE_URL ?? "";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "Quotation-local-test-2026!";
const issueDate = "2099-12-31";
const otherDate = "2099-12-30";
const snapshotDate = "2099-12-29";

function payload(id: string | null, date = issueDate) {
  return {
    currency: "THB",
    customer_snapshot: { address: "Customer address", name: "Customer" },
    document_discount_type: null,
    document_discount_value: "0.00",
    id,
    internal_notes: "",
    issue_date: date,
    items: [{
      description: "",
      discount_amount: "0.00",
      discount_type: null,
      discount_value: "0.00",
      document_discount_allocation: "0.00",
      gross_amount: "100.00",
      id: crypto.randomUUID(),
      line_total: "107.00",
      name: "Item",
      position: 1,
      quantity: "1.000",
      sku: "",
      taxable_amount: "100.00",
      unit: "งาน",
      unit_price: "100.00",
      vat_amount: "7.00",
      vat_rate: "7.00",
      vat_treatment: "taxable",
    }],
    price_mode: "vat_exclusive",
    public_notes: "",
    reference: "",
    seller_snapshot: { address: "Seller address", name: "Seller", taxId: "0100000000000" },
    subject: "Integration test",
    totals: {
      documentDiscountTotal: "0.00",
      grandTotal: "107.00",
      itemDiscountTotal: "0.00",
      subtotal: "100.00",
      taxableTotal: "100.00",
      vatTotal: "7.00",
    },
    valid_until: date,
    validity_days: 0,
  };
}

async function save(client: SupabaseClient, value: ReturnType<typeof payload>) {
  const { data, error } = await client.rpc("save_quotation", { p_payload: value });
  assert.equal(error, null, error?.message);
  const row = (data as Array<{ document_number: string; id: string }> | null)?.[0];
  assert.ok(row);
  return row;
}

describe("quotation local database integration", { skip: !enabled }, () => {
  const service = createClient(
    url || "http://127.0.0.1:54321",
    serviceRoleKey || "local-test-skipped",
    {
    auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const allowed = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const denied = createClient(url || "http://127.0.0.1:54321", anonKey || "local-test-skipped", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let allowedId = "";
  let deniedId = "";

  before(async () => {
    assert.ok(url && anonKey && serviceRoleKey, "local Supabase environment is required");
    const allowedEmail = `quotation-allowed-${crypto.randomUUID()}@example.test`;
    const deniedEmail = `quotation-denied-${crypto.randomUUID()}@example.test`;
    const allowedCreated = await service.auth.admin.createUser({
      email: allowedEmail,
      email_confirm: true,
      password,
    });
    const deniedCreated = await service.auth.admin.createUser({
      email: deniedEmail,
      email_confirm: true,
      password,
    });
    assert.equal(allowedCreated.error, null, allowedCreated.error?.message);
    assert.equal(deniedCreated.error, null, deniedCreated.error?.message);
    allowedId = allowedCreated.data.user!.id;
    deniedId = deniedCreated.data.user!.id;

    const usersInsert = await service.from("users").insert([
      { allow_tools: { allow_quotation: true }, email: allowedEmail, uid: allowedId },
      { allow_tools: {}, email: deniedEmail, uid: deniedId },
    ]);
    assert.equal(usersInsert.error, null, usersInsert.error?.message);
    assert.equal((await allowed.auth.signInWithPassword({ email: allowedEmail, password })).error, null);
    assert.equal((await denied.auth.signInWithPassword({ email: deniedEmail, password })).error, null);
  });

  after(async () => {
    await service.from("quotations").delete().in("issue_date", [issueDate, otherDate, snapshotDate]);
    if (allowedId) await service.from("users").delete().eq("uid", allowedId);
    if (deniedId) await service.from("users").delete().eq("uid", deniedId);
    if (allowedId) await service.auth.admin.deleteUser(allowedId);
    if (deniedId) await service.auth.admin.deleteUser(deniedId);
  });

  it("enforces permission, numbering, snapshots, edit stability, and soft delete", async () => {
    const deniedSave = await denied.rpc("save_quotation", { p_payload: payload(null) });
    assert.equal(deniedSave.error?.code, "42501");

    const created = await Promise.all(
      Array.from({ length: 12 }, () => save(allowed, payload(null))),
    );
    assert.deepEqual(
      created.map((row) => row.document_number).sort(),
      Array.from({ length: 12 }, (_, index) =>
        `QO-20991231-${String(index + 1).padStart(4, "0")}`,
      ),
    );

    const first = created.find((row) => row.document_number.endsWith("-0001"))!;
    const edited = await save(allowed, payload(first.id, otherDate));
    assert.equal(edited.document_number, "QO-20991231-0001");

    const resetDate = await save(allowed, payload(null, otherDate));
    assert.equal(resetDate.document_number, "QO-20991230-0001");

    const deleted = await allowed.rpc("soft_delete_quotation", { p_id: first.id });
    assert.equal(deleted.error, null, deleted.error?.message);
    const hidden = await allowed.from("quotations").select("id").eq("id", first.id);
    assert.equal(hidden.error, null, hidden.error?.message);
    assert.equal(hidden.data?.length, 0);

    const afterDelete = await save(allowed, payload(null));
    assert.equal(afterDelete.document_number, "QO-20991231-0013");

    const deniedRead = await denied.from("quotations").select("id");
    assert.equal(deniedRead.error, null, deniedRead.error?.message);
    assert.deepEqual(deniedRead.data, []);

    const initialProfile = await allowed.from("quotation_company_profiles").upsert({
      address: "Original address",
      id: 1,
      seller_name: "Original seller",
      tax_id: "0100000000000",
    });
    assert.equal(initialProfile.error, null, initialProfile.error?.message);
    const snapshotPayload = payload(null, snapshotDate);
    snapshotPayload.seller_snapshot.name = "Original seller";
    const snapshotted = await save(allowed, snapshotPayload);
    const changedProfile = await allowed.from("quotation_company_profiles").update({
      seller_name: "Changed seller",
    }).eq("id", 1);
    assert.equal(changedProfile.error, null, changedProfile.error?.message);
    const storedSnapshot = await allowed.from("quotations")
      .select("seller_snapshot")
      .eq("id", snapshotted.id)
      .single();
    assert.equal(storedSnapshot.error, null, storedSnapshot.error?.message);
    assert.equal(
      (storedSnapshot.data?.seller_snapshot as { name?: string } | null)?.name,
      "Original seller",
    );
  });
});
```

- [ ] **Step 8: Run static and local-database verification**

```powershell
node --test tests/quotation-migration.test.ts
$env:USERPROFILE = "C:\tmp"
& .\node_modules\.bin\supabase.cmd status
& .\node_modules\.bin\supabase.cmd db reset
npm run typecheck
```

Then, in the same PowerShell process, capture local credentials without printing them and run the opt-in test:

```powershell
$status = & .\node_modules\.bin\supabase.cmd status -o env
$values = @{}
foreach ($line in $status) {
  if ($line -match '^([^=]+)="?(.*?)"?$') { $values[$matches[1]] = $matches[2] }
}
$env:LOCAL_SUPABASE_URL = $values['API_URL']
$env:LOCAL_SUPABASE_ANON_KEY = $values['ANON_KEY']
$env:LOCAL_SUPABASE_SERVICE_ROLE_KEY = $values['SERVICE_ROLE_KEY']
$env:RUN_LOCAL_SUPABASE_TESTS = '1'
node --test tests/quotation-database-integration.test.ts
Remove-Item Env:LOCAL_SUPABASE_URL,Env:LOCAL_SUPABASE_ANON_KEY,Env:LOCAL_SUPABASE_SERVICE_ROLE_KEY,Env:RUN_LOCAL_SUPABASE_TESTS
```

Expected: migration test PASS; `status` confirms a local Supabase stack before `db reset`; migration applies cleanly; integration test PASS including 12 parallel saves with unique numbers. If the local stack is unavailable, report that database execution was skipped instead of pointing the CLI at staging or production. Never print or persist the captured local keys.

- [ ] **Step 9: Commit**

```powershell
git add -- $MIGRATION tests/quotation-migration.test.ts tests/quotation-database-integration.test.ts
git commit -m "feat: add quotation database schema"
```

---

### Task 5: Quotation Repository And Permission-Gated Server Actions

**Files:**

- Create: `server/repositories/quotations.ts`
- Create: `app/admin/quotations/actions.ts`
- Create: `tests/quotation-repository-actions.test.ts`

**Interfaces:**

- Produces `getQuotationCompanyProfile`, `saveQuotationCompanyProfile`, `listQuotations`, `getQuotationById`, `saveQuotation`, and `softDeleteQuotation`.
- Produces `saveQuotationAction(value)`, `deleteQuotationAction(id)`, and later extends the same file with `saveCompanyProfileAction(formData)` in Task 7.
- Consumes `prepareQuotationPayload`, `canUseQuotation`, authenticated Supabase client, and the three RPCs from Task 4.
- Server Action results contain serializable strings/objects only; they never contain `BigInt`, Supabase clients, or raw database errors.

- [ ] **Step 1: Write the failing repository/action boundary test**

Create `tests/quotation-repository-actions.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repository = readFileSync(
  new URL("../server/repositories/quotations.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../app/admin/quotations/actions.ts", import.meta.url),
  "utf8",
);

describe("quotation repository and actions", () => {
  it("uses the transactional RPC for writes", () => {
    assert.match(repository, /\.rpc\("save_quotation"/);
    assert.match(repository, /\.rpc\("soft_delete_quotation"/);
    assert.match(repository, /\.rpc\("list_quotations"/);
    assert.doesNotMatch(repository, /\.from\("quotation_items"\)\.insert/);
  });

  it("checks the quotation permission before every action mutation", () => {
    assert.match(actions, /canUseQuotation\(adminUser\)/);
    assert.match(actions, /prepareQuotationPayload\(value\)/);
    assert.match(actions, /saveQuotation\(supabase, prepared\.rpcPayload\)/);
    assert.match(actions, /softDeleteQuotation\(supabase, id\)/);
  });

  it("returns field validation without leaking database errors", () => {
    assert.match(actions, /error instanceof QuotationValidationError/);
    assert.match(actions, /fieldErrors: error\.fieldErrors/);
    assert.match(actions, /ไม่สามารถบันทึกใบเสนอราคาได้/);
    assert.doesNotMatch(actions, /formError: error\.message/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-repository-actions.test.ts
```

Expected: FAIL because the repository and actions do not exist.

- [ ] **Step 3: Implement the repository with exact row and result types**

Create `server/repositories/quotations.ts`. Export these types:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerSnapshot,
  QuotationPayload,
  SellerSnapshot,
} from "../../lib/quotation-types";
import type { PreparedQuotation } from "../services/quotations";

export interface QuotationCompanyProfileRow {
  address: string;
  branch_number: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string;
  email: string;
  id: number;
  logo_url: string;
  seller_name: string;
  office_type: "branch" | "head_office";
  phone: string;
  tax_id: string;
  updated_at: string;
  website: string;
}

export interface QuotationListItem {
  customerName: string;
  documentNumber: string;
  grandTotal: string;
  id: string;
  issueDate: string;
  updatedAt: string;
  validUntil: string;
}

export interface QuotationListResult {
  items: QuotationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SavedQuotation {
  documentNumber: string;
  id: string;
}
```

Use one explicit select string for the edit route:

```ts
const quotationSelect = `
  id,document_number,issue_date,valid_until,validity_days,reference,subject,currency,price_mode,
  seller_snapshot,customer_snapshot,document_discount_type,document_discount_value,
  public_notes,internal_notes,
  quotation_items(
    id,position,sku,name,description,quantity,unit,unit_price,discount_type,
    discount_value,vat_treatment,vat_rate
  )
`;
```

Implement the repository functions with these exact behaviors:

```ts
export async function getQuotationCompanyProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("quotation_company_profiles")
    .select("id,seller_name,address,tax_id,office_type,branch_number,phone,email,website,contact_name,contact_phone,contact_email,logo_url,updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as QuotationCompanyProfileRow | null;
}

export async function saveQuotationCompanyProfile(
  supabase: SupabaseClient,
  seller: SellerSnapshot,
) {
  const { error } = await supabase.from("quotation_company_profiles").upsert({
    address: seller.address,
    branch_number: seller.branchNumber,
    contact_email: seller.contactEmail,
    contact_name: seller.contactName,
    contact_phone: seller.contactPhone,
    email: seller.email,
    id: 1,
    logo_url: seller.logoUrl,
    seller_name: seller.name,
    office_type: seller.officeType,
    phone: seller.phone,
    tax_id: seller.taxId,
    updated_at: new Date().toISOString(),
    website: seller.website,
  });
  if (error) throw new Error(error.message);
}

export async function listQuotations(
  supabase: SupabaseClient,
  { page, pageSize = 20, search }: { page: number; pageSize?: number; search: string },
): Promise<QuotationListResult> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize) || 20));
  const { data, error } = await supabase.rpc("list_quotations", {
    p_page: safePage,
    p_page_size: safePageSize,
    p_search: search.trim(),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows.map((row) => ({
      customerName: String(row.customer_name ?? ""),
      documentNumber: String(row.document_number ?? ""),
      grandTotal: String(row.grand_total ?? "0.00"),
      id: String(row.id ?? ""),
      issueDate: String(row.issue_date ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      validUntil: String(row.valid_until ?? ""),
    })),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

export async function saveQuotation(
  supabase: SupabaseClient,
  rpcPayload: PreparedQuotation["rpcPayload"],
): Promise<SavedQuotation> {
  const { data, error } = await supabase.rpc("save_quotation", { p_payload: rpcPayload });
  if (error) throw new Error(error.message);
  const row = (data as Array<{ document_number: string; id: string }> | null)?.[0];
  if (!row) throw new Error("Quotation save returned no row");
  return { documentNumber: row.document_number, id: row.id };
}

export async function softDeleteQuotation(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.rpc("soft_delete_quotation", { p_id: id });
  if (error) throw new Error(error.message);
  return String(data);
}
```

Also implement:

```ts
export async function getQuotationById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ documentNumber: string; payload: QuotationPayload } | null>
```

It must query `quotations` with `quotationSelect`, `.eq("id", id).is("deleted_at", null).maybeSingle()`, sort `quotation_items` in memory by `position`, convert every PostgreSQL numeric to a string, require `row.currency === "THB"`, convert snake_case snapshots/columns to `QuotationPayload`, and use each database item UUID as the client item `id`. Return `null` on no row and throw on Supabase error. Do not include calculated totals in the editable payload because Task 2 recalculates them.

Add pure mapping helpers `companyProfileToSeller(row)` and `quotationRowToPayload(row)` in this file and export them for focused fixture tests if the implementation grows beyond direct property mapping.

- [ ] **Step 4: Implement the serializable Server Action results**

Create `app/admin/quotations/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";
import {
  saveQuotation,
  softDeleteQuotation,
} from "../../../server/repositories/quotations";
import {
  prepareQuotationPayload,
  QuotationValidationError,
} from "../../../server/services/quotations";

export type QuotationActionResult =
  | { documentNumber: string; id: string; ok: true }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

function denied(): QuotationActionResult {
  return {
    fieldErrors: {},
    formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา",
    ok: false,
  };
}

export async function saveQuotationAction(value: unknown): Promise<QuotationActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return denied();

  try {
    const prepared = prepareQuotationPayload(value);
    const saved = await saveQuotation(supabase, prepared.rpcPayload);
    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${encodeURIComponent(saved.id)}`);
    return { ...saved, ok: true };
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: error.fieldErrors, formError: "", ok: false };
    }
    console.error(
      "Failed to save quotation",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      fieldErrors: {},
      formError: "ไม่สามารถบันทึกใบเสนอราคาได้ กรุณาลองอีกครั้ง",
      ok: false,
    };
  }
}

export async function deleteQuotationAction(
  id: string,
): Promise<{ formError: string; ok: false } | { id: string; ok: true }> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { formError: "รหัสใบเสนอราคาไม่ถูกต้อง", ok: false };
  }

  try {
    await softDeleteQuotation(supabase, id);
    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${encodeURIComponent(id)}`);
    return { id, ok: true };
  } catch (error) {
    console.error(
      "Failed to delete quotation",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { formError: "ไม่สามารถลบใบเสนอราคาได้ กรุณาลองอีกครั้ง", ok: false };
  }
}
```

- [ ] **Step 5: Run focused checks**

```powershell
node --test tests/quotation-repository-actions.test.ts tests/quotation-service.test.ts
npm run typecheck
```

Expected: PASS. If TypeScript exposes a Supabase RPC inference mismatch, narrow only the returned `data` after checking `error`; do not use `any`.

- [ ] **Step 6: Commit**

```powershell
git add -- server/repositories/quotations.ts app/admin/quotations/actions.ts tests/quotation-repository-actions.test.ts
git commit -m "feat: add quotation server boundary"
```

---

### Task 6: Trusted Quotation Logo Assets Through The Existing Media Worker

**Files:**

- Create: `lib/quotation-assets.ts`
- Create: `lib/quotation-image-resize.ts`
- Create: `server/storage/quotation-assets.ts`
- Create: `tests/quotation-assets.test.ts`
- Modify: `app/admin/quotations/actions.ts`
- Modify: `lib/env.ts`
- Modify: `workers/media/src/index.ts`

**Interfaces:**

- Produces `buildQuotationAssetObjectKey()`, `validateQuotationAssetObjectKey()`, `buildQuotationAssetUrl()`, `validateQuotationAssetUrl()`, and `validateQuotationAssetFile()`.
- Produces `resizeQuotationImageToMax(width, height)` with a 1600-pixel maximum side.
- Produces `uploadQuotationAssetObject()` and `deleteQuotationAssetObject()`.
- Consumes the existing `ADVERTISEMENT_IMAGE_WORKER_URL` and secret through the quotation-specific `getQuotationAssetEnv()` alias; no environment variable is added.
- The only accepted object namespace is `quotations/assets/<random>.webp`; no arbitrary URL fetch or proxy is introduced.

- [ ] **Step 1: Write failing asset and Worker tests**

Create `tests/quotation-assets.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
  validateQuotationAssetFile,
  validateQuotationAssetObjectKey,
  validateQuotationAssetUrl,
} from "../lib/quotation-assets.ts";
import { resizeQuotationImageToMax } from "../lib/quotation-image-resize.ts";
import {
  uploadQuotationAssetObject,
} from "../server/storage/quotation-assets.ts";
import worker from "../workers/media/src/index.ts";

function workerEnv() {
  return {
    ADVERTISEMENT_IMAGE_WORKER_SECRET: "secret",
    MEDIA_BUCKET: {
      async delete() {},
      async get() { return null; },
      async put(key: string) { return { key }; },
    },
  };
}

describe("quotation assets", () => {
  it("creates and validates random WebP keys under the quotation prefix", () => {
    const key = buildQuotationAssetObjectKey(() => "123e4567-e89b-42d3-a456-426614174000");
    assert.equal(key, "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp");
    assert.equal(validateQuotationAssetObjectKey(key), key);
    assert.throws(() => validateQuotationAssetObjectKey("quotations/assets/../secret.webp"));
    assert.throws(() => validateQuotationAssetObjectKey("https://example.com/logo.webp"));
  });

  it("encodes a trusted object key into a Worker URL", () => {
    assert.equal(
      buildQuotationAssetUrl(
        "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
        "https://media.example/",
      ),
      "https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
    );
    assert.equal(
      validateQuotationAssetUrl(
        "https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
        "https://media.example",
      ),
      "https://media.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
    );
    assert.throws(() =>
      validateQuotationAssetUrl(
        "https://tracker.example/quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
        "https://media.example",
      ),
    );
  });

  it("requires a WebP payload no larger than 10 MB", () => {
    const valid = new File([new Uint8Array([1])], "logo.webp", { type: "image/webp" });
    assert.equal(validateQuotationAssetFile(valid), valid);
    assert.throws(
      () => validateQuotationAssetFile(new File(["x"], "logo.png", { type: "image/webp" })),
      /WEBP/,
    );
    assert.throws(
      () => validateQuotationAssetFile(new File(["x"], "logo.svg", { type: "image/svg+xml" })),
      /WEBP/,
    );
    assert.throws(
      () => validateQuotationAssetFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.webp", { type: "image/webp" })),
      /10 MB/,
    );
  });

  it("limits the largest image side to 1600 pixels", () => {
    assert.deepEqual(resizeQuotationImageToMax(3200, 1600), { height: 800, width: 1600 });
    assert.deepEqual(resizeQuotationImageToMax(400, 300), { height: 300, width: 400 });
  });

  it("allows the exact quotation prefix in the Media Worker", async () => {
    const response = await worker.fetch(
      new Request("https://media.example/quotations/assets/logo.webp", {
        body: new Uint8Array([1]),
        headers: { authorization: "Bearer secret", "content-type": "image/webp" },
        method: "PUT",
      }),
      workerEnv(),
    );
    assert.equal(response.status, 200);
  });

  it("uses bearer auth and preserves a useful Worker error", async () => {
    const calls: RequestInit[] = [];
    await uploadQuotationAssetObject({
      body: new Uint8Array([1]),
      fetchImpl: async (_url, init) => {
        calls.push(init ?? {});
        return new Response("{}", { status: 200 });
      },
      objectKey: "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
      workerSecret: "secret",
      workerUrl: "https://media.example",
    });
    assert.equal((calls[0]?.headers as Record<string, string>).authorization, "Bearer secret");

    await assert.rejects(
      () => uploadQuotationAssetObject({
        body: new Uint8Array([1]),
        fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
        objectKey: "quotations/assets/123e4567-e89b-42d3-a456-426614174000.webp",
        workerSecret: "wrong",
        workerUrl: "https://media.example",
      }),
      /Failed to upload quotation asset \(401\): Unauthorized/,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-assets.test.ts
```

Expected: FAIL because the asset modules and Worker prefix are missing.

- [ ] **Step 3: Implement the trusted key, file, and URL policy**

Create `lib/quotation-assets.ts`:

```ts
const QUOTATION_ASSET_PREFIX = "quotations/assets/";
const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export function buildQuotationAssetObjectKey(
  randomUUID: () => string = crypto.randomUUID,
): string {
  return `${QUOTATION_ASSET_PREFIX}${randomUUID()}.webp`;
}

export function validateQuotationAssetObjectKey(value: string): string {
  const trimmed = value.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed).replace(/\\/g, "/");
  } catch {
    throw new Error("Invalid quotation asset key");
  }
  const fileName = decoded.slice(QUOTATION_ASSET_PREFIX.length);
  if (
    !decoded.startsWith(QUOTATION_ASSET_PREFIX) ||
    decoded.includes("://") ||
    decoded.split("/").some((part) => !part || part === "." || part === "..") ||
    !UUID.test(fileName)
  ) {
    throw new Error("Invalid quotation asset key");
  }
  return decoded;
}

export function buildQuotationAssetUrl(objectKey: string, workerUrl: string): string {
  const key = validateQuotationAssetObjectKey(objectKey)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const base = workerUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing quotation asset Worker URL");
  return `${base}/${key}`;
}

export function validateQuotationAssetUrl(value: string, workerUrl: string): string {
  const candidate = new URL(value);
  const base = new URL(workerUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  if (
    candidate.protocol !== base.protocol ||
    candidate.origin !== base.origin ||
    candidate.search ||
    candidate.hash ||
    !candidate.pathname.startsWith(`${basePath}/`)
  ) {
    throw new Error("Invalid quotation asset URL");
  }
  const objectKey = decodeURIComponent(candidate.pathname.slice(basePath.length + 1));
  return buildQuotationAssetUrl(validateQuotationAssetObjectKey(objectKey), workerUrl);
}

export function validateQuotationAssetFile(file: File): File {
  if (file.type !== "image/webp" || !file.name.toLowerCase().endsWith(".webp")) {
    throw new Error("โลโก้ต้องถูกแปลงเป็นไฟล์ WEBP");
  }
  if (file.size === 0) throw new Error("ไฟล์โลโก้ว่างเปล่า");
  if (file.size > MAX_BYTES) throw new Error("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
  return file;
}
```

Create `lib/quotation-image-resize.ts`:

```ts
export const QUOTATION_IMAGE_MAX_SIDE = 1600;

export function resizeQuotationImageToMax(
  width: number,
  height: number,
): { height: number; width: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive");
  }
  const largest = Math.max(width, height);
  if (largest <= QUOTATION_IMAGE_MAX_SIDE) {
    return { height: Math.round(height), width: Math.round(width) };
  }
  const scale = QUOTATION_IMAGE_MAX_SIDE / largest;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
```

- [ ] **Step 4: Add the storage adapter and environment alias**

In `lib/env.ts`, add:

```ts
export function getQuotationAssetEnv() {
  return getAdvertisementImageEnv();
}
```

Create `server/storage/quotation-assets.ts`:

```ts
import { buildQuotationAssetUrl } from "../../lib/quotation-assets";

interface Config {
  fetchImpl?: typeof fetch;
  objectKey: string;
  workerSecret: string;
  workerUrl: string;
}

async function workerError(action: string, response: Response): Promise<Error> {
  const body = (await response.text()).trim().slice(0, 200);
  return new Error(
    `Failed to ${action} quotation asset (${response.status})${body ? `: ${body}` : ""}`,
  );
}

export async function uploadQuotationAssetObject({
  body,
  fetchImpl = fetch,
  objectKey,
  workerSecret,
  workerUrl,
}: Config & { body: BodyInit }) {
  const response = await fetchImpl(buildQuotationAssetUrl(objectKey, workerUrl), {
    body,
    headers: {
      authorization: `Bearer ${workerSecret}`,
      "content-type": "image/webp",
    },
    method: "PUT",
  });
  if (!response.ok) throw await workerError("upload", response);
}

export async function deleteQuotationAssetObject({
  fetchImpl = fetch,
  objectKey,
  workerSecret,
  workerUrl,
}: Config) {
  const response = await fetchImpl(buildQuotationAssetUrl(objectKey, workerUrl), {
    headers: { authorization: `Bearer ${workerSecret}` },
    method: "DELETE",
  });
  if (!response.ok) throw await workerError("delete", response);
}
```

- [ ] **Step 5: Open the exact Worker namespace**

In `workers/media/src/index.ts`, replace the two-prefix condition with:

```ts
const ALLOWED_KEY_PREFIXES = ["advertisements/", "houses/", "quotations/assets/"] as const;
```

Then make `keyFromRequest()` reject when:

```ts
!ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
```

Keep the existing MIME allowlist, 10 MB body limit, bearer check for writes, traversal rejection, and immutable public GET behavior unchanged.

- [ ] **Step 6: Enforce the trusted asset origin on quotation saves**

In `app/admin/quotations/actions.ts`, after `prepareQuotationPayload(value)` and before `saveQuotation(...)`, validate a non-empty seller logo against the configured Worker:

```ts
const prepared = prepareQuotationPayload(value);
if (prepared.payload.seller.logoUrl) {
  const { workerUrl } = getQuotationAssetEnv();
  try {
    validateQuotationAssetUrl(prepared.payload.seller.logoUrl, workerUrl);
  } catch {
    return {
      fieldErrors: { "seller.logoUrl": "โลโก้ผู้ขายต้องมาจากพื้นที่จัดเก็บของระบบ" },
      formError: "",
      ok: false,
    };
  }
}
const saved = await saveQuotation(supabase, prepared.rpcPayload);
```

Map an invalid URL to `fieldErrors["seller.logoUrl"] = "โลโก้ผู้ขายต้องมาจากพื้นที่จัดเก็บของระบบ"`; do not return the attempted URL or fetch it. Add a source assertion to `tests/quotation-assets.test.ts` that the action calls `validateQuotationAssetUrl` before `saveQuotation`.

- [ ] **Step 7: Run focused and regression checks**

```powershell
node --test tests/quotation-assets.test.ts tests/media-worker.test.ts tests/advertisement-storage.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- app/admin/quotations/actions.ts lib/env.ts lib/quotation-assets.ts lib/quotation-image-resize.ts server/storage/quotation-assets.ts workers/media/src/index.ts tests/quotation-assets.test.ts
git commit -m "feat: add quotation logo storage"
```

---

### Task 7: Main Seller Profile Settings And Snapshot Source

**Files:**

- Create: `app/admin/quotations/settings/company/page.tsx`
- Create: `components/admin/quotations/company-profile-form.tsx`
- Create: `tests/quotation-ui.test.ts`
- Modify: `app/admin/quotations/actions.ts`

**Interfaces:**

- Produces `saveCompanyProfileAction(formData): CompanyProfileActionResult`.
- Produces `CompanyProfileForm({ initialSeller })`.
- Consumes `prepareSellerSnapshot`, profile repository functions, quotation asset helpers/storage, and the existing `Input`, `Textarea`, `Button`, `Alert`, and `Card` primitives.
- The database profile is the source only for a newly created quotation. Existing quotation seller snapshots never follow later profile edits.

- [ ] **Step 1: Add failing seller-settings coverage**

Create `tests/quotation-ui.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("quotation UI", () => {
  it("protects and renders the single seller profile page", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(page, /CompanyProfileForm/);
  });

  it("collects the approved seller snapshot fields and normalizes the logo", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");
    for (const name of [
      "name", "address", "taxId", "officeType", "branchNumber", "phone", "email",
      "website", "contactName", "contactPhone", "contactEmail", "logo",
    ]) {
      assert.match(form, new RegExp(`name=["']${name}["']`));
    }
    assert.match(form, /resizeQuotationImageToMax/);
    assert.match(form, /image\/webp/);
    assert.match(form, /10 \* 1024 \* 1024/);
  });

  it("keeps the old asset after a successful profile replacement", () => {
    const actions = source("../app/admin/quotations/actions.ts");
    assert.match(actions, /saveCompanyProfileAction/);
    assert.match(actions, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(actions, /cleanup newly uploaded quotation logo/i);
    assert.doesNotMatch(actions, /deleteQuotationAssetObject\([^)]*existing/i);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-ui.test.ts
```

Expected: FAIL because the seller settings page/form are missing.

- [ ] **Step 3: Add the company profile action with upload compensation**

Extend `app/admin/quotations/actions.ts` with imports for the profile repository, seller parser, asset helpers/storage, and `getQuotationAssetEnv`. Add:

```ts
export type CompanyProfileActionResult =
  | { logoUrl: string; ok: true }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveCompanyProfileAction(
  formData: FormData,
): Promise<CompanyProfileActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการข้อมูลผู้ขาย", ok: false };
  }

  const existing = await getQuotationCompanyProfile(supabase);
  const logoValue = formData.get("logo");
  const logo = logoValue instanceof File && logoValue.size > 0
    ? validateQuotationAssetFile(logoValue)
    : null;
  let uploadedObjectKey: string | null = null;

  try {
    let logoUrl = existing?.logo_url ?? "";
    if (logo) {
      const env = getQuotationAssetEnv();
      uploadedObjectKey = buildQuotationAssetObjectKey();
      await uploadQuotationAssetObject({
        body: await logo.arrayBuffer(),
        objectKey: uploadedObjectKey,
        workerSecret: env.workerSecret,
        workerUrl: env.workerUrl,
      });
      logoUrl = buildQuotationAssetUrl(uploadedObjectKey, env.workerUrl);
    }

    const seller = prepareSellerSnapshot({
      address: formString(formData, "address"),
      branchNumber: formString(formData, "branchNumber"),
      contactEmail: formString(formData, "contactEmail"),
      contactName: formString(formData, "contactName"),
      contactPhone: formString(formData, "contactPhone"),
      email: formString(formData, "email"),
      logoUrl,
      name: formString(formData, "name"),
      officeType: formString(formData, "officeType"),
      phone: formString(formData, "phone"),
      taxId: formString(formData, "taxId"),
      website: formString(formData, "website"),
    });
    await saveQuotationCompanyProfile(supabase, seller);
    revalidatePath("/admin/quotations/settings/company");
    return { logoUrl: seller.logoUrl, ok: true };
  } catch (error) {
    if (uploadedObjectKey) {
      // Cleanup newly uploaded quotation logo when the profile row was not saved.
      const env = getQuotationAssetEnv();
      await deleteQuotationAssetObject({
        objectKey: uploadedObjectKey,
        workerSecret: env.workerSecret,
        workerUrl: env.workerUrl,
      }).catch(() => undefined);
    }
    if (error instanceof QuotationValidationError) {
      const fieldErrors = Object.fromEntries(
        Object.entries(error.fieldErrors).map(([key, message]) => [
          key.replace(/^seller\./, ""),
          message,
        ]),
      );
      return { fieldErrors, formError: "", ok: false };
    }
    console.error(
      "Failed to save quotation company profile",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      fieldErrors: {},
      formError: "ไม่สามารถบันทึกข้อมูลผู้ขายได้ กรุณาลองอีกครั้ง",
      ok: false,
    };
  }
}
```

Do not accept `logoUrl` from the form. When no file is sent, retain the trusted URL already stored in the database. After a successful replacement, intentionally keep the old R2 object because issued quotation snapshots may still reference it.

- [ ] **Step 4: Implement client-side logo normalization**

In `components/admin/quotations/company-profile-form.tsx`, use a client component with `useState` and `useTransition`. Before submitting:

1. Reject the selected original if it is empty, exceeds `10 * 1024 * 1024`, or is not PNG/JPEG/WebP.
2. Decode with `createImageBitmap(file)`.
3. Call `resizeQuotationImageToMax(bitmap.width, bitmap.height)`.
4. Draw to a transparent canvas; do not paint a background, so alpha is preserved.
5. Convert using `canvas.toBlob(callback, "image/webp", 0.9)`.
6. Append `new File([blob], "quotation-logo.webp", { type: "image/webp" })` to `FormData` under `logo`.
7. Call `saveCompanyProfileAction(formData)` inside the transition and show its field/form errors inline.
8. Always call `bitmap.close()` in `finally`.

Use this field layout:

| Section | Fields | Responsive layout |
|---|---|---|
| Legal identity | `name`, `taxId`, `officeType`, conditional `branchNumber` | one column mobile, two columns `md` |
| Address | `address` textarea | full width |
| Company contact | `phone`, `email`, `website` | one column mobile, three columns `lg` |
| Sales contact | `contactName`, `contactPhone`, `contactEmail` | one column mobile, three columns `lg` |
| Logo | current image, `logo` file input, PNG/JPEG/WebP and 10 MB hint | full width |

Every input must have an associated visible `Label`; required fields are `name`, `address`, and `taxId`. Set `accept="image/png,image/jpeg,image/webp"`. Disable the submit button during conversion/save and announce the success/error message with `aria-live="polite"`.
If the current logo fails to load, replace it with a local `ไม่สามารถแสดงโลโก้` placeholder and keep the replace control available; do not fetch through a proxy.

- [ ] **Step 5: Implement the protected settings page**

Create `app/admin/quotations/settings/company/page.tsx` as a Server Component. Call `requireAdmin()`, return the same unauthorized `Empty` pattern as Task 1 when `canUseQuotation(adminUser)` is false, load `getQuotationCompanyProfile(supabase)`, convert it with `companyProfileToSeller`, and otherwise use an all-empty `SellerSnapshot`. Render:

- back link to `/admin/quotations`
- title `ข้อมูลผู้ขายหลัก`
- explanation that new quotations copy this profile as an editable snapshot
- `CompanyProfileForm initialSeller={seller}`

- [ ] **Step 6: Run focused checks**

```powershell
node --test tests/quotation-ui.test.ts tests/quotation-assets.test.ts tests/quotation-service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- app/admin/quotations/actions.ts app/admin/quotations/settings/company/page.tsx components/admin/quotations/company-profile-form.tsx tests/quotation-ui.test.ts
git commit -m "feat: add quotation seller settings"
```

---

### Task 8: Database-Paginated Quotation List

**Files:**

- Create: `components/admin/quotations/quotation-list.tsx`
- Modify: `app/admin/quotations/page.tsx`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**

- Produces `QuotationList({ quotations })` with mobile cards and a desktop table.
- Consumes `listQuotations(supabase, { page, pageSize: 20, search })` and the existing generic house `Pagination` component.
- Search covers document number, customer snapshot name, reference, and subject in the database RPC; the page never fetches all rows to filter in memory.

- [ ] **Step 1: Extend the failing UI test**

Append inside the existing `describe` in `tests/quotation-ui.test.ts`:

```ts
it("lists quotations with server search and pagination", () => {
  const page = source("../app/admin/quotations/page.tsx");
  const list = source("../components/admin/quotations/quotation-list.tsx");
  assert.match(page, /listQuotations\(supabase/);
  assert.match(page, /pageSize: 20/);
  assert.match(page, /name="q"/);
  assert.match(page, /href="\/admin\/quotations\/new"/);
  assert.match(page, /href="\/admin\/quotations\/settings\/company"/);
  assert.match(list, /"use client"/);
  assert.match(list, /md:hidden/);
  assert.match(list, /hidden[^"']*md:block/);
  assert.match(list, /deleteQuotationAction/);
  assert.match(list, /\?print=1/);
  assert.doesNotMatch(list, /สถานะ/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-ui.test.ts
```

Expected: FAIL because the real list has not replaced the Task 1 placeholder.

- [ ] **Step 3: Build the responsive list component**

Create `components/admin/quotations/quotation-list.tsx` as a Client Component because row delete needs confirmation and a Server Action. Use the existing `Card`, `Table`, `Button`, `Dialog`, and `Link` components. Export:

```ts
export function QuotationList({
  quotations,
}: {
  quotations: QuotationListItem[];
})
```

Use these formatting helpers:

```ts
const money = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  minimumFractionDigits: 2,
  style: "currency",
});

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH");
}
```

Mobile cards (`md:hidden`) show document number, customer, issue date, valid-until date, grand total, and touch-friendly `แก้ไข`, `พิมพ์`, `ลบ` actions. Desktop (`hidden overflow-hidden p-0 md:block`) shows the same information in a table plus updated time and the same three actions. Use `/admin/quotations/${encodeURIComponent(id)}` for edit and append `?print=1` for print. Do not render a status badge or infer expiration status.

Keep one selected `QuotationListItem | null` in state for the delete dialog. The dialog must show both `documentNumber` and `customerName`, call `deleteQuotationAction(selected.id)` inside a transition, retain the row and display a safe error on failure, and call `router.refresh()` only after success. Disable all delete confirms while pending. The query-string print route is completed in Task 10 and always prints the stored server-loaded quotation, never client row data.

- [ ] **Step 4: Replace the placeholder list page**

Update `app/admin/quotations/page.tsx` while retaining the Task 1 permission guard. Its page contract is:

```ts
export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
})
```

Normalize page with `Math.max(1, Number.parseInt(page ?? "1", 10) || 1)`, trim `q`, and call:

```ts
const result = await listQuotations(supabase, {
  page: requestedPage,
  pageSize: 20,
  search,
});
```

Render in this order:

1. Heading `ใบเสนอราคา` and subtitle `สร้าง แก้ไข พิมพ์ และจัดการใบเสนอราคา`.
2. Secondary link `ข้อมูลผู้ขายหลัก` to `/admin/quotations/settings/company`.
3. Primary link `สร้างใบเสนอราคา` to `/admin/quotations/new`.
4. GET search form with accessible label (visually hidden is acceptable), `name="q"`, and search button.
5. Empty state: `ยังไม่มีใบเสนอราคา` or `ไม่พบใบเสนอราคาที่ค้นหา`.
6. `QuotationList quotations={result.items}`.
7. Existing `Pagination` with `basePath="/admin/quotations"`, `currentPage={result.page}`, `search`, and `totalPages={result.totalPages}`.

If a requested page exceeds `totalPages`, call the repository once more with `page: result.totalPages`; this avoids an empty page after deleting the last row while keeping pagination in SQL.

- [ ] **Step 5: Run focused checks**

```powershell
node --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- app/admin/quotations/page.tsx components/admin/quotations/quotation-list.tsx tests/quotation-ui.test.ts
git commit -m "feat: add quotation list"
```

---

### Task 9: Create/Edit Routes And Desktop Inline A4 Editor

**Files:**

- Create: `app/admin/quotations/new/page.tsx`
- Create: `app/admin/quotations/[id]/page.tsx`
- Create: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**

- Produces `QuotationEditor({ initialPayload, documentNumber })`.
- Consumes `emptyQuotationPayload`, profile snapshot mapping, `getQuotationById`, `calculateQuotation`, `formatThaiBahtText`, and `saveQuotationAction`.
- The editor owns one serializable `QuotationPayload` state object. The A4 view reads from that state and every visible form control writes to the same state; there is no separate preview model.
- Desktop/laptop inputs appear where their values print. Mobile sheet behavior is added in Task 10 without changing the payload model.
- Client code imports payload/snapshot types only from `lib/quotation-types.ts`, never from `server/services/quotations.ts`.

- [ ] **Step 1: Extend the failing UI contract test**

Append inside `describe("quotation UI", ...)` in `tests/quotation-ui.test.ts`:

```ts
it("loads create and edit routes through server repositories", () => {
  const createPage = source("../app/admin/quotations/new/page.tsx");
  const editPage = source("../app/admin/quotations/[id]/page.tsx");
  assert.match(createPage, /getQuotationCompanyProfile\(supabase\)/);
  assert.match(createPage, /emptyQuotationPayload/);
  assert.match(editPage, /getQuotationById\(supabase, id\)/);
  assert.match(editPage, /notFound\(\)/);
  assert.match(createPage, /canUseQuotation\(adminUser\)/);
  assert.match(editPage, /canUseQuotation\(adminUser\)/);
});

it("uses one inline A4 payload for editing and calculation", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /"use client"/);
  assert.match(editor, /useState<QuotationPayload>/);
  assert.match(editor, /calculateQuotation/);
  assert.match(editor, /saveQuotationAction/);
  assert.match(editor, /quotation-paper/);
  assert.match(editor, /data-field="seller\.name"/);
  assert.match(editor, /data-field="customer\.name"/);
  assert.match(editor, /data-field="issueDate"/);
  assert.match(editor, /data-field="items\./);
  assert.match(editor, /documentDiscountValue/);
  assert.match(editor, /publicNotes/);
  assert.match(editor, /internalNotes/);
});

it("does not add out-of-scope quotation workflow", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.doesNotMatch(editor, /accepted|rejected|approval|publicToken|qrCode/i);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-ui.test.ts
```

Expected: FAIL because the routes and editor do not exist.

- [ ] **Step 3: Finish the create-payload helper**

In `server/services/quotations.ts`, make `emptyQuotationPayload(seller, now)` call the shared `getBangkokCalendarDate(now)` and `addQuotationCalendarDays(issueDate, 15)` helpers. The returned payload must use `currency = "THB"`, `validityDays = "15"`, `priceMode = "vat_exclusive"`, no document discount, empty customer/notes/reference/subject, and one new line with quantity `"1"`, unit `"งาน"`, price `"0.00"`, VAT treatment `"taxable"`, rate `"7.00"`, and `id: crypto.randomUUID()`.

- [ ] **Step 4: Implement the protected create route**

Create `app/admin/quotations/new/page.tsx` as a dynamic Server Component:

1. Call `requireAdmin()` and guard `canUseQuotation(adminUser)` before loading quotation data.
2. Load `getQuotationCompanyProfile(supabase)`.
3. If no row exists, render an `Empty` state explaining `ตั้งค่าข้อมูลผู้ขายหลักก่อนสร้างใบเสนอราคา` and a button to `/admin/quotations/settings/company`.
4. Convert the row with `companyProfileToSeller`.
5. Render `QuotationEditor initialPayload={emptyQuotationPayload(seller, new Date())} documentNumber={null}`.

The create route must not insert a row or reserve a document number merely by opening the page.

- [ ] **Step 5: Implement the protected edit route**

Create `app/admin/quotations/[id]/page.tsx`:

```ts
export const dynamic = "force-dynamic";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
})
```

Call `requireAdmin`, apply the quotation permission guard, validate `id` with the UUID expression from Task 5, and call `notFound()` for an invalid/missing/deleted quotation. Otherwise render:

```tsx
<QuotationEditor
  documentNumber={quotation.documentNumber}
  initialPayload={quotation.payload}
/>
```

- [ ] **Step 6: Build one typed editor state and update API**

Create `components/admin/quotations/quotation-editor.tsx` with `"use client"`. Export:

```ts
export interface QuotationEditorProps {
  documentNumber: string | null;
  initialPayload: QuotationPayload;
}

export function QuotationEditor({
  documentNumber: initialDocumentNumber,
  initialPayload,
}: QuotationEditorProps) {
```

The component state must be:

```ts
const [payload, setPayload] = useState<QuotationPayload>(initialPayload);
const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber);
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [formError, setFormError] = useState("");
const [isDirty, setIsDirty] = useState(false);
const [isPending, startTransition] = useTransition();
```

Keep update logic local and typed:

```ts
function updateRoot<K extends keyof QuotationPayload>(key: K, value: QuotationPayload[K])
function updateSeller<K extends keyof SellerSnapshot>(key: K, value: SellerSnapshot[K])
function updateCustomer<K extends keyof CustomerSnapshot>(key: K, value: CustomerSnapshot[K])
function updateItem<K extends keyof QuotationItemInput>(index: number, key: K, value: QuotationItemInput[K])
function addItem(): void
function removeItem(index: number): void
function moveItem(index: number, direction: -1 | 1): void
```

Every update sets `isDirty` and clears only the matching field error. `removeItem` must keep at least one row. `moveItem` and every add/remove operation must normalize positions to `1..N`; use up/down buttons rather than adding a drag-and-drop abstraction.

Calculate in `useMemo` from only `payload.items`, `payload.priceMode`, and document discount fields. Transient invalid input returns `{ calculation: null, calculationError: message }` rather than throwing from render. Never use `Number` for monetary arithmetic.

When a user edits `issueDate` and `validityDays` is non-empty, recompute `validUntil` with the shared `addQuotationCalendarDays()` helper. When they directly edit `validUntil`, clear `validityDays`. Provide two labeled modes: `จำนวนวัน` and `เลือกวันที่`.

- [ ] **Step 7: Build the inline A4 desktop composition**

Inside the editor render a toolbar followed by `<article className="quotation-paper">`. Use a white `210mm`-wide document with `min-height: 297mm`, but at normal screen widths wrap it in a horizontally centered `overflow-auto` work area. Task 10 adds fit-width mobile behavior.

Use transparent or lightly tinted controls with visible focus rings. Each actual control carries a stable `data-field` matching validation paths. Compose the paper in this order:

1. **Seller/document header:** trusted `seller.logoUrl` image (or compact `โลโก้` placeholder), editable `seller.name`, address, tax ID, office/branch, phone, email, website; right side title `ใบเสนอราคา`, read-only document number (`จะออกเลขเมื่อบันทึก` before first save), issue date, valid-until mode/value, reference, subject. Track image load failure locally and replace the broken image with the same placeholder; never proxy or retry against another URL.
2. **Customer block:** editable customer name/address, tax ID, office/branch, contact, phone, email, shipping address, service location. Keep rarely used shipping/service fields in the printed location but visually compact.
3. **Item table:** position controls, SKU, name/description, quantity, unit, unit price, discount type/value, VAT treatment/rate, and calculated amount. Use `inputMode="decimal"` for numeric strings. VAT treatment labels are `VAT`, `ยกเว้น VAT`, and `ไม่คิด VAT`; taxable rate `0.00` represents zero-rated.
4. **Document totals:** read-only currency `THB`, price mode, subtotal, item-discount total, document discount type/value, taxable total, VAT summary separated by treatment/rate, VAT total, grand total, and Thai baht text. Values are read-only outputs from `calculation`; show `—` while transient input is invalid.
5. **Notes:** `publicNotes` on the paper and a visually separated `internalNotes` card marked `ไม่แสดงในเอกสาร` outside the printable article.

Use local field wrapper components inside this file, not a new generic form system. Every input has an accessible label (`aria-label` may supplement a nearby printed label). Put `fieldErrors[path]` adjacent to its control and set `aria-invalid`.

- [ ] **Step 8: Wire save without trusting the preview calculation**

The toolbar includes back, save, preview, print, and delete locations; Task 10 completes preview/print/delete. Implement save now:

```ts
function save() {
  setFormError("");
  startTransition(async () => {
    const result = await saveQuotationAction(payload);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      const firstField = Object.keys(result.fieldErrors)[0];
      if (firstField) {
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>(
            `[data-field="${CSS.escape(firstField)}"]`,
          );
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus({ preventScroll: true });
        });
      }
      return;
    }
    setPayload((current) => ({ ...current, id: result.id }));
    setDocumentNumber(result.documentNumber);
    setFieldErrors({});
    setIsDirty(false);
    if (!payload.id) router.replace(`/admin/quotations/${encodeURIComponent(result.id)}?saved=1`);
    else router.refresh();
  });
}
```

Disable save while pending. Show `formError` in an `Alert` with `role="alert"`. When `fieldErrors` is non-empty, render a compact error summary at the top whose buttons are labeled with the field error and focus/scroll the matching `data-field`; keep the same message adjacent to each invalid field. Announce success with `aria-live="polite"`. Do not navigate away after updates, so the user retains their editor position.

- [ ] **Step 9: Run focused checks**

```powershell
node --test tests/quotation-ui.test.ts tests/quotation-calculator.test.ts tests/quotation-service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add -- server/services/quotations.ts app/admin/quotations/new/page.tsx 'app/admin/quotations/[id]/page.tsx' components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add inline quotation editor"
```

---

### Task 10: Mobile Field Sheet, Unsaved Preview, Browser Print, Dirty Guard, And Soft Delete

**Files:**

- Modify: `app/admin/quotations/[id]/page.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `app/globals.css`
- Modify: `tests/quotation-ui.test.ts`

**Interfaces:**

- Adds mobile `Sheet` editing to the same payload state from Task 9.
- Adds editor modes `edit | preview`; preview may show unsaved values.
- Adds `autoPrint` so list-row print loads the stored quotation route and then invokes browser print once.
- Print is browser-native and enabled only after the first successful save and while the current state is clean.
- Delete calls `deleteQuotationAction` and therefore remains a soft delete.
- Consumes existing `Sheet`, `Dialog`, `Alert`, `Button`, and `sonner` primitives; no UI/PDF dependency is added.

- [ ] **Step 1: Extend the failing interaction/source test**

Append inside the existing `describe` in `tests/quotation-ui.test.ts`:

```ts
it("supports mobile sheet editing at the printed field location", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /MobileEditTarget/);
  assert.match(editor, /<Sheet/);
  assert.match(editor, /setMobileTarget/);
  assert.match(editor, /md:hidden/);
  assert.match(editor, /hidden[^"']*md:block/);
});

it("previews unsaved state but prints only a clean numbered quotation", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const css = source("../app/globals.css");
  assert.match(editor, /window\.print\(\)/);
  assert.match(editor, /documentNumber/);
  assert.match(editor, /isDirty/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /autoPrint/);
  assert.match(source("../app/admin/quotations/[id]/page.tsx"), /searchParams/);
  assert.match(css, /@media print/);
  assert.match(css, /@page/);
  assert.match(css, /\.quotation-print-root/);
});

it("confirms and soft-deletes only persisted quotations", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /deleteQuotationAction/);
  assert.match(editor, /Dialog/);
  assert.match(editor, /payload\.id/);
  assert.match(editor, /router\.push\("\/admin\/quotations"\)/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
node --test tests/quotation-ui.test.ts
```

Expected: FAIL because the interactions and print CSS are not complete.

- [ ] **Step 3: Add mobile view/edit primitives at the real print positions**

Inside `quotation-editor.tsx`, define a discriminated union rather than using an untyped string:

```ts
type MobileEditTarget =
  | { group: "customer"; key: keyof CustomerSnapshot; label: string }
  | { group: "document"; key: "issueDate" | "reference" | "subject" | "validUntil" | "validityDays"; label: string }
  | { group: "item"; index: number; key: keyof QuotationItemInput; label: string }
  | { group: "notes"; key: "publicNotes"; label: string }
  | { group: "seller"; key: keyof SellerSnapshot; label: string };
```

Add `const [mobileTarget, setMobileTarget] = useState<MobileEditTarget | null>(null)`. Each printed field wrapper renders:

- a `<button type="button" className="md:hidden">` that displays the current value or `แตะเพื่อกรอก`, carries the same `data-field`, and opens the exact target
- the existing input/textarea/select with `className="hidden md:block"`

The mobile button must be at the same location in the A4 composition; do not create a separate long mobile form. For an item row, tapping any value opens that item's exact field. Add a compact `แก้ไขรายการ` button per mobile item row so users can move through name, description, quantity, unit, price, discount, and VAT without repeatedly closing the sheet.

Render one controlled `Sheet` at the editor root. Its title is `mobileTarget.label`; its control reads and writes the same `payload` through the typed update functions. Provide `ก่อนหน้า`, `ถัดไป`, and `เสร็จ` buttons when the target belongs to an item. Respect field control types:

- address/description/notes: `Textarea`
- office type, price mode, discount type, VAT treatment: native `select` styled consistently
- issue/valid dates: date input
- numeric strings: text input with `inputMode="decimal"`
- all other values: text/email/url/tel input as appropriate

Store the opening field path before setting `mobileTarget`. When the controlled sheet changes from open to closed, use `requestAnimationFrame` to focus the matching mobile `[data-field]` button so keyboard and assistive-technology users return to the position they edited. Let the existing Sheet primitive own focus trapping and Escape handling while open.

The mobile paper uses `width: min(210mm, 100%)`; typography and gaps use responsive classes so the viewport does not horizontally scroll. At `md` and above, retain the full inline desktop controls. Make the mobile action bar sticky with a solid background and give the editor bottom padding at least equal to the bar height plus `env(safe-area-inset-bottom)`, so totals and active fields are never obscured. Every icon-only/reorder action needs an accessible name and a minimum 44×44 px mobile target.

- [ ] **Step 4: Add preview and dirty-state behavior**

Add:

```ts
const [mode, setMode] = useState<"edit" | "preview">("edit");
```

Preview toggles the same A4 article to read-only printed values, hides add/remove/reorder controls and field errors, but keeps `payload` untouched. It is allowed before save and must show `ยังไม่ออกเลขเอกสาร` where the number will appear. Optional seller/customer/reference/subject/note rows with empty strings are omitted from Preview/Print instead of leaving large blank labels. Returning to edit restores controls and errors.

Register a `beforeunload` listener only while `isDirty`:

```ts
useEffect(() => {
  if (!isDirty) return;
  const warn = (event: BeforeUnloadEvent) => event.preventDefault();
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}, [isDirty]);
```

The toolbar back button checks `isDirty` and calls `window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่")` before `router.push("/admin/quotations")`. Do not add custom navigation infrastructure for links outside this editor.

- [ ] **Step 5: Add browser print with an explicit clean-save gate**

Disable print when `!documentNumber || isDirty || isPending`. Its adjacent hint must distinguish `บันทึกครั้งแรกเพื่อออกเลขเอกสารก่อนพิมพ์` from `บันทึกการแก้ไขก่อนพิมพ์`.

Printing must switch to preview and wait for React to paint:

```ts
async function printQuotation() {
  if (!documentNumber || isDirty || isPending) return;
  setMode("preview");
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  window.print();
}
```

Extend `QuotationEditorProps` with `autoPrint?: boolean`. In the edit route, accept `searchParams: Promise<{ print?: string }>` and pass `autoPrint={(await searchParams).print === "1"}`. In the editor use a `useRef(false)` guard and a mount effect to call `printQuotation()` once when `autoPrint && documentNumber && !isDirty`; this makes the list's `?print=1` action print server-loaded saved data. The ref prevents a print loop after re-render.

Add these rules to `app/globals.css`:

```css
.quotation-paper {
  aspect-ratio: 210 / 297;
  min-height: min(297mm, calc((100vw - 2rem) * 297 / 210));
  width: min(210mm, 100%);
}

@page {
  margin: 0;
  size: A4 portrait;
}

@media print {
  html,
  body {
    background: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body * {
    visibility: hidden !important;
  }

  .quotation-print-root,
  .quotation-print-root * {
    visibility: visible !important;
  }

  .quotation-print-root {
    left: 0;
    margin: 0 !important;
    position: absolute;
    top: 0;
    width: 210mm !important;
  }

  .quotation-paper {
    aspect-ratio: auto;
    box-shadow: none !important;
    min-height: 297mm;
    width: 210mm !important;
  }

  .no-print {
    display: none !important;
  }

  .quotation-item-row,
  .quotation-totals {
    break-inside: avoid;
  }
}
```

Wrap only the printable article in `quotation-print-root`. Apply `no-print` to the toolbar, internal notes, field errors, mobile sheet, add/remove/reorder controls, and delete dialog. Do not add a signature, stamp, approver, receiver, or approval block in MVP 1; those belong to the separately planned MVP 2.

- [ ] **Step 6: Complete soft delete and post-delete navigation**

Show delete only when `payload.id` is non-null. Use the existing `Dialog` with document number, `payload.customer.name`, irreversible-from-UI wording, cancel as default focus, and destructive confirm. On confirm:

1. Call `deleteQuotationAction(payload.id)` in a transition.
2. Keep the dialog open and show `formError` if it fails.
3. On success set dirty false, show a toast, and `router.push("/admin/quotations")` followed by `router.refresh()`.

Do not delete R2 logo assets. Do not reuse the deleted document number. The RPC and list RLS from Task 4 enforce both rules.

- [ ] **Step 7: Run automated checks**

```powershell
node --test tests/quotation-ui.test.ts tests/quotation-repository-actions.test.ts tests/quotation-calculator.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Verify responsive behavior in the running app**

Start the existing app with `npm run dev` only if it is not already running. Use a quotation-permitted test account and verify:

| Viewport | Required evidence |
|---|---|
| 390 × 844 mobile | no viewport horizontal scroll; A4 fits width; tapping seller/customer/document/item/notes fields opens the exact bottom-sheet editor; sheet controls remain above the viewport edge |
| 768 × 1024 tablet | inline fields are usable, toolbar wraps without overlap, A4 is centered |
| 1280 × 800 laptop | A4 and toolbar fit without shell overlap; item columns and focus rings are readable |
| 1440 × 900 desktop | centered A4, sensible whitespace, no over-wide controls |

Also verify: preview before save, first save issues a number, dirty print is disabled, saved print preview is A4 with admin chrome/internal notes hidden, delete confirmation, and list removal after delete. Capture screenshots or record the exact viewport/observation in the implementation chat; do not mark this step complete from source inspection alone.

- [ ] **Step 9: Commit**

```powershell
git add -- 'app/admin/quotations/[id]/page.tsx' app/globals.css components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: complete quotation preview and print flow"
```

---

### Task 11: Feature Documentation, Scope Audit, And Final Verification

**Files:**

- Create: `docs/quotation-management.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Verify without modifying: `.env.example`, `docs/api.md`

**Interfaces:**

- Documents the implemented routes, permission, data flow, calculation rules, snapshot behavior, storage boundary, errors, and test checklist.
- Confirms `.env.example` remains unchanged because Task 6 reuses the existing Media Worker variables.
- Confirms `docs/api.md` remains unchanged because MVP 1 exposes no public API route.

- [ ] **Step 1: Write the feature document from implemented behavior**

Create `docs/quotation-management.md` with these sections and concrete content:

1. `# Quotation Management MVP 1`
2. `## Scope` — CRUD, one seller profile, per-document customer/seller snapshots, item/discount/VAT calculation, preview, browser print, logo, soft delete.
3. `## Routes` — `/admin/quotations`, `/new`, `/[id]`, `/settings/company`.
4. `## Permission` — `users.allow_tools.allow_quotation`; page, Server Action, RLS/private-function enforcement.
5. `## Data flow` — Server Component read; Client editor; Server Action validation/recalculation; transactional RPC; PostgreSQL tables; Media Worker/R2 for logo only.
6. `## Document numbering` — `QO-YYYYMMDD-####`, allocated on first save, daily atomic counter, never changed/reused.
7. `## Snapshot behavior` — seller copied from the singleton profile then editable per quotation; customer entered per quotation; later master-data edits do not rewrite existing documents.
8. `## Calculation rules` — BigInt scales, exclusive/inclusive VAT, taxable/zero/exempt/none, item and document discounts, largest-remainder allocation, rounding and Thai baht text; amount-in-words is derived and is not stored in PostgreSQL.
9. `## Validation and errors` — required fields, dates, emails, money limits, item count, safe generic storage/database errors.
10. `## Logo policy` — PNG/JPEG/WebP selected client-side, selected source <=10 MB, WebP normalized to max 1600 px, `quotations/assets/<uuid>.webp`, no external URL fetch, old version retained for snapshots.
11. `## Preview and print` — preview unsaved; print only numbered and clean; browser A4, no generated PDF.
12. `## Delete behavior` — soft delete, hidden from list/read, number never reused, assets retained.
13. `## Testing checklist` — unit, migration/RLS, actions, Worker/storage, UI, four viewports, print preview.
14. `## Explicitly deferred` — every MVP 2/MVP 3 and non-goal from the approved design.

Do not describe future work as already available.

- [ ] **Step 2: Update overview and architecture docs**

In `README.md`, add a short `Quotation management MVP 1` subsection under current admin features with the four routes, `allow_quotation` permission, browser-print note, and link to `docs/quotation-management.md`. Keep house image management identified as the repository's original/current focus while noting this quotation module was explicitly added.

In `docs/architecture.md`, add one compact flow:

```text
Quotation Server Component
  -> authenticated Supabase reads protected by RLS
Quotation Client Editor
  -> Server Action
  -> validation + shared BigInt recalculation
  -> public RPC wrapper
  -> private SECURITY DEFINER transaction with permission recheck
  -> quotations + quotation_items

Seller logo
  -> client WebP normalization
  -> Server Action
  -> authenticated Media Worker
  -> R2 quotations/assets/
```

Document that client components never receive storage credentials and never query Supabase directly.

- [ ] **Step 3: Audit approved scope and type consistency**

Run:

```powershell
rg -n "TODO|TBD" app/admin/quotations components/admin/quotations lib/quotation-* server/repositories/quotations.ts server/services/quotations.ts server/storage/quotation-assets.ts tests/quotation-* docs/quotation-management.md
rg -n "accepted|rejected|approval_status|public_token|qr_code|installment|payment_status" app/admin/quotations components/admin/quotations server/repositories/quotations.ts server/services/quotations.ts supabase/migrations/*_quotation_management_mvp1.sql
rg -n "QuotationPayload|SellerSnapshot|CustomerSnapshot|PreparedQuotation|QuotationActionResult" app/admin/quotations components/admin/quotations server tests/quotation-*
```

Expected: first and second commands have no matches; the type names in the third command resolve consistently to Task 3 rather than duplicate local definitions. The Thai UI words `อนุมัติ` may appear only in documentation explaining deferred scope, never as implemented behavior.

- [ ] **Step 4: Re-run local database verification**

```powershell
$env:USERPROFILE = "C:\tmp"
& .\node_modules\.bin\supabase.cmd status
& .\node_modules\.bin\supabase.cmd db reset
node --test tests/quotation-migration.test.ts
```

Repeat Task 4 Step 8's in-memory `status -o env` credential capture and run `node --test tests/quotation-database-integration.test.ts` with `RUN_LOCAL_SUPABASE_TESTS=1`, then remove the environment variables. Expected: local stack confirmed; all migrations apply; contract and integration tests pass. Do not link or push this migration to a remote Supabase project in this task unless the user separately authorizes that target.

- [ ] **Step 5: Run the full project gate**

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
git status --short
```

Expected: all four project checks pass, diff check is clean, and status contains only the intended documentation changes before the final commit. If any unrelated pre-existing failure remains, record its command and exact error; do not silently mark the gate complete.

- [ ] **Step 6: Re-run the browser acceptance matrix after the production build**

Repeat the four viewports and print checks from Task 10 against the final code. Verify keyboard navigation and visible focus for toolbar, A4 fields, item actions, mobile sheet, dialog, and list. Verify unauthorized accounts see no sidebar item and cannot read/mutate data even when opening a route directly.

- [ ] **Step 7: Commit documentation**

```powershell
git add -- README.md docs/architecture.md docs/quotation-management.md
git commit -m "docs: document quotation management MVP 1"
```

- [ ] **Step 8: Prepare the implementation handoff**

Report:

- summary of behavior delivered
- all files changed
- migration filename and whether it was run locally
- commands run and pass/fail results
- browser viewport/print evidence
- documentation updated
- `.env.example` unchanged because existing Worker variables were reused
- `docs/api.md` unchanged because no public API was added
- skipped remote deployment and why
- remaining risks/assumptions and the explicitly deferred MVP 2/MVP 3 scope

Do not claim MVP 1 complete unless Tasks 1–11 are checked and the final verification evidence is present.
