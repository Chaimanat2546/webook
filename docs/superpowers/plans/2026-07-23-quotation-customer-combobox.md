# Quotation Customer Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require quotation customer selection through a searchable Combobox backed only by active rows in `ข้อมูลลูกค้า`.

**Architecture:** Reuse the existing `list_quotation_customers` RPC, customer
search action, Shadcn/Base UI Combobox, customer creation form, and snapshot
replacement confirmation. The picker owns recent/search/create UI state; the
quotation editor only receives an approved five-field customer snapshot and
renders no editable customer identity controls.

**Tech Stack:** Next.js App Router, React, TypeScript, Shadcn/Base UI Combobox,
Supabase PostgreSQL RPC, Node.js `node:test`.

## Global Constraints

- Opening the Combobox shows exactly five active customers ordered by the
  existing RPC's `updated_at desc, id desc`.
- Zero input loads recent customers; one trimmed character does not call the
  server; two or more trimmed characters search by the existing RPC.
- A missing customer must be saved to `ข้อมูลลูกค้า` before selection.
- Successful creation selects the saved customer automatically, subject to the
  existing replacement confirmation when a prior snapshot exists.
- After selection, show a summary card with `เปลี่ยนลูกค้า`; do not provide a
  clear-to-empty action.
- Quotation snapshots contain only name, address, tax ID, office type, and
  branch number.
- Inactive customers are never selectable.
- Keep existing DBD, duplicate, inactive/reactivation, validation, and saved
  quotation snapshot behavior.
- Prevent stale search responses from replacing newer results.
- Reuse installed dependencies and existing UI primitives; add no dependency.
- Create no migration unless implementation discovery contradicts the verified
  RPC ordering.
- The House Workspace Shell does not apply because this is a quotation editor
  control, not a house workspace.

---

### Task 1: Recent active customer query

**Files:**
- Modify: `server/services/quotation-customer-search.ts`
- Test: `tests/quotation-customer-repository-behavior.test.ts`

**Interfaces:**
- Consumes: `listQuotationCustomers(supabase, options)`.
- Produces:
  `searchActiveQuotationCustomers(supabase, search): Promise<QuotationCustomerSearchResult>`.
- Empty trimmed search uses `pageSize: 5`; non-empty search uses `pageSize: 50`.

- [ ] **Step 1: Write the failing recent-customer test**

Add a second success case beside the existing picker search boundary test:

```ts
it("limits an empty search to the five most recently updated active customers", async () => {
  let params: Record<string, unknown> = {};
  const client = {
    rpc: async (_name: string, value: Record<string, unknown>) => {
      params = value;
      return { data: [{ ...row, total_count: 1 }], error: null };
    },
  } as unknown as SupabaseClient;

  const result = await searchActiveQuotationCustomers(client, "   ");

  assert.equal(result.ok, true);
  assert.deepEqual(params, {
    p_active: true,
    p_page: 1,
    p_page_size: 5,
    p_search: "",
  });
});
```

Keep the existing non-empty test asserting `p_page_size: 50` and trimmed
`p_search: "Customer"`.

- [ ] **Step 2: Run the boundary test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-repository-behavior.test.ts
```

Expected: FAIL because empty search currently sends `p_page_size: 50`.

- [ ] **Step 3: Implement the conditional page size**

Replace the current inline search normalization in
`searchActiveQuotationCustomers` with:

```ts
const searchTerm = typeof search === "string" ? search.trim() : "";
const result = await listQuotationCustomers(supabase, {
  active: true,
  page: 1,
  pageSize: searchTerm ? 50 : 5,
  search: searchTerm,
});
```

Do not change the repository or RPC. The existing RPC already filters by
`p_active` and orders by `updated_at desc, id desc`.

- [ ] **Step 4: Run the boundary test and verify GREEN**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-repository-behavior.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the query boundary**

```powershell
git add -- server/services/quotation-customer-search.ts tests/quotation-customer-repository-behavior.test.ts
git commit -m "feat: load recent quotation customers"
```

---

### Task 2: Combobox-only quotation customer selection

**Files:**
- Modify: `components/admin/quotations/customers/customer-picker-dialog.tsx`
- Modify: `components/admin/quotations/quotation-editor.tsx`
- Modify: `tests/quotation-customer-ui.test.ts`
- Modify: `tests/quotation-ui.test.ts`
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes:
  `searchActiveQuotationCustomersAction(search: string)`,
  `QuotationCustomerForm`, `quotationCustomerToSnapshot(customer)`, and
  `CustomerSnapshot`.
- Produces:
  `QuotationCustomerPicker({ current, error, onSelect })`.
- `onSelect(snapshot: CustomerSnapshot)` remains the only way the picker changes
  quotation customer data.

- [ ] **Step 1: Write failing UI source tests**

Replace the picker assertions in
`tests/quotation-customer-ui.test.ts` with checks for the approved behavior:

```ts
it("selects quotation customers only through the customer-data combobox", () => {
  const picker = source("../components/admin/quotations/customers/customer-picker-dialog.tsx");
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const customerSection = editor.slice(
    editor.indexOf("data-customer-section"),
    editor.indexOf("data-document-section"),
  );

  assert.match(picker, /ComboboxInput/);
  assert.match(picker, /filter=\{null\}/);
  assert.match(picker, /searchActiveQuotationCustomersAction/);
  assert.match(picker, /query\.trim\(\)\.length === 1/);
  assert.match(picker, /requestIdRef\.current/);
  assert.match(picker, /พิมพ์อย่างน้อย 2 ตัวอักษร/);
  assert.match(picker, /เพิ่มลูกค้าใหม่/);
  assert.match(picker, /QuotationCustomerForm/);
  assert.match(picker, /quotationCustomerToSnapshot/);
  assert.match(picker, /เปลี่ยนลูกค้า/);
  assert.doesNotMatch(picker, /ComboboxClear|showClear/);
  assert.match(editor, /QuotationCustomerPicker/);
  assert.doesNotMatch(customerSection, /<TextInput|<Textarea|<OfficeTypeControls/);
});
```

Retain the existing assertions for snapshot fields, duplicate replacement,
inline error role, and exclusion of contact fields.

Update the customer-layout assertion in `tests/quotation-ui.test.ts`:

```ts
it("keeps quotation customer identity read-only after customer-data selection", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const customerSection = editor.slice(
    editor.indexOf("data-customer-section"),
    editor.indexOf("data-document-section"),
  );

  assert.match(customerSection, /<QuotationCustomerPicker/);
  assert.doesNotMatch(customerSection, /onChange=/);
  assert.doesNotMatch(customerSection, /<TextInput|<Textarea|<OfficeTypeControls/);
  assert.doesNotMatch(editor, /function updateCustomerOfficeType/);
});
```

Remove the old assertions that require `data-customer-fields`, editable
customer office radios, customer branch input, and
`updateCustomerOfficeType`. Keep every seller-office assertion unchanged.

- [ ] **Step 2: Run the UI tests and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts
```

Expected: FAIL because the editor still renders editable customer inputs and
the picker still opens a list dialog.

- [ ] **Step 3: Replace the picker entry point with the existing Combobox**

In `customer-picker-dialog.tsx`, import the existing primitives:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../../ui/combobox";
```

Rename the exported component and add the aggregated error:

```ts
export interface QuotationCustomerPickerProps {
  current: CustomerSnapshot;
  error?: string;
  onSelect: (snapshot: CustomerSnapshot) => void;
}

export function QuotationCustomerPicker({
  current,
  error,
  onSelect,
}: QuotationCustomerPickerProps) {
```

Use these state values; retain the existing `snapshotFields`,
`pendingSnapshot`, `apply`, and `choose` behavior:

```ts
const [changing, setChanging] = useState(false);
const [createOpen, setCreateOpen] = useState(false);
const [customers, setCustomers] = useState<QuotationCustomerMaster[]>([]);
const [hasLoaded, setHasLoaded] = useState(false);
const [loading, setLoading] = useState(false);
const [open, setOpen] = useState(false);
const [query, setQuery] = useState("");
const [searchError, setSearchError] = useState("");
const requestIdRef = useRef(0);
const hasCurrent = snapshotFields.some(
  (field) => String(current[field]).trim() !== "",
);
```

Add one request function with stale-response protection:

```ts
const loadCustomers = useCallback(async (search: string) => {
  const requestId = ++requestIdRef.current;
  setLoading(true);
  setSearchError("");
  const result = await searchActiveQuotationCustomersAction(search);
  if (requestId !== requestIdRef.current) return;
  setLoading(false);
  setHasLoaded(true);
  if (!result.ok) {
    setCustomers([]);
    setSearchError(result.formError);
    return;
  }
  setCustomers(result.items);
}, []);
```

Drive recent and searched results from the controlled query:

```ts
useEffect(() => {
  if (!open) return;
  requestIdRef.current += 1;
  const search = query.trim();
  if (search.length === 1) {
    requestIdRef.current += 1;
    setCustomers([]);
    setHasLoaded(false);
    setLoading(false);
    setSearchError("");
    return;
  }
  const timeoutId = window.setTimeout(
    () => void loadCustomers(search),
    search.length >= 2 ? 250 : 0,
  );
  return () => window.clearTimeout(timeoutId);
}, [loadCustomers, open, query]);
```

When closing, invalidate pending requests:

```ts
function changeOpen(next: boolean) {
  setOpen(next);
  if (!next) {
    requestIdRef.current += 1;
    setLoading(false);
    setQuery("");
  }
}
```

Render the controlled Combobox only when there is no current snapshot or the
user clicked `เปลี่ยนลูกค้า`:

```tsx
<Combobox
  filter={null}
  inputValue={query}
  itemToStringLabel={(customer: QuotationCustomerMaster) => customer.name}
  items={customers}
  onInputValueChange={setQuery}
  onOpenChange={changeOpen}
  onValueChange={(customer) => customer && choose(customer)}
  open={open}
>
  <ComboboxInput
    aria-describedby={error ? "quotation-customer-error" : undefined}
    aria-invalid={Boolean(error)}
    data-field="customer.name"
    placeholder="ค้นหาชื่อหรือเลขประจำตัวผู้เสียภาษี"
  />
  <ComboboxContent>
    {loading ? <p className="p-3 text-sm text-muted-foreground" role="status">กำลังโหลดลูกค้า…</p> : null}
    {!loading && query.trim().length === 1 ? (
      <p className="p-3 text-sm text-muted-foreground">พิมพ์อย่างน้อย 2 ตัวอักษร</p>
    ) : null}
    {!loading && searchError ? (
      <div className="space-y-2 p-3" role="alert">
        <p className="text-sm text-destructive">{searchError}</p>
        <Button onClick={() => void loadCustomers(query.trim())} size="sm" type="button" variant="outline">
          ลองใหม่
        </Button>
      </div>
    ) : null}
    {!loading && !searchError && query.trim().length !== 1 ? (
      <ComboboxList>
        {(customer: QuotationCustomerMaster) => (
          <ComboboxItem key={customer.id} value={customer}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{customer.name}</span>
              <span className="block text-xs text-muted-foreground">
                {customer.taxId} · {officeLabel(customer)}
              </span>
            </span>
          </ComboboxItem>
        )}
      </ComboboxList>
    ) : null}
    {!loading && !searchError && hasLoaded && customers.length === 0 ? (
      <div className="space-y-2 p-3">
        <p className="text-sm text-muted-foreground">ไม่พบลูกค้า</p>
        <Button
          onClick={() => {
            setOpen(false);
            setCreateOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          เพิ่มลูกค้าใหม่
        </Button>
      </div>
    ) : null}
  </ComboboxContent>
</Combobox>
```

Use the existing `officeLabel` rules or add this local function:

```ts
function officeLabel(customer: Pick<QuotationCustomerMaster, "branchNumber" | "officeType">) {
  if (customer.officeType === "branch") return `สาขา ${customer.branchNumber}`;
  return customer.officeType === "head_office" ? "สำนักงานใหญ่" : "ไม่ระบุ";
}
```

- [ ] **Step 4: Render the selected summary and reuse the create/replace dialogs**

When `hasCurrent && !changing`, render:

```tsx
<Card data-customer-summary>
  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 space-y-1">
      <p className="font-medium">{current.name}</p>
      <p className="font-mono text-xs text-muted-foreground">{current.taxId}</p>
      <p className="text-sm text-muted-foreground">
        {officeLabel(current)}
      </p>
      <p className="whitespace-pre-line text-sm">{current.address}</p>
    </div>
    <Button
      onClick={() => {
        setChanging(true);
        setOpen(true);
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      เปลี่ยนลูกค้า
    </Button>
  </CardContent>
</Card>
```

Keep the existing replacement confirmation content. Its cancel action must set
`pendingSnapshot` to `null` without changing `current`; its confirm action calls
`apply(pendingSnapshot)`.

Render the customer form in its own existing Shadcn Dialog:

```tsx
<Dialog onOpenChange={setCreateOpen} open={createOpen}>
  <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
      <DialogDescription>
        บันทึกเข้าข้อมูลลูกค้าก่อนเลือกใช้กับใบเสนอราคานี้
      </DialogDescription>
    </DialogHeader>
    <QuotationCustomerForm
      customer={null}
      onCancel={() => setCreateOpen(false)}
      onSaved={(customer) => {
        setCreateOpen(false);
        choose(customer);
      }}
    />
  </DialogContent>
</Dialog>
```

After `apply`, also reset picker-only state:

```ts
function apply(snapshot: CustomerSnapshot) {
  onSelect(snapshot);
  setChanging(false);
  setOpen(false);
  setPendingSnapshot(null);
  setQuery("");
}
```

Render an editor validation error without exposing editable inputs:

```tsx
{error ? (
  <p className="text-xs text-destructive" id="quotation-customer-error" role="alert">
    {error}
  </p>
) : null}
```

- [ ] **Step 5: Make the quotation editor customer section selection-only**

Remove `updateCustomer` and `updateCustomerOfficeType` from
`quotation-editor.tsx`.

Replace the customer heading actions and all `data-customer-fields` inputs with:

```tsx
<div className="mb-3 flex items-center justify-between gap-3">
  <h2 className="text-sm font-semibold">01 ลูกค้า</h2>
  <span className="text-xs text-muted-foreground">
    เลือกจากข้อมูลลูกค้าเท่านั้น
  </span>
</div>
<QuotationCustomerPicker
  current={payload.customer}
  error={
    fieldErrors["customer.name"]
    || fieldErrors["customer.address"]
    || fieldErrors["customer.taxId"]
    || fieldErrors["customer.officeType"]
    || fieldErrors["customer.branchNumber"]
  }
  onSelect={replaceCustomerSnapshot}
/>
```

Rename the import from `QuotationCustomerPickerDialog` to
`QuotationCustomerPicker`. Keep `replaceCustomerSnapshot` unchanged so every
selection still marks the same five fields dirty.

- [ ] **Step 6: Update customer UI documentation**

Under `## ข้อมูลลูกค้า And DBD` in `docs/quotation-management.md`, add:

```markdown
- A quotation customer is selected only from active `ข้อมูลลูกค้า` through a
  Combobox. Opening it shows the five most recently updated customers; two or
  more typed characters search by name or tax ID.
- When no customer matches, Add Customer saves through the existing customer
  flow and then selects the saved customer. The quotation stores only the
  five-field snapshot, so later customer-data edits do not rewrite saved
  quotations.
```

Remove any statement that still permits independently typing quotation customer
identity fields.

- [ ] **Step 7: Run targeted tests and verify GREEN**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts tests/quotation-customer-repository-behavior.test.ts
```

Expected: every targeted test passes.

- [ ] **Step 8: Verify project gates**

Run sequentially:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
git diff --check
```

Expected: all commands exit `0`; the full test output reports zero failures.

- [ ] **Step 9: Verify the local interaction**

On `/admin/quotations/new`, verify at mobile `390×844`, tablet `768×1024`,
laptop `1366×768`, and desktop `1920×1080`:

1. Opening shows five active recent customers.
2. One character shows the minimum-length message and sends no search request.
3. Two characters search by name; a partial tax ID also searches.
4. A slow older response cannot replace results for a newer query.
5. Empty results show Add Customer.
6. Successful creation saves to `ข้อมูลลูกค้า`, then selects the new customer.
7. A failed create remains open with its errors.
8. Selected customer shows a summary and only `เปลี่ยนลูกค้า`.
9. Replacement cancellation preserves the current snapshot; confirmation
   replaces exactly five snapshot fields.
10. Keyboard navigation, Escape, focus visibility, loading, error, and retry
    states work without console errors.

- [ ] **Step 10: Commit the Combobox flow locally**

```powershell
git add -- components/admin/quotations/customers/customer-picker-dialog.tsx components/admin/quotations/quotation-editor.tsx tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts docs/quotation-management.md
git commit -m "feat: require quotation customer selection"
```
