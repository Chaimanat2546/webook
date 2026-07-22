# Quotation Completion Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the quotation payment-and-certification block by default behind one accessible show/hide button while preserving drafts and revealing validation errors.

**Architecture:** Keep the existing tabs and panels mounted inside one hidden region controlled by local editor state. Reuse the existing `focusErrorField` boundary to expand the region and choose the correct tab before focusing a payment or certification error.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, ShadcnUI, `node:test`

## Global Constraints

- The region starts collapsed for new and existing quotation editor sessions.
- One Shadcn button controls the whole tabs block and reads `แสดง` or `ซ่อน`.
- Payment, certification, upload, and active-tab state must remain mounted while hidden.
- Payment or certification validation errors expand the region and select the matching tab.
- No API, database, Preview, Print, PDF, or Public Read-only changes.

---

### Task 1: Collapsible completion block

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:641-643,880-885,1624-1717`
- Test: `tests/quotation-ui.test.ts:915-926`
- Modify: `docs/quotation-management.md`
- Modify: `docs/manuals/quotation/README.md`

**Interfaces:**
- Consumes: existing `activeCompletionTab`, Shadcn `Button`, `PaymentMethodList`, and `CertificationFields`
- Produces: local `completionExpanded: boolean`, pending-focus ref, and collapsible region `quotation-completion-content`

- [ ] **Step 1: Write the failing UI regression test**

Add these assertions to the existing completion-tabs test in `tests/quotation-ui.test.ts`:

```ts
assert.match(editor, /const \[completionExpanded, setCompletionExpanded\] = useState\(false\)/);
assert.match(editor, /const pendingFocusField = useRef<string \| null>\(null\)/);
assert.match(editor, /aria-controls="quotation-completion-content"/);
assert.match(editor, /aria-expanded=\{completionExpanded\}/);
assert.match(editor, /\{completionExpanded \? "ซ่อน" : "แสดง"\}/);
assert.match(editor, /id="quotation-completion-content"[\s\S]*hidden=\{!completionExpanded\}/);
assert.match(editor, /const completionField = errorFields\.find[\s\S]*field === "certification"[\s\S]*field\.startsWith\("certification\."\)[\s\S]*field\.startsWith\("paymentMethods"\)/);
assert.match(editor, /if \(completionField\)[\s\S]*setCompletionExpanded\(true\)[\s\S]*setActiveCompletionTab\([\s\S]*\? "payments"[\s\S]*: "certification"/);
assert.match(editor, /if \(!field \|\| isPending\) return/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because `completionExpanded` and `quotation-completion-content` do not exist.

- [ ] **Step 3: Add the minimal collapsed state and validation reveal**

In `QuotationEditor`, add the state beside `activeCompletionTab`:

```tsx
const [completionExpanded, setCompletionExpanded] = useState(false);
const pendingFocusField = useRef<string | null>(null);
```

Focus the saved error only after the transition finishes so certification controls are enabled:

```tsx
useEffect(() => {
  const field = pendingFocusField.current;
  if (!field || isPending) return;
  pendingFocusField.current = null;
  focusField(field);
}, [activeCompletionTab, completionExpanded, fieldErrors, isPending]);
```

In the failed-save branch, inspect every validation field so a completion error cannot remain hidden behind an earlier customer or item error:

```tsx
const errorFields = Object.keys(result.fieldErrors);
const firstField = errorFields[0];
if (firstField) pendingFocusField.current = firstField;
setFieldErrors(result.fieldErrors);
const completionField = errorFields.find(
  (field) =>
    field === "certification" ||
    field.startsWith("certification.") ||
    field.startsWith("paymentMethods"),
);
if (completionField) {
  setCompletionExpanded(true);
  setActiveCompletionTab(
    completionField.startsWith("paymentMethods")
      ? "payments"
      : "certification",
  );
}
```

Remove `focusErrorField`; this save branch is its only caller.

- [ ] **Step 4: Wrap the existing tabs in one accessible collapsible region**

Keep the existing tablist and tabpanel markup unchanged inside this header and region:

```tsx
<div className="flex items-center justify-between gap-3 border-b py-2">
  <h2 className="text-sm font-semibold">ข้อมูลท้ายใบเสนอราคา</h2>
  <Button
    aria-controls="quotation-completion-content"
    aria-expanded={completionExpanded}
    aria-label={`${completionExpanded ? "ซ่อน" : "แสดง"}ข้อมูลท้ายใบเสนอราคา`}
    onClick={() => setCompletionExpanded((current) => !current)}
    size="sm"
    type="button"
    variant="outline"
  >
    {completionExpanded ? "ซ่อน" : "แสดง"}
  </Button>
</div>
<div hidden={!completionExpanded} id="quotation-completion-content">
  <div aria-label="ข้อมูลท้ายใบเสนอราคา" role="tablist">
    {paymentTabButton}
    {certificationTabButton}
  </div>
  <div aria-labelledby={activeCompletionTabId} role="tabpanel">
    <div hidden={activeCompletionTab !== "payments"}>
      <PaymentMethodList />
    </div>
    <div hidden={activeCompletionTab !== "certification"}>
      <CertificationFields />
    </div>
  </div>
</div>
```

The names above describe the existing tab buttons and panels; move the current markup into the region without replacing its real props or callbacks.

Do not conditionally render `PaymentMethodList` or `CertificationFields`; the ancestor `hidden` attribute must only control visibility.

- [ ] **Step 5: Update operator documentation**

Add this behavior note to `docs/quotation-management.md`:

```text
The payment-and-certification block starts collapsed in the quotation editor. One show/hide button controls the whole block, and matching validation errors expand it on the relevant tab.
```

Add this operator note to `docs/manuals/quotation/README.md`:

```text
ส่วนช่องทางชำระเงินและการรับรองเริ่มต้นแบบซ่อน ใช้ปุ่ม แสดง/ซ่อน ปุ่มเดียว และระบบจะเปิดแท็บที่เกี่ยวข้องอัตโนมัติเมื่อพบข้อมูลไม่ถูกต้อง
```

- [ ] **Step 6: Run focused verification and verify GREEN**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: 80 quotation UI tests pass and TypeScript reports no errors.

- [ ] **Step 7: Verify responsive interaction**

At 390, 768, 1024, and 1536 px, verify:

```text
Collapsed: section header and one “แสดง” button are visible; tablist and panel are hidden.
Expanded: button reads “ซ่อน”; both tabs work; payment/certification inputs retain their values after collapse and re-expand.
Validation: while collapsed, Save with a payment error and then a certification error; each case expands the block, selects the matching tab, and focuses the first visible invalid control when that completion error is first.
Console: no errors.
```

- [ ] **Step 8: Run full verification**

Run:

```powershell
npm.cmd run lint
npm.cmd run test
git diff --check
```

Expected: lint passes, all non-environment-gated tests pass, and diff check reports no whitespace errors.

- [ ] **Step 9: Commit the implementation**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts docs/quotation-management.md docs/manuals/quotation/README.md
git commit -m "feat: collapse quotation completion tabs"
```
