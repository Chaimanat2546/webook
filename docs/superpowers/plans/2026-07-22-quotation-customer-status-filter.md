# Quotation Customer Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two ambiguous status buttons with one dropdown, move Add Customer into the same responsive toolbar at the far right, and remove the total-count summary.

**Architecture:** Keep the page and GET search form server-rendered. Export one client toolbar from the existing customer-list interaction module, reuse a private customer-form dialog for create/edit, and preserve the existing URL status query and server pagination.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing Shadcn/Radix dropdown menu, Node.js `node:test`.

## Global Constraints

- Use exactly two statuses: `ใช้งานอยู่` and `ปิดใช้งานแล้ว`.
- Preserve `q` and reset pagination to page 1 when status changes.
- Keep Add Customer at the far right of the responsive toolbar.
- Remove `ทั้งหมด n รายการ`.
- Do not change row actions, repositories, database behavior, or dependencies.
- Only the main agent edits files.

---

### Task 1: Customer status toolbar

**Files:**
- Modify: `components/admin/quotations/customers/customer-list.tsx`
- Modify: `app/admin/quotations/customers/page.tsx`
- Test: `tests/quotation-customer-ui.test.ts`

**Interfaces:**
- Produces: `QuotationCustomerToolbar({ active, activeHref, inactiveHref, children })`.
- Reuses: `QuotationCustomerForm`, `DropdownMenuRadioGroup`, and `DropdownMenuRadioItem`.

- [x] **Step 1: Write the failing source test**

Add assertions to the existing customer-page test:

```ts
const list = source("../components/admin/quotations/customers/customer-list.tsx");
assert.match(page, /QuotationCustomerToolbar/);
assert.match(list, /DropdownMenuRadioGroup/);
assert.match(list, /DropdownMenuRadioItem/);
assert.match(list, /สถานะ: \{active \? "ใช้งานอยู่" : "ปิดใช้งานแล้ว"\}/);
assert.match(list, /ChevronDownIcon/);
assert.match(list, /ml-auto[^"]*เพิ่มลูกค้า|ml-auto/);
assert.doesNotMatch(page, /ทั้งหมด \{result\.total/);
assert.doesNotMatch(page, /variant=\{active \? "default" : "outline"\}/);
```

- [x] **Step 2: Verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
```

Expected: the customer-page test fails because the toolbar and radio dropdown do not exist and the total summary remains.

- [x] **Step 3: Implement the minimum toolbar**

In `customer-list.tsx`, extract the existing form dialog into a private controlled component used by both create and edit flows. Export a toolbar with this contract:

```tsx
export function QuotationCustomerToolbar({
  active,
  activeHref,
  inactiveHref,
  children,
}: {
  active: boolean;
  activeHref: string;
  inactiveHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  function changeStatus(value: string) {
    if (value === (active ? "active" : "inactive")) return;
    router.push(value === "inactive" ? inactiveHref : activeHref);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="กรองสถานะลูกค้า" type="button" variant="outline">
            สถานะ: {active ? "ใช้งานอยู่" : "ปิดใช้งานแล้ว"}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup onValueChange={changeStatus} value={active ? "active" : "inactive"}>
            <DropdownMenuRadioItem value="active">ใช้งานอยู่</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="inactive">ปิดใช้งานแล้ว</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button className="ml-auto" onClick={() => setAdding(true)} type="button">
        <PlusIcon aria-hidden />
        เพิ่มลูกค้า
      </Button>
      <CustomerFormDialog customer={null} onOpenChange={setAdding} open={adding} />
    </div>
  );
}
```

Remove the add button from `QuotationCustomerList`; keep its edit and active-state dialogs unchanged through the shared form-dialog component.

In `page.tsx`, render the existing search form as `QuotationCustomerToolbar` children, pass both `statusHref()` values, remove the two Link buttons, remove the empty-list component used only to expose Add Customer, and remove the total-count paragraph. Give the search form `basis-full md:basis-auto` so the same toolbar wraps cleanly on mobile.

- [x] **Step 4: Verify GREEN and project gates**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-customer-ui.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

Expected: targeted and full checks pass with zero failures.

- [x] **Step 5: Browser and visual verification**

Open `/admin/quotations/customers` locally and verify desktop and mobile widths. Confirm the dropdown opens by keyboard/click, each status navigates while preserving `q`, Add Customer opens the existing dialog, the button stays at the far right, and no total summary renders. Compare the implemented toolbar against the supplied reference image.

- [x] **Step 6: Review and local commit**

Run the required read-only `webook_reviewer`, fix only evidence-backed Critical/Important findings, rerun affected checks, then commit:

```powershell
git add -- app/admin/quotations/customers/page.tsx components/admin/quotations/customers/customer-list.tsx tests/quotation-customer-ui.test.ts docs/superpowers/plans/2026-07-22-quotation-customer-status-filter.md
git commit -m "fix: refine customer filter toolbar"
```
