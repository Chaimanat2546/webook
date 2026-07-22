# Quotation Item Description Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render quotation item descriptions in `text-slate-500` while keeping item names as the existing primary medium-weight text across Preview, Print, and Public Read-only.

**Architecture:** Change the shared `QuotationDocument` once because all three document surfaces consume it. Protect the presentation contract with the existing source-level quotation UI test; no new component, token, or dependency is needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Node test runner.

## Global Constraints

- The item name keeps its existing `font-medium` primary presentation.
- The item description keeps its existing font size and `whitespace-pre-line` behavior.
- The item description uses exactly `text-slate-500`.
- Do not use opacity, truncation, or a new abstraction.
- Preview, Print, and Public Read-only must remain consistent through the shared `QuotationDocument`.
- Preserve unrelated working-tree changes and add no dependency.

---

### Task 1: Apply Secondary Item Description Color

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `components/admin/quotations/quotation-document.tsx`

**Interfaces:**
- Consumes: `QuotationDocument` and the existing `source()` test helper.
- Produces: the existing item-description paragraph with `whitespace-pre-line text-slate-500`.

- [ ] **Step 1: Write the failing presentation test**

Add this test inside the existing `quotation UI` suite:

```ts
it("styles document item descriptions as secondary text", () => {
  const document = source("../components/admin/quotations/quotation-document.tsx");
  assert.match(
    document,
    /<p className="whitespace-pre-line text-slate-500">\{item\.description\}<\/p>/,
  );
  assert.match(document, /<p className="font-medium">\{item\.name\}<\/p>/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
```

Expected: FAIL only because the item-description paragraph does not yet include `text-slate-500`.

- [ ] **Step 3: Apply the minimal shared-document change**

Replace only the item-description paragraph:

```tsx
<p className="whitespace-pre-line text-slate-500">{item.description}</p>
```

Do not change the notes paragraph or any editor field.

- [ ] **Step 4: Verify GREEN and regression safety**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts
node --import ./tests/register-server-only.mjs --test "tests/quotation-*.test.ts"
npm.cmd run typecheck
npm.cmd run lint
git diff --check
```

Expected: all tests and typecheck pass; lint has no errors. Existing unrelated warnings may remain unchanged.

- [ ] **Step 5: Commit only the implementation slice**

```powershell
git add -- components/admin/quotations/quotation-document.tsx tests/quotation-ui.test.ts
git commit -m "style: mute quotation item descriptions"
```

Before staging, confirm the current uncommitted documentation and SQL snippet remain untouched.

---

## Completion Checklist

- [ ] Item names retain `font-medium`.
- [ ] Item descriptions use `text-slate-500`, the same font size, and preserved line breaks.
- [ ] Preview, Print, and Public Read-only inherit the same shared change.
- [ ] No opacity, truncation, component, helper, dependency, or unrelated edit is added.
- [ ] Focused quotation tests, typecheck, lint, and `git diff --check` pass.
