# Quotation Mobile Long-Amount Reflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep valid long quotation amounts inside mobile item and summary containers while preserving exact values and readable labels.

**Architecture:** Reuse the existing editor item row and `Totals` component. CSS flex wrapping handles normal and long values without JavaScript measurement; the server validation and calculator remain unchanged. A focused source-level regression test locks the mobile reflow classes, followed by a 390px visual check with both normal and long values.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Node test runner.

## Global Constraints

- A normal amount remains on the same row as its label.
- A long amount moves or wraps within the next available line, remains right-aligned, and stays inside its container.
- Labels keep readable width and are not compressed into a vertical stack of Thai words.
- Monetary output keeps exact decimal text and uses tabular figures.
- Do not truncate, use scientific notation, reduce the font size, or change the existing server-side 12-digit money limit.
- Cover item pre-tax value, summary rows, withholding tax, and amount due.
- Desktop alignment and current summary order remain unchanged.
- Add no dependency or new component abstraction.

---

### Task 1: Add Adaptive Mobile Amount Wrapping

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `components/admin/quotations/quotation-editor.tsx`

**Interfaces:**
- Consumes: the existing `Totals` component, item `preTaxAmount`, and withholding summary row.
- Produces: CSS-only adaptive wrapping for exact monetary output without changing payloads or calculations.

- [ ] **Step 1: Write the failing UI contract test**

Add this test inside the existing `quotation UI` suite:

```ts
it("keeps long editor amounts inside narrow item and summary containers", () => {
  const editor = source("../components/admin/quotations/quotation-editor.tsx");
  const totals = editor.slice(
    editor.indexOf("function Totals"),
    editor.indexOf("function positions"),
  );
  const item = editor.slice(
    editor.indexOf("function SortableQuotationItem"),
    editor.indexOf("function ItemDetailsControls"),
  );
  const withholding = editor.slice(
    editor.indexOf('data-quotation-totals'),
    editor.indexOf("<Dialog onOpenChange"),
  );

  assert.match(totals, /flex flex-wrap items-start justify-between gap-x-3 gap-y-1/);
  assert.match(totals, /<span className="shrink-0">\{label\}<\/span>/);
  assert.match(
    totals,
    /<output className="ml-auto max-w-full text-right tabular-nums \[overflow-wrap:anywhere\]">/,
  );
  assert.match(
    item,
    /max-w-full[^"]*tabular-nums[^"]*\[overflow-wrap:anywhere\]/,
  );
  assert.match(withholding, /flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2/);
  assert.match(withholding, /inputClassName="w-28"/);
  assert.match(
    withholding,
    /<output className="ml-auto max-w-full text-right tabular-nums \[overflow-wrap:anywhere\]">/,
  );
  assert.doesNotMatch(totals, /flex justify-between/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL because item, `Totals`, and withholding outputs still use non-wrapping single-row classes.

- [ ] **Step 3: Make `Totals` adaptive**

Replace the current `Totals` markup with:

```tsx
<div
  className={cn(
    "flex flex-wrap items-start justify-between gap-x-3 gap-y-1",
    bold && "border-t pt-2 font-semibold",
  )}
>
  <span className="shrink-0">{label}</span>
  <output className="ml-auto max-w-full text-right tabular-nums [overflow-wrap:anywhere]">
    {value}
  </output>
</div>
```

`cn` is already imported in this file. Do not create a new amount component.

- [ ] **Step 4: Contain the item pre-tax amount**

Add only these mobile-safe utilities to the existing item pre-tax paragraph,
leaving its `xl:` grid placement intact:

```text
max-w-full tabular-nums [overflow-wrap:anywhere]
```

The resulting paragraph continues to show the exact `preTaxAmount` followed by
`บาท`.

- [ ] **Step 5: Make the withholding row adaptive**

Replace the withholding container and relevant control/output classes:

```tsx
<div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2">
  <label className="flex flex-wrap items-center gap-2 text-sm">
    <input
      checked={payload.withholdingTaxRate !== null}
      className="size-4 accent-primary"
      onChange={(event) => setWithholdingEnabled(event.target.checked)}
      type="checkbox"
    />
    หักภาษี ณ ที่จ่าย
    <Numeric
      disabled={payload.withholdingTaxRate === null}
      error={fieldErrors.withholdingTaxRate}
      field="withholdingTaxRate"
      inputClassName="w-28"
      onChange={(value) => updateRoot("withholdingTaxRate", value)}
      size="compact"
      value={payload.withholdingTaxRate ?? "0.00"}
    />
    %
  </label>
  <output className="ml-auto max-w-full text-right tabular-nums [overflow-wrap:anywhere]">
    {money(calculation?.withholdingTaxTotal)}
  </output>
</div>
```

Keep the existing checkbox behavior and validation error binding unchanged.

- [ ] **Step 6: Verify GREEN and regression safety**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test "tests/quotation-*.test.ts"
npm.cmd run typecheck
npm.cmd run lint
git diff --check
```

Expected: all tests and typecheck pass; lint has no errors. Existing unrelated
warnings may remain unchanged.

- [ ] **Step 7: Verify the rendered narrow layout**

At approximately 390px width, enter a valid long price and quantity, then check:

- item pre-tax value remains inside the item;
- normal summary values stay on the same row;
- long summary values reflow below their labels and remain right-aligned;
- withholding controls and result do not compress the Thai label vertically;
- no horizontal page overflow appears.

Repeat with normal values and at desktop width to confirm the existing alignment.
If the authenticated browser is unavailable, report this visual check as blocked;
do not replace it with a completion claim.

- [ ] **Step 8: Commit the implementation slice**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "fix: contain long quotation amounts"
```

---

## Completion Checklist

- [ ] Valid long amounts remain fully visible inside mobile containers.
- [ ] Normal amounts retain the compact same-row layout.
- [ ] Labels remain readable and amount text is right-aligned with tabular figures.
- [ ] Item, totals, withholding, and amount due follow the same policy.
- [ ] Server validation, calculation formulas, desktop layout, and summary order are unchanged.
- [ ] No truncation, scientific notation, font reduction, dependency, or component abstraction is added.
- [ ] Focused quotation tests, typecheck, lint, diff check, and available visual checks pass.
