# Quotation Customer Input Combobox Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the quotation customer Input Combobox visible after selection and show the selected customer details below it without a separate change button.

**Architecture:** Reuse the existing controlled Combobox, search action, create modal, and replacement confirmation. Remove only the selected summary-card branch and derive the displayed input value from the selected snapshot while the Combobox is closed.

**Tech Stack:** Next.js App Router, React, TypeScript, existing Shadcn/Base UI Combobox, Node.js test runner

## Global Constraints

- Keep the latest-five and two-character search behavior unchanged.
- Keep customer creation, snapshot replacement confirmation, and snapshot fields unchanged.
- Do not add dependencies, APIs, migrations, or direct customer editing.
- The House Workspace Shell does not apply because this is an embedded quotation control.

---

### Task 1: Always-visible customer Input Combobox

**Files:**
- Modify: `components/admin/quotations/customers/customer-picker-dialog.tsx`
- Modify: `tests/quotation-customer-ui.test.ts`
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: `QuotationCustomerPicker({ current, error, onSelect })`
- Produces: the same component interface with an always-visible Input Combobox

- [x] **Step 1: Write the failing UI regression test**

Update the existing quotation customer picker assertions:

```ts
assert.match(picker, /inputValue=\{open \? query : current\.name\}/);
assert.match(picker, /data-selected-customer-details/);
assert.doesNotMatch(picker, /เปลี่ยนลูกค้า|data-customer-summary/);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
```

Expected: FAIL because the selected state still renders `data-customer-summary` and `เปลี่ยนลูกค้า`.

- [x] **Step 3: Implement the smallest component correction**

In `customer-picker-dialog.tsx`:

1. Remove `Card`, `CardContent`, `changing`, `hasCurrent`, and `showPicker`.
2. Always render the existing `Combobox`.
3. Display the selected name while closed:

```tsx
<Combobox
  filter={null}
  inputValue={open ? query : current.name}
  itemToStringLabel={(customer: QuotationCustomerMaster) => customer.name}
  itemToStringValue={(customer: QuotationCustomerMaster) => customer.name}
  items={customers}
  onInputValueChange={(value, eventDetails) => {
    if (eventDetails.reason === "input-change") changeQuery(value);
  }}
  onOpenChange={changeOpen}
  onValueChange={(customer: QuotationCustomerMaster | null) => {
    if (customer) choose(customer);
  }}
  open={open}
>
```

4. Keep the current Combobox content, create modal, and replacement dialog unchanged.
5. Treat the current snapshot as selected only when its name or tax ID has data,
   so the default office type does not show empty details or require replacement
   confirmation on the first selection:

```ts
const hasCurrent = current.name.trim() !== "" || current.taxId.trim() !== "";
```

6. Below the Combobox, show details only when the current snapshot has data:

```tsx
{hasCurrent ? (
  <div
    className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm"
    data-selected-customer-details
  >
    <p className="font-mono text-xs text-muted-foreground">{current.taxId}</p>
    <p className="text-muted-foreground">{officeLabel(current)}</p>
    <p className="whitespace-pre-line">{current.address}</p>
  </div>
) : null}
```

- [x] **Step 4: Update the behavior documentation**

Replace the summary-card/change-button wording in `docs/quotation-management.md` with:

```md
The customer Input Combobox remains visible after selection. The selected
customer name stays in the input, while tax ID, office, and address appear
below it. Clicking or typing in the input can replace the customer after the
existing confirmation; there is no separate change or clear-to-empty action.
```

- [x] **Step 5: Run focused verification and verify GREEN**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts tests/quotation-ui.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all tests pass, TypeScript reports no errors, and ESLint reports no errors.

- [x] **Step 6: Verify the local interaction**

On `/admin/quotations/new`, verify:

1. The Input Combobox is visible before and after selection.
2. Opening it shows five recent customers.
3. Typing one character shows the minimum-two-character prompt.
4. Typing two characters searches.
5. Selecting a different customer opens replacement confirmation.
6. Cancelling or pressing Escape preserves the current customer.
7. Tax ID, office, and address remain visible below the input.

- [x] **Step 7: Commit**

```powershell
git add -- components/admin/quotations/customers/customer-picker-dialog.tsx tests/quotation-customer-ui.test.ts docs/quotation-management.md docs/superpowers/plans/2026-07-23-quotation-customer-input-combobox-correction.md
git commit -m "fix: keep quotation customer combobox visible"
```
