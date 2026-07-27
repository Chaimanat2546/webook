# Quotation Customer Office Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically select the approved office type whenever the customer type changes in the Add Customer modal.

**Architecture:** Keep the behavior in one pure customer-state helper used by the
existing form. The customer-type change handler updates `customerType`,
`officeType`, and `branchNumber` atomically; editing saved customers remains
unchanged because their customer type control is disabled.

**Tech Stack:** Next.js App Router, React, TypeScript, existing Shadcn Radio Group, Node.js `node:test`.

## Global Constraints

- `บุคคลธรรมดา` always maps to `ไม่ระบุ`.
- `นิติบุคคล` always maps to `สำนักงานใหญ่`.
- Switching type always overwrites the previous office choice and clears the branch number.
- Apply the rule only while creating a customer.
- Do not change database constraints, quotation snapshots, dependencies, or the office selector.
- Replace the remaining user-visible legacy terminology in the customer form with `ข้อมูลลูกค้า`.

---

### Task 1: Customer type office defaults

**Files:**
- Modify: `components/admin/quotations/customers/customer-form.tsx`
- Modify: `lib/quotation-customer-types.ts`
- Modify: `app/admin/quotations/customers/actions.ts`
- Test: `tests/quotation-customer-ui.test.ts`
- Test: `tests/quotation-customer-service.test.ts`
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: `QuotationCustomerInput["customerType"]` and the existing customer form state.
- Produces: `changeQuotationCustomerType(customer, customerType)` and
  `changeCustomerType(next)`.

- [x] **Step 1: Write the failing source regression test**

Add these assertions to the existing customer-form UI test:

```ts
const actions = source("../app/admin/quotations/customers/actions.ts");
assert.match(form, /function changeCustomerType\(next: QuotationCustomerInput\["customerType"\]\)/);
assert.match(form, /changeQuotationCustomerType\(current, next\)/);
assert.match(form, /onValueChange=\{\(next\) => changeCustomerType/);
assert.doesNotMatch(form, /หลังสร้าง Master|ใน Master/);
assert.doesNotMatch(actions, /หลังสร้าง Master|ใน Master/);
```

- [x] **Step 2: Run the test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
```

Expected: FAIL because `changeCustomerType` does not exist.

- [x] **Step 3: Implement the atomic customer-type update**

Add a pure state helper in `lib/quotation-customer-types.ts`, cover both
transitions directly in the service test, and call it from this handler beside
the existing `update` helper:

```ts
function changeCustomerType(next: QuotationCustomerInput["customerType"]) {
  setValue((current) => changeQuotationCustomerType(current, next));
  setFieldErrors((current) => ({
    ...current,
    branchNumber: "",
    customerType: "",
    officeType: "",
  }));
  setExistingCustomer(null);
  setConfirmReactivation(false);
}
```

Use it from the customer-type radio:

```tsx
onValueChange={(next) => changeCustomerType(next as QuotationCustomerInput["customerType"])}
```

Replace the two remaining visible legacy messages with:

```tsx
ประเภทลูกค้าและเลขผู้เสียภาษีเปลี่ยนไม่ได้หลังสร้างข้อมูลลูกค้า
พบข้อมูลลูกค้านี้แล้ว
```

Replace the four customer action error strings containing the legacy term with
equivalent messages using `ข้อมูลลูกค้า`.

- [x] **Step 4: Document the behavior**

Add this rule under the customer-data section of `docs/quotation-management.md`:

```markdown
- In Add Customer, selecting `บุคคลธรรมดา` sets office type to `ไม่ระบุ`;
  selecting `นิติบุคคล` sets it to `สำนักงานใหญ่`. Switching type always
  overwrites the office choice and clears the branch number.
```

- [x] **Step 5: Verify GREEN and project gates**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

Expected: all commands exit 0.

- [ ] **Step 6: Verify the local modal**

Skipped: the in-app browser security policy blocked the tab after a local
connection error. The source regression test covers the approved transitions.

In `/admin/quotations/customers`, open Add Customer and verify:

1. The initial `นิติบุคคล` selection uses `สำนักงานใหญ่`.
2. Selecting `สาขา`, then `บุคคลธรรมดา`, selects `ไม่ระบุ` and clears the branch number.
3. Selecting `นิติบุคคล` again selects `สำนักงานใหญ่`.
4. Editing an existing customer does not change its saved office value.

- [x] **Step 7: Commit locally**

```powershell
git add -- app/admin/quotations/customers/actions.ts components/admin/quotations/customers/customer-form.tsx lib/quotation-customer-types.ts tests/quotation-customer-service.test.ts tests/quotation-customer-ui.test.ts docs/quotation-management.md docs/superpowers/plans/2026-07-23-quotation-customer-office-default.md
git commit -m "fix: default customer office by type"
```
