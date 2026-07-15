# Quotation Document Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current quotation form composition with the approved A — Document Workbench UI while preserving all quotation behavior.

**Architecture:** Keep state, calculator, validation, server actions, Preview, and Print inside the existing `QuotationEditor`. Recompose only its internal view helpers and JSX: semantic field-size roles, a 12-column metadata grid, an `xl` fixed-column item ledger, responsive item cards below `xl`, and a ruled notes/totals completion area.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing shadcn primitives, Lucide icons, Node test runner.

## Global Constraints

- Do not change the quotation payload, database schema, server actions, calculator, or validation rules.
- Create/Edit stays full-width responsive; only Preview/Print uses A4.
- Preserve seller/customer snapshots and conditional branch-number clearing.
- Preserve current save, delete, dirty-warning, Preview, and saved-document Print behavior.
- Keep Share and Download disabled; do not add Public Share, PDF, workflow, WHT, payment, or installments.
- Use existing dependencies and existing shadcn components; do not modify the global theme.
- Use one controlled blue accent only for document IDs, edit links, and add actions; Save remains the current dark primary.
- Keep native select indicators visible and retain accessible labels, focus rings, `aria-invalid`, and `data-field` focus targets.
- Preserve unrelated working-tree changes and the untracked Supabase snippet.

---

## File Map

- Modify `components/admin/quotations/quotation-editor.tsx`: all Document Workbench view composition and responsive behavior.
- Modify `tests/quotation-ui.test.ts`: source-level regression checks for the selected grid, semantic widths, ledger columns, item actions, and completion area.
- Modify `docs/quotation-management.md`: concise description of the implemented editor behavior.
- Reference only `docs/superpowers/specs/2026-07-15-quotation-document-workbench-design.md`: approved design contract; do not rewrite it during implementation.

### Task 1: Workbench command bar, seller strip, metadata grid, and field-size roles

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:21-46,91-97`
- Test: `tests/quotation-ui.test.ts:68-132`

**Interfaces:**
- Consumes: existing `Field`, `TextInput`, `Numeric`, `DocumentMore`, seller/customer update functions, and `fieldErrors`.
- Produces: `FieldSize`, `fieldSizeClassNames`, `controlClassName()`, `data-workbench-command-bar`, `data-seller-strip`, and `data-workbench-metadata` for Task 2 and tests.

- [ ] **Step 1: Replace obsolete layout assertions with a failing Document Workbench shell test**

Add this test and remove assertions that require the old two-track `24rem` card layout or old `inputClassName` widths:

```ts
it("composes the approved document workbench shell and semantic field sizes", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /type FieldSize = "fluid" \| "compact" \| "date" \| "identifier" \| "person" \| "name" \| "address" \| "contact"/);
  for (const value of ["max-w-28", "max-w-40", "max-w-64", "max-w-72", "max-w-md", "max-w-[40rem]", "max-w-[22rem]"]) {
    assert.match(editor, new RegExp(value.replace("[", "\\[").replace("]", "\\]")));
  }
  assert.match(editor, /data-workbench-command-bar/);
  assert.match(editor, /data-seller-strip/);
  assert.match(editor, /data-workbench-metadata[^>]*lg:grid-cols-12/);
  assert.match(editor, /data-customer-section[^>]*lg:col-span-7/);
  assert.match(editor, /data-document-section[^>]*lg:col-span-5/);
  assert.doesNotMatch(editor, /lg:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern "document workbench shell" tests/quotation-ui.test.ts
```

Expected: FAIL because `FieldSize` and the three workbench markers do not exist.

- [ ] **Step 3: Add the semantic field-size system using the existing `cn` utility**

Import `cn` and add these exact definitions above `Field`:

```tsx
import { cn } from "../../../lib/utils";

type FieldSize = "fluid" | "compact" | "date" | "identifier" | "person" | "name" | "address" | "contact";

const fieldSizeClassNames = {
  fluid: "w-full",
  compact: "w-full sm:max-w-28",
  date: "w-full sm:max-w-40",
  identifier: "w-full sm:max-w-64",
  person: "w-full sm:max-w-72",
  name: "w-full sm:max-w-md",
  address: "w-full sm:max-w-[40rem]",
  contact: "w-full sm:max-w-[22rem]",
} satisfies Record<FieldSize, string>;

const selectClassName = "h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function controlClassName(size: FieldSize, className?: string) {
  return cn(fieldSizeClassNames[size], className);
}
```

Change `TextInput` and `Numeric` to accept `size?: FieldSize`, default it to
`"fluid"`, and pass `controlClassName(size, inputClassName)` to `Input`. Keep
their current error rendering and callbacks unchanged.

- [ ] **Step 4: Recompose the command bar and seller strip without changing callbacks**

Change `DocumentMore` to accept `showPreviewAndPrint: boolean` and
`onSaveAndClose: () => void`. Render Preview and Print menu items only when the
flag is true. Always render `บันทึกและปิด`, disabled Share, disabled Download,
and conditional Delete. Wire `onSaveAndClose={() => save(true)}` at both call
sites so the existing behavior remains available.

Use these exact outer structures:

```tsx
<header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/25 pb-3" data-workbench-command-bar>
  <div>
    <h1 className="text-xl font-semibold tracking-tight">{documentNumber ? "แก้ไขใบเสนอราคา" : "สร้างใบเสนอราคา"}</h1>
    <p className="font-mono text-xs text-blue-700">{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</p>
  </div>
  <div className="flex items-center gap-2" data-header-actions>
    <Button onClick={closeEditor} type="button" variant="outline"><X aria-hidden="true" className="size-4" />ปิด</Button>
    <div className="hidden items-center gap-2 md:flex">
      <Button onClick={() => setPreviewOpen(true)} type="button" variant="outline"><Eye aria-hidden="true" className="size-4" />ดูตัวอย่าง</Button>
      <Button disabled={!canPrint} onClick={printSaved} type="button" variant="outline"><Printer aria-hidden="true" className="size-4" />พิมพ์</Button>
    </div>
    <div className="hidden md:block"><DocumentMore deleteEnabled={Boolean(payload.id)} onDelete={() => setDeleteOpen(true)} onPreview={() => setPreviewOpen(true)} onPrint={printSaved} onSaveAndClose={() => save(true)} printEnabled={canPrint} showPreviewAndPrint={false} /></div>
    <div className="md:hidden"><DocumentMore deleteEnabled={Boolean(payload.id)} onDelete={() => setDeleteOpen(true)} onPreview={() => setPreviewOpen(true)} onPrint={printSaved} onSaveAndClose={() => save(true)} printEnabled={canPrint} showPreviewAndPrint /></div>
    <Button disabled={isPending} onClick={() => save()} type="button"><Save aria-hidden="true" className="size-4" />{isPending ? "กำลังบันทึก" : "บันทึก"}</Button>
  </div>
</header>
```

The responsive wrappers ensure only one More trigger is visible at a time.

Use this seller-strip geometry around the existing logo and seller copy:

```tsx
<section className="flex flex-wrap items-center justify-between gap-3 border-b py-2" data-seller-strip>
```

Keep only seller identity and `แก้ไขเฉพาะใบ` in this strip. Remove the old
desktop document-action group from the seller row.

- [ ] **Step 5: Recompose metadata as a ruled 12-column workbench**

Replace the old metadata outer grid and section opening tags with these exact
structures:

```tsx
<div data-workbench-metadata className="grid gap-6 lg:grid-cols-12">
  <section data-customer-section className="border-t border-foreground/35 pt-2 lg:col-span-7">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">01 ลูกค้า</h2>
      <span className="text-xs text-muted-foreground">Snapshot เฉพาะใบ</span>
    </div>
    <div data-customer-fields className="grid gap-3 sm:grid-cols-2">
    </div>
  </section>
  <section data-document-section className="border-t border-foreground/35 pt-2 lg:col-span-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">02 ข้อมูลเอกสาร</h2>
      <span className="text-xs text-muted-foreground">THB</span>
    </div>
    <div data-document-fields className="grid gap-3 sm:grid-cols-2">
    </div>
  </section>
</div>
```

Move the current controls into those two field-grid containers in their current
order and apply this exact role mapping while retaining every current
`data-field`, value, error prop, and callback:

| Control | Role |
|---|---|
| `customer.name` | `name`; wrapper spans two columns |
| `customer.address` | `address`; wrapper spans two columns |
| `customer.taxId`, `customer.branchNumber` | `identifier` |
| `customer.officeType` | `identifier` |
| `customer.contactName`, `customer.phone` | `person` |
| `customer.email` | `contact` |
| `issueDate`, `validUntil` | `date` |
| `validityDays` | `compact` |
| `currency`, `reference` | `identifier` |

- [ ] **Step 6: Run the focused and full quotation UI tests**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern "document workbench shell|branch numbers|field errors" tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: both commands PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: compose quotation document workbench"
```

### Task 2: Fixed-column desktop ledger and responsive item cards

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:32-46,98`
- Test: `tests/quotation-ui.test.ts:123-151`

**Interfaces:**
- Consumes: `ItemProps`, existing item update/move/remove functions, semantic control classes from Task 1, and calculation line totals.
- Produces: `ItemActionMenu`, separate quantity/unit controls, `data-item-ledger`, and responsive `data-item-cards`.

- [ ] **Step 1: Write the failing ledger regression test**

Replace old item-action placement assertions with:

```ts
it("uses the approved fixed ledger and responsive item cards", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /function ItemActionMenu/);
  assert.match(editor, /data-item-ledger[^>]*hidden[^>]*xl:block/);
  assert.match(editor, /min-w-\[62\.5rem\][^\"]*table-fixed/);
  assert.match(editor, /<colgroup>/);
  for (const width of ["w-10", "w-20", "w-[7.5rem]", "w-36", "w-[8.5rem]"]) {
    assert.match(editor, new RegExp(width.replace("[", "\\[").replace("]", "\\]")));
  }
  assert.match(editor, /data-item-cards[^>]*xl:hidden/);
  assert.match(editor, /data-item-detail-grid[^>]*grid-cols-2[^>]*sm:grid-cols-3[^>]*lg:grid-cols-5/);
  assert.doesNotMatch(editor, /data-item-actions/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern "fixed ledger" tests/quotation-ui.test.ts
```

Expected: FAIL because `ItemActionMenu`, `colgroup`, and `xl` layout markers do
not exist.

- [ ] **Step 3: Replace three inline row buttons with one existing DropdownMenu**

Add this complete helper:

```tsx
function ItemActionMenu({ index, onMove, onRemove, totalItems }: Pick<ItemProps, "index" | "onMove" | "onRemove" | "totalItems">) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button aria-label={`จัดการรายการ ${index + 1}`} size="icon-xs" type="button" variant="ghost"><MoreHorizontal aria-hidden="true" className="size-4" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}><ArrowUp aria-hidden="true" className="size-4" />เลื่อนขึ้น</DropdownMenuItem>
      <DropdownMenuItem disabled={index === totalItems - 1} onSelect={() => onMove(1)}><ArrowDown aria-hidden="true" className="size-4" />เลื่อนลง</DropdownMenuItem>
      <DropdownMenuItem disabled={totalItems === 1} onSelect={onRemove} variant="destructive"><Trash2 aria-hidden="true" className="size-4" />ลบรายการ</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
```

Remove action buttons from `ItemDetailsControls`; it must render only item name,
description, and their errors.

- [ ] **Step 4: Split quantity and unit into independently sized controls**

Replace `ItemQuantityControls` with these helpers:

```tsx
function ItemQuantityControl({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) {
  return <Numeric error={errors[`items.${index}.quantity`]} field={`items.${index}.quantity`} label={labelled ? "จำนวน" : undefined} onChange={(value) => onUpdate("quantity", value)} size="compact" value={item.quantity} />;
}

function ItemUnitControl({ index, item, onUpdate, labelled }: Pick<ItemProps, "index" | "item" | "onUpdate"> & { labelled?: boolean }) {
  return <TextInput field={`items.${index}.unit`} label={labelled ? "หน่วย" : undefined} onChange={(value) => onUpdate("unit", value)} size="compact" value={item.unit} />;
}
```

For discount and VAT helpers, use `"grid gap-1"` when `labelled` is false
(desktop ledger) and `"grid grid-cols-2 gap-2"` when `labelled` is true
(responsive cards). Keep all current parsing, field errors, and callbacks.

- [ ] **Step 5: Implement the fixed desktop ledger**

Use this exact table geometry around the existing item map:

```tsx
<div data-item-ledger className="hidden overflow-x-auto xl:block">
  <table className="w-full min-w-[62.5rem] table-fixed text-sm">
    <colgroup>
      <col className="w-10" />
      <col />
      <col className="w-20" />
      <col className="w-20" />
      <col className="w-[7.5rem]" />
      <col className="w-36" />
      <col className="w-36" />
      <col className="w-[8.5rem]" />
    </colgroup>
    <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
      <tr><th className="p-2">#</th><th className="p-2">รายการ / รายละเอียด</th><th className="p-2">จำนวน</th><th className="p-2">หน่วย</th><th className="p-2">ราคาต่อหน่วย</th><th className="p-2">ส่วนลด</th><th className="p-2">VAT</th><th className="p-2 text-right">รวม</th></tr>
    </thead>
    <tbody>{payload.items.map((item, index) => <tr className="border-t align-top" key={item.id}>
      <td className="p-2"><div className="grid justify-items-start gap-1"><span className="font-mono text-xs text-muted-foreground">{index + 1}</span><ItemActionMenu {...itemProps(item, index)} /></div></td>
      <td className="p-2"><ItemDetailsControls {...itemProps(item, index)} /></td>
      <td className="p-2"><ItemQuantityControl {...itemProps(item, index)} /></td>
      <td className="p-2"><ItemUnitControl {...itemProps(item, index)} /></td>
      <td className="p-2"><ItemPriceControls {...itemProps(item, index)} /></td>
      <td className="p-2"><ItemDiscountControls {...itemProps(item, index)} /></td>
      <td className="p-2"><ItemVatControls {...itemProps(item, index)} /></td>
      <td className="p-2 text-right font-medium">{calculation?.lines[index]?.lineTotal ?? "—"}</td>
    </tr>)}</tbody>
  </table>
</div>
```

- [ ] **Step 6: Implement responsive item cards below `xl`**

Use one card per item with this stable order:

```tsx
<div data-item-cards className="grid gap-3 xl:hidden">
  {payload.items.map((item, index) => <article className="rounded-md border p-3" key={item.id}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="font-mono text-xs text-muted-foreground">รายการ {index + 1}</span>
      <ItemActionMenu {...itemProps(item, index)} />
    </div>
    <ItemDetailsControls {...itemProps(item, index)} />
    <div data-item-detail-grid className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <ItemQuantityControl {...itemProps(item, index)} labelled />
      <ItemUnitControl {...itemProps(item, index)} labelled />
      <ItemPriceControls {...itemProps(item, index)} labelled />
      <ItemDiscountControls {...itemProps(item, index)} labelled />
      <ItemVatControls {...itemProps(item, index)} labelled />
    </div>
    <p className="mt-3 border-t pt-2 text-right font-medium">รวม {calculation?.lines[index]?.lineTotal ?? "—"}</p>
  </article>)}
</div>
```

Move price mode and Add Item into the `03 รายการ` ruled section header. Apply
the Identifier role to the price-mode select and `text-blue-700` to the add
action without changing callbacks.

- [ ] **Step 7: Run focused and full quotation UI tests**

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern "fixed ledger|desktop item|select errors" tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: both commands PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: add responsive quotation item ledger"
```

### Task 3: Ruled notes/totals completion area, documentation, and final review

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:99-104`
- Modify: `tests/quotation-ui.test.ts:68-170`
- Modify: `docs/quotation-management.md:17-29`

**Interfaces:**
- Consumes: existing `Totals`, `Numeric`, `calculation`, public/internal note update callbacks, dialogs, and hidden Print document.
- Produces: `data-workbench-completion` and the final documented responsive behavior.

- [ ] **Step 1: Write the failing completion-area regression test**

```ts
it("finishes the workbench with ruled notes and aligned totals", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  assert.match(editor, /data-workbench-completion[^>]*lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
  assert.match(editor, /data-notes-grid[^>]*lg:grid-cols-2/);
  assert.match(editor, /data-quotation-totals[^>]*border-t-2/);
  assert.ok(editor.indexOf('data-field="publicNotes"') < editor.indexOf('data-field="internalNotes"'));
  assert.ok(editor.indexOf('data-field="internalNotes"') < editor.indexOf("data-quotation-totals"));
  assert.doesNotMatch(editor, /data-internal-notes[^>]*rounded-xl/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern "ruled notes" tests/quotation-ui.test.ts
```

Expected: FAIL because the completion and notes-grid markers do not exist.

- [ ] **Step 3: Merge notes and totals into the selected completion composition**

Use this exact outer structure while retaining current controls and totals:

```tsx
<div data-workbench-completion className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
  <section data-notes-grid className="grid gap-4 lg:grid-cols-2">
    <div data-public-notes><Field error={fieldErrors.publicNotes} field="publicNotes" label="หมายเหตุบนเอกสาร"><Textarea data-field="publicNotes" onChange={(event) => updateRoot("publicNotes", event.target.value)} value={payload.publicNotes} /></Field></div>
    <div data-field="items" data-internal-notes tabIndex={-1}>{fieldErrors.items ? <span className="text-xs text-destructive">{fieldErrors.items}</span> : null}<Field error={fieldErrors.internalNotes} field="internalNotes" label="หมายเหตุภายใน (ไม่แสดงในเอกสาร)"><Textarea data-field="internalNotes" onChange={(event) => updateRoot("internalNotes", event.target.value)} value={payload.internalNotes} /></Field></div>
  </section>
  <section data-quotation-totals className="space-y-2 border-t-2 border-foreground pt-3">
    <Field error={fieldErrors.documentDiscountType} field="documentDiscountType" label="ส่วนลดเอกสาร"><select className={controlClassName("identifier", selectClassName)} data-field="documentDiscountType" onChange={(event) => updateRoot("documentDiscountType", event.target.value === "amount" || event.target.value === "percent" ? event.target.value : null)} value={payload.documentDiscountType ?? ""}><option value="">ไม่มี</option><option value="amount">บาท</option><option value="percent">%</option></select></Field>
    <Numeric error={fieldErrors.documentDiscountValue} field="documentDiscountValue" label="มูลค่าส่วนลดเอกสาร" onChange={(value) => updateRoot("documentDiscountValue", value)} size="identifier" value={payload.documentDiscountValue} />
    <Totals label="รวมก่อนส่วนลด" value={total(calculation?.subtotal)} />
    <Totals label="ส่วนลดรายการ" value={total(calculation?.itemDiscountTotal)} />
    <Totals label="ส่วนลดเอกสาร" value={total(calculation?.documentDiscountTotal)} />
    <Totals label="มูลค่าก่อน VAT" value={total(calculation?.taxableTotal)} />
    <Totals label="VAT" value={total(calculation?.vatTotal)} />
    <Totals bold label="ยอดรวมสุทธิ (THB)" value={total(calculation?.grandTotal)} />
    <p className="text-sm">{calculation ? formatThaiBahtText(calculation.grandTotal) : "—"}</p>
  </section>
</div>
```

Leave Preview, delete confirmation, and hidden saved Print document after this
composition unchanged.

- [ ] **Step 4: Update user-facing documentation**

Replace the Editor Rules layout bullets with this implemented description:

```markdown
- Create/Edit uses the Document Workbench layout; Preview/Print remains A4.
- Large desktop uses a 7/5 customer/document metadata grid and a fixed-column item ledger. Below `xl`, items become responsive editable cards.
- Controls use semantic width roles based on value type; only item name/description is fluid in the desktop ledger.
- Notes and totals use a ruled fluid-left/`18rem`-right completion grid and stack on smaller screens.
```

Keep all existing scope, snapshot, VAT, optional unit, and future-action bullets.

- [ ] **Step 5: Run all automated verification**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
```

Expected:

- Typecheck exits 0.
- Lint exits 0; the three existing `@next/next/no-img-element` warnings are acceptable.
- All tests pass; the local database integration test may remain skipped.
- Production build exits 0.
- Diff check exits 0.

- [ ] **Step 6: Inspect rendered responsive behavior**

Open the authenticated create and edit routes and inspect these widths:

```text
390×844   narrow mobile
430×932   wide mobile
768×1024  tablet
1180×820  laptop
1536×960  large desktop
```

At every width verify: no page-level horizontal overflow; native select arrows
remain visible; metadata order is Customer then Document; item actions remain
available; long Thai names/addresses wrap or stay within role maximums; totals
do not cover controls; Preview shows the current draft; Print uses the last
saved payload.

- [ ] **Step 7: Review against the Gridgeist checklist**

Confirm in this order: clarity, one dominant item ledger, shared alignment,
limited typography roles, coherent spacing, restrained rules/radii, responsive
recomposition, keyboard/focus behavior, and no unnecessary dependency or
layout-specific JavaScript.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts docs/quotation-management.md
git commit -m "docs: document quotation workbench behavior"
```
