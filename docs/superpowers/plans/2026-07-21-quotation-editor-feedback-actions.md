# Quotation Editor Feedback and Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated quotation-editor actions, page-level validation summaries, and native in-page confirmations with one clear action hierarchy, concise Toast feedback, inline errors, and accessible Dialog confirmations.

**Architecture:** Keep all changes inside the existing quotation editor and its source-contract tests. Reuse the mounted Sonner Toast system and shadcn/Radix Dialog; keep server actions, calculation, saved-document readiness, and browser `beforeunload` behavior unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/Radix Dialog and Button, Sonner, Node.js test runner.

## Global Constraints

- Do not add dependencies or UI primitives.
- Do not change database schema, RLS, server actions, calculations, Public URL, PDF, or upload behavior.
- Keep inline field errors, accessible descriptions, first-error focus, and completion-tab switching.
- Use Dialog for confirmations initiated by editor controls; retain native `beforeunload` for refresh/tab/window close.
- Keep Share, Print, and Download availability gates unchanged.
- `ลบใบเสนอราคา` is explicit, secondary destructive, follows Download, and appears only for saved quotations.
- Verify mobile, tablet, laptop, and desktop behavior when browser tooling is available.

---

## File map

- Modify `components/admin/quotations/quotation-editor.tsx`: editor actions, Toast feedback, delete error state, and confirmation Dialog state.
- Modify `tests/quotation-ui.test.ts`: source contracts for actions, validation feedback, delete isolation, and confirmations.
- Modify `docs/quotation-management.md`: document the approved editor behavior.
- Reference `docs/superpowers/specs/2026-07-21-quotation-editor-feedback-actions-design.md`: approved requirements; do not edit during implementation unless the user changes the design.

### Task 1: Replace page-level save errors with Toast plus inline validation

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:668-670,950-976,1115-1125,1178-1202,1881-1913`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing `toast`, `fieldErrors`, `focusErrorField(field: string)`, and `Dialog` primitives.
- Produces: local `deleteError: string`; save failures use one Toast and existing inline field errors.

- [ ] **Step 1: Write failing feedback and delete-isolation tests**

Add these cases inside `describe("quotation UI", ...)`:

```ts
it("keeps quotation field errors inline and emits one validation toast", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");

  assert.match(editor, /Object\.keys\(result\.fieldErrors\)\.length[\s\S]*toast\.error\("กรุณาตรวจสอบข้อมูลที่กรอก"\)/);
  assert.match(editor, /const firstField = Object\.keys\(result\.fieldErrors\)\[0\][\s\S]*focusErrorField\(firstField\)/);
  assert.doesNotMatch(editor, /focusableFieldErrors/);
  assert.doesNotMatch(editor, /<AlertDescription>\{formError\}<\/AlertDescription>/);
  assert.match(editor, /<AlertDescription>\{calculationError\}<\/AlertDescription>/);
});

it("keeps quotation delete failures scoped to the delete dialog", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");

  assert.match(editor, /const \[deleteError, setDeleteError\] = useState\(""\)/);
  assert.match(editor, /if \(!result\.ok\) \{[\s\S]*setDeleteError\(result\.formError\)[\s\S]*toast\.error\(result\.formError\)/);
  assert.match(editor, /<AlertDescription>\{deleteError\}<\/AlertDescription>/);
  assert.doesNotMatch(editor, /const \[formError, setFormError\]/);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="field errors inline|delete failures scoped" tests/quotation-ui.test.ts
```

Expected: both new tests fail because the top summaries and shared `formError` still exist.

- [ ] **Step 3: Implement one Toast and delete-specific error state**

In `QuotationEditor`, replace shared form state with:

```ts
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [deleteError, setDeleteError] = useState("");
```

Delete `focusableFieldErrors`. In the failed-save branch keep inline state/focus and emit exactly one Toast:

```ts
if (!result.ok) {
  setFieldErrors(result.fieldErrors);
  if (result.formError) toast.error(result.formError);
  else if (Object.keys(result.fieldErrors).length)
    toast.error("กรุณาตรวจสอบข้อมูลที่กรอก");
  const firstField = Object.keys(result.fieldErrors)[0];
  if (firstField) focusErrorField(firstField);
  return;
}
```

Remove the two page-level Alerts for `formError` and `focusableFieldErrors`, but retain the calculation error Alert.

Scope delete failures:

```ts
function openDeleteDialog() {
  setDeleteError("");
  setDeleteOpen(true);
}

function deleteQuotation() {
  if (!payload.id) return;
  setDeleteError("");
  startTransition(async () => {
    const result = await deleteQuotationAction(payload.id!);
    if (!result.ok) {
      setDeleteError(result.formError);
      toast.error(result.formError);
      return;
    }
    setDeleteOpen(false);
    setIsDirty(false);
    toast.success(`ลบ ${documentNumber ?? "ใบเสนอราคา"} แล้ว`);
    router.push("/admin/quotations");
  });
}
```

Render `deleteError` only inside the delete Dialog:

```tsx
{deleteError ? (
  <Alert variant="destructive">
    <AlertDescription>{deleteError}</AlertDescription>
  </Alert>
) : null}
```

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run the Step 2 command.

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "fix: simplify quotation editor error feedback"
```

### Task 2: Remove More and expose the saved-document actions

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:16-26,72-78,327-374,1146-1177,1243-1294,1845-1863`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing `shareSaved`, `printSaved`, `downloadSaved`, `openDeleteDialog`, and readiness booleans.
- Produces: one primary header/mobile action group and one explicit saved-document action row; no `DocumentMore`.

- [ ] **Step 1: Write the failing action-hierarchy test**

```ts
it("keeps primary quotation actions separate from explicit document actions", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const desktopStart = editor.indexOf("data-desktop-command-actions");
  const desktop = editor.slice(desktopStart, editor.indexOf("</header>", desktopStart));
  const documentStart = editor.indexOf("data-document-actions");
  const documents = editor.slice(documentStart, editor.indexOf("</section>", documentStart));

  assert.ok(desktopStart >= 0);
  assert.ok(documentStart >= 0);
  assert.match(desktop, /กลับ/);
  assert.match(desktop, /ดูตัวอย่าง/);
  assert.match(desktop, /บันทึก/);
  assert.match(documents, /แชร์[\s\S]*พิมพ์[\s\S]*ดาวน์โหลด[\s\S]*ลบใบเสนอราคา/);
  assert.match(documents, /\{payload\.id \? [\s\S]*variant="outline"/);
  assert.doesNotMatch(editor, /function DocumentMore/);
  assert.doesNotMatch(editor, /เพิ่มเติม/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="primary quotation actions" tests/quotation-ui.test.ts
```

Expected: FAIL because `DocumentMore` and `เพิ่มเติม` still exist and Delete is hidden inside the menu.

- [ ] **Step 3: Delete duplicated action code and render explicit Delete**

Delete the `DocumentMore` component. Remove now-unused `Eye`, `MoreHorizontal`, `Save`, `X`, and `DropdownMenuItem` imports; retain the DropdownMenu primitives used by document settings.

After Download, render saved-only Delete:

```tsx
{payload.id ? (
  <Button
    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
    onClick={openDeleteDialog}
    size="sm"
    type="button"
    variant="outline"
  >
    <Trash2 aria-hidden="true" className="size-4" />
    ลบใบเสนอราคา
  </Button>
) : null}
```

Do not change the desktop header or mobile bottom bar: both continue to expose Back, Preview, and Save. Preserve the current Share, Print, and Download disabled states and labels.

- [ ] **Step 4: Run the focused test and quotation UI suite**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="primary quotation actions|workbench action hierarchy|downloads only the saved" tests/quotation-ui.test.ts
```

Expected: all selected tests pass. Update only stale assertions that intentionally required `DocumentMore`; do not weaken availability assertions.

- [ ] **Step 5: Commit**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "refactor: clarify quotation editor actions"
```

### Task 3: Replace in-editor native confirms with one local Dialog

**Files:**
- Modify: `components/admin/quotations/quotation-editor.tsx:93-110,668-690,764-801,1072-1084,1881-1913`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: existing `Dialog` primitives, `router`, payload setters, and dirty state.
- Produces: `PendingConfirmation` and one controlled confirmation Dialog for close, discount clearing, and VAT clearing. Delete keeps its existing dedicated Dialog.

- [ ] **Step 1: Write failing confirmation tests**

```ts
it("uses a dialog for every quotation editor confirmation", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");

  assert.match(editor, /type PendingConfirmation = "close" \| "disable-discount" \| "disable-vat" \| null/);
  assert.match(editor, /setPendingConfirmation\("close"\)/);
  assert.match(editor, /setPendingConfirmation\("disable-discount"\)/);
  assert.match(editor, /setPendingConfirmation\("disable-vat"\)/);
  assert.match(editor, /open=\{pendingConfirmation !== null\}/);
  assert.doesNotMatch(editor, /window\.confirm/);
  assert.match(editor, /beforeunload/);
});

it("preserves quotation values when a confirmation dialog is cancelled", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");

  assert.match(editor, /onOpenChange=\{\(open\) => !open && setPendingConfirmation\(null\)\}/);
  assert.match(editor, /onClick=\{\(\) => setPendingConfirmation\(null\)\}[\s\S]*ยกเลิก/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="dialog for every quotation|confirmation dialog is cancelled" tests/quotation-ui.test.ts
```

Expected: both tests fail because close, discount, and VAT still use `window.confirm`.

- [ ] **Step 3: Add the minimal pending-confirmation state model**

Near the editor types add:

```ts
type PendingConfirmation =
  | "close"
  | "disable-discount"
  | "disable-vat"
  | null;
```

Inside `QuotationEditor` add:

```ts
const [pendingConfirmation, setPendingConfirmation] =
  useState<PendingConfirmation>(null);
```

Extract only the two value-mutating operations:

```ts
function applyItemDiscount(enabled: boolean) {
  setShowItemDiscount(enabled);
  if (!enabled) {
    changed("items");
    setPayload((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, discountAmount: "0" })),
    }));
  }
}

function applyItemVat(enabled: boolean) {
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

Replace native confirmation branches:

```ts
function toggleItemDiscount(enabled: boolean) {
  if (!enabled && payload.items.some((item) => Number(item.discountAmount) > 0)) {
    setPendingConfirmation("disable-discount");
    return;
  }
  applyItemDiscount(enabled);
}

function toggleItemVat(enabled: boolean) {
  if (!enabled && payload.items.some((item) => Number(item.vatRate) > 0)) {
    setPendingConfirmation("disable-vat");
    return;
  }
  applyItemVat(enabled);
}

function closeEditor() {
  if (isDirty) setPendingConfirmation("close");
  else router.push("/admin/quotations");
}
```

Apply the pending action and clear it synchronously:

```ts
function confirmPendingAction() {
  const action = pendingConfirmation;
  setPendingConfirmation(null);
  if (action === "close") {
    setIsDirty(false);
    router.push("/admin/quotations");
  } else if (action === "disable-discount") applyItemDiscount(false);
  else if (action === "disable-vat") applyItemVat(false);
}
```

- [ ] **Step 4: Render one accessible confirmation Dialog**

Derive copy locally without creating a new shared abstraction:

```ts
const confirmationCopy = pendingConfirmation === "close"
  ? { title: "ออกจากหน้านี้โดยไม่บันทึก?", description: "การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป", confirm: "ออกโดยไม่บันทึก" }
  : pendingConfirmation === "disable-discount"
    ? { title: "ปิดส่วนลดเฉพาะรายการ?", description: "ส่วนลดของทุกรายการจะถูกล้าง", confirm: "ปิดและล้างส่วนลด" }
    : { title: "ปิด VAT เฉพาะรายการ?", description: "ค่า VAT ของทุกรายการจะถูกล้าง", confirm: "ปิดและล้าง VAT" };
```

Render beside the existing preview/delete Dialogs:

```tsx
<Dialog
  onOpenChange={(open) => !open && setPendingConfirmation(null)}
  open={pendingConfirmation !== null}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{confirmationCopy.title}</DialogTitle>
      <DialogDescription>{confirmationCopy.description}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={() => setPendingConfirmation(null)} type="button" variant="outline">
        ยกเลิก
      </Button>
      <Button onClick={confirmPendingAction} type="button" variant="destructive">
        {confirmationCopy.confirm}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Keep the `beforeunload` effect unchanged.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the Step 2 command.

Expected: 2 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "feat: confirm quotation editor changes in dialogs"
```

### Task 4: Update documentation and verify the complete editor flow

**Files:**
- Modify: `docs/quotation-management.md`
- Test: `tests/quotation-ui.test.ts`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: documented action, error, and confirmation behavior with a fully verified branch.

- [ ] **Step 1: Update quotation documentation**

Add a concise `Editor feedback and actions` subsection documenting:

```md
### Editor feedback and actions

- Back, Preview, and Save are the primary desktop/mobile actions.
- Share, Print, Download, and saved-only Delete are explicit document actions; there is no More menu.
- Invalid saves show one Toast, focus the first invalid field, and retain inline field messages.
- Back with unsaved changes and value-clearing settings use Dialog confirmation.
- Browser refresh/tab close retains the native unload warning.
```

- [ ] **Step 2: Run focused quotation UI tests**

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: every quotation UI test passes.

- [ ] **Step 3: Run full verification**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
```

Expected: every command exits 0. The full test report has 0 failures. A known multiple-lockfile build warning is acceptable only if the build exits 0.

- [ ] **Step 4: Perform responsive and interaction checks when browser tooling is available**

Verify `/admin/quotations/new` and a saved edit route at 390px, 768px, 1024px, and desktop:

- no horizontal action overflow;
- mobile bottom bar does not cover form content;
- invalid save shows one Toast and focuses the first invalid field;
- Back cancel preserves changes; Back confirm returns to the list;
- discount/VAT cancel preserves values; confirm clears values;
- Delete is absent on new quotations and explicit on saved quotations;
- Dialog keyboard focus, Escape, and focus return work;
- Share, Print, and Download retain their saved/dirty gates.

If browser tooling is unavailable, do not use a workaround forbidden by the environment; record the skipped manual check in the completion report.

- [ ] **Step 5: Commit documentation and any final test maintenance**

```powershell
git add -- docs/quotation-management.md tests/quotation-ui.test.ts
git commit -m "docs: describe quotation editor feedback actions"
```
