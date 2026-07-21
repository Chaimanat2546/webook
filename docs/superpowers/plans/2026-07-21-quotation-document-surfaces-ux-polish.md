# Quotation Document Surfaces UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete quotation UX polish MVP 4 by aligning Preview, Print, PDF, and Public Read-only while preserving the current data, calculation, authorization, and saved-state rules.

**Architecture:** Keep `QuotationDocument` as the Preview/Print/Public HTML presentation and keep the existing React PDF renderer. Both continue to consume `buildQuotationDocumentViewModel`; the work adds only explicit Public A4 scrolling, parity fixes, and a conservative PDF row-break rule.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, ShadcnUI, `@react-pdf/renderer`, Node.js test runner

## Global Constraints

- Preview/Print is the visual reference for PDF and Public Read-only.
- Public mobile keeps an A4-width document in an intentional horizontal scrolling viewport.
- Preview uses the current draft; Print uses the latest successful save; Share and PDF Download require a clean saved quotation.
- Keep item rows together when practical without making a validated oversized item unrenderable.
- Do not change database schema, migrations, RPCs, repositories, APIs, RLS, ownership, calculations, public-token rules, or trusted-asset rules.
- Do not add or modify dependencies, package manifests, or lockfiles.
- Preserve the user's untracked `docs/manuals/` directory.

---

### Task 1: Public A4 Viewport And Safe Not-found State

**Files:**
- Modify: `tests/quotation-public-share.test.ts`
- Modify: `app/q/[token]/page.tsx`
- Create: `app/q/[token]/not-found.tsx`

**Interfaces:**
- Consumes: `QuotationDocument`, `getPublicQuotationByToken`, the existing UUID token check, and Next.js `notFound()`.
- Produces: `data-public-quotation-viewport` and a route-local generic Thai not-found page.

- [ ] **Step 1: Write failing Public surface tests**

Add these assertions to `tests/quotation-public-share.test.ts`:

```ts
it("keeps the public A4 document inside an intentional horizontal viewport", () => {
  const page = source("../app/q/[token]/page.tsx");
  const document = source(
    "../components/admin/quotations/quotation-document.tsx",
  );

  assert.match(page, /data-public-quotation-viewport/);
  assert.match(page, /overflow-x-auto/);
  assert.match(page, /overscroll-x-contain/);
  assert.match(document, /w-\[210mm\]/);
  assert.doesNotMatch(page, /grid-cols|data-public-card/);
});

it("uses a generic Thai not-found state for invalid public quotations", () => {
  const notFoundPage = source("../app/q/[token]/not-found.tsx");

  assert.match(notFoundPage, /ไม่พบใบเสนอราคา/);
  assert.match(notFoundPage, /ลิงก์อาจไม่ถูกต้องหรือเอกสารถูกนำออกแล้ว/);
  assert.doesNotMatch(notFoundPage, /token|database|Supabase|error/i);
});
```

- [ ] **Step 2: Run the Public tests and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-share.test.ts
```

Expected: FAIL because the viewport marker, explicit horizontal-scroll classes,
and route-local not-found page do not exist.

- [ ] **Step 3: Mark the existing Public container as the A4 scroll viewport**

Replace the Public page `<main>` opening tag with:

```tsx
<main
  className="min-h-screen overflow-x-auto overscroll-x-contain bg-muted p-0 sm:p-4 print:overflow-visible print:bg-white print:p-0"
  data-public-quotation-viewport
>
```

Keep the existing `QuotationDocument` call unchanged. Its current
`w-[210mm]` width supplies the A4 canvas; do not add a second document wrapper.

- [ ] **Step 4: Add the route-local generic not-found page**

Create `app/q/[token]/not-found.tsx`:

```tsx
export default function PublicQuotationNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-6">
      <section className="max-w-md text-center">
        <h1 className="text-xl font-semibold">ไม่พบใบเสนอราคา</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ลิงก์อาจไม่ถูกต้องหรือเอกสารถูกนำออกแล้ว
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-public-share.test.ts
npm.cmd run typecheck
```

Expected: PASS. The existing invalid UUID and missing quotation paths must still
call `notFound()`.

- [ ] **Step 6: Commit the Public surface slice**

```powershell
git add -- app/q/[token]/page.tsx app/q/[token]/not-found.tsx tests/quotation-public-share.test.ts
git commit -m "feat: polish public quotation presentation"
```

---

### Task 2: HTML And PDF Content Parity

**Files:**
- Modify: `tests/quotation-pdf.test.ts`
- Modify: `components/admin/quotations/quotation-pdf.tsx`

**Interfaces:**
- Consumes: the existing `QuotationDocumentViewModel`, HTML `data-document-*` markers, and PDF `data-pdf-*` comments.
- Produces: a regression contract for section order and the same blank-reference fallback in HTML and PDF.

- [ ] **Step 1: Add failing parity assertions**

Add to `tests/quotation-pdf.test.ts`:

```ts
it("keeps HTML and PDF sections in the same approved order", () => {
  const html = readFileSync(
    "components/admin/quotations/quotation-document.tsx",
    "utf8",
  );
  const pdfSource = readFileSync(
    "components/admin/quotations/quotation-pdf.tsx",
    "utf8",
  );
  const htmlMarkers = [
    "data-document-header",
    "data-document-customer",
    "data-document-items",
    "data-document-summary",
    "data-document-payment-methods",
    "data-document-notes",
    "data-document-certification",
  ];
  const pdfMarkers = [
    "data-pdf-header",
    "data-pdf-customer",
    "data-pdf-items",
    "data-pdf-totals",
    "data-pdf-payment-methods",
    "data-pdf-notes",
    "data-pdf-certification",
  ];

  for (const markers of [htmlMarkers, pdfMarkers]) {
    let previous = -1;
    for (const marker of markers) {
      const current = (markers === htmlMarkers ? html : pdfSource).indexOf(marker);
      assert.ok(current > previous, `${marker} must follow the previous section`);
      previous = current;
    }
  }
});

it("shows the same fallback for an empty reference", () => {
  const html = readFileSync(
    "components/admin/quotations/quotation-document.tsx",
    "utf8",
  );
  const pdfSource = readFileSync(
    "components/admin/quotations/quotation-pdf.tsx",
    "utf8",
  );

  assert.match(html, /payload\.reference \|\| "-"/);
  assert.match(pdfSource, /value=\{payload\.reference \|\| "-"\}/);
});
```

- [ ] **Step 2: Run the PDF tests and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts
```

Expected: the section-order assertion passes against the current shared model,
and the empty-reference assertion fails because PDF passes the empty string.

- [ ] **Step 3: Apply the minimal reference parity fix**

In the PDF metadata block, change only the reference value:

```tsx
<Detail label="อ้างอิง" value={payload.reference || "-"} />
```

Do not copy HTML markup into the PDF renderer or add a new shared component.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: PASS with the existing amount, optional-section, saved-state, and
renderer tests unchanged.

- [ ] **Step 5: Commit the parity slice**

```powershell
git add -- components/admin/quotations/quotation-pdf.tsx tests/quotation-pdf.test.ts
git commit -m "fix: align quotation document surfaces"
```

---

### Task 3: Best-effort PDF Item Pagination

**Files:**
- Modify: `lib/quotation-pdf.ts`
- Modify: `components/admin/quotations/quotation-pdf.tsx`
- Modify: `tests/quotation-pdf-helpers.test.ts`
- Modify: `tests/quotation-pdf.test.ts`

**Interfaces:**
- Consumes: item `name` and `description` strings and React PDF's `View.wrap` behavior.
- Produces: `canKeepQuotationPdfItemTogether(name: string, description: string): boolean`.

- [ ] **Step 1: Add failing pagination helper tests**

Update the helper import in `tests/quotation-pdf-helpers.test.ts`:

```ts
import {
  canKeepQuotationPdfItemTogether,
  splitQuotationPdfWord,
} from "../lib/quotation-pdf.ts";
```

Add:

```ts
it("keeps ordinary PDF items together but leaves oversized items breakable", () => {
  assert.equal(canKeepQuotationPdfItemTogether("ค่าที่พัก", "รายละเอียด"), true);
  assert.equal(canKeepQuotationPdfItemTogether("A".repeat(300), "B".repeat(300)), true);
  assert.equal(canKeepQuotationPdfItemTogether("A".repeat(301), "B".repeat(300)), false);
});
```

Update the pagination assertion in `tests/quotation-pdf.test.ts`:

```ts
assert.match(
  items,
  /wrap=\{!canKeepQuotationPdfItemTogether\(item\.name, item\.description\)\}/,
);
assert.match(pdfSource, /<View fixed style=\{styles\.tableHeader\} wrap=\{false\}>/);
```

Keep the existing assertions that header, customer, payment container, and
validated long content remain page-break capable.

- [ ] **Step 2: Run helper and PDF tests and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf-helpers.test.ts tests/quotation-pdf.test.ts
```

Expected: FAIL because the helper and row `wrap` expression do not exist.

- [ ] **Step 3: Add the dependency-free conservative row helper**

Append to `lib/quotation-pdf.ts`:

```ts
const PDF_UNBREAKABLE_ITEM_TEXT_LIMIT = 600;

export function canKeepQuotationPdfItemTogether(
  name: string,
  description: string,
): boolean {
  // ponytail: character bound avoids oversized unbreakable rows; replace with
  // measured layout only if real PDF fixtures show this approximation is wrong.
  return name.length + description.length <= PDF_UNBREAKABLE_ITEM_TEXT_LIMIT;
}
```

The limit is intentionally conservative. Normal rows become unbreakable and
move intact to the next page; a validated item near the 2,000-character limit
stays breakable so React PDF can render all content.

- [ ] **Step 4: Use the helper on PDF item rows**

Update the existing helper import:

```ts
import {
  canKeepQuotationPdfItemTogether,
  splitQuotationPdfWord,
} from "../../../lib/quotation-pdf";
```

Change the item row opening tag to:

```tsx
<View
  key={item.id}
  style={styles.tableRow}
  wrap={!canKeepQuotationPdfItemTogether(item.name, item.description)}
>
```

Keep the fixed table header, `wrap={false}` totals/certification blocks, and
breakable outer payment section unchanged.

- [ ] **Step 5: Run pagination and print checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-pdf-helpers.test.ts tests/quotation-pdf.test.ts tests/quotation-ui.test.ts
npm.cmd run typecheck
```

Expected: PASS. The PDF helper must be executable in Node without importing
React PDF.

- [ ] **Step 6: Commit the pagination slice**

```powershell
git add -- lib/quotation-pdf.ts components/admin/quotations/quotation-pdf.tsx tests/quotation-pdf-helpers.test.ts tests/quotation-pdf.test.ts
git commit -m "fix: keep ordinary PDF items together"
```

---

### Task 4: Print Failure Recovery

**Files:**
- Modify: `tests/quotation-ui.test.ts`
- Modify: `components/admin/quotations/quotation-editor.tsx`

**Interfaces:**
- Consumes: the existing `printSaved`, `waitForQuotationPrintImages`, `cleanup`, and Sonner Toast.
- Produces: retryable Print failure feedback without changing saved-document selection.

- [ ] **Step 1: Add a failing Print recovery assertion**

Add to the existing Print test in `tests/quotation-ui.test.ts`:

```ts
assert.match(
  editor,
  /catch \{[\s\S]*if \(!controller\.signal\.aborted\)[\s\S]*toast\.error\("ไม่สามารถเตรียมเอกสารสำหรับพิมพ์ได้ กรุณาลองอีกครั้ง"\)[\s\S]*cleanup\(\)/,
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test --test-name-pattern="prints the saved document" tests/quotation-ui.test.ts
```

Expected: FAIL because the async Print preparation has no error boundary.

- [ ] **Step 3: Catch Print preparation failures and restore the action**

Wrap the existing body of the Print async IIFE in `try/catch` without changing
its successful path:

```tsx
void (async () => {
  try {
    const images = document.querySelectorAll<HTMLImageElement>(
      "[data-quotation-print] img",
    );
    const ready = await waitForQuotationPrintImages(images, {
      signal: controller.signal,
    });
    if (!ready || controller.signal.aborted) return;
    document.head.append(printStyle);
    document.documentElement.classList.add("quotation-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    if (!finished) timeout = window.setTimeout(cleanup, 1_000);
  } catch {
    if (!controller.signal.aborted) {
      toast.error("ไม่สามารถเตรียมเอกสารสำหรับพิมพ์ได้ กรุณาลองอีกครั้ง");
      cleanup();
    }
  }
})();
```

An aborted stale request remains silent because it is ordinary component
cleanup, not a user-visible Print failure.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-print.test.ts
npm.cmd run typecheck
```

Expected: PASS. The latest saved payload, image timeout fallback, and dirty
Draft behavior remain unchanged.

- [ ] **Step 5: Commit the Print recovery slice**

```powershell
git add -- components/admin/quotations/quotation-editor.tsx tests/quotation-ui.test.ts
git commit -m "fix: recover from quotation print failures"
```

---

### Task 5: Documentation, Cross-surface Acceptance, And Full Verification

**Files:**
- Modify: `docs/quotation-management.md`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: current operator/developer documentation; no runtime interface.

- [ ] **Step 1: Document the implemented document-surface behavior**

Add this subsection under `## Certification, Public Share, And PDF` in
`docs/quotation-management.md`:

```markdown
### Document surface consistency

- Preview/Print is the visual reference; HTML and PDF consume the same normalized document view model and keep the same supported section order.
- Preview shows the current draft. Print uses the latest successful save. Share and PDF Download require a clean saved quotation.
- Public Read-only keeps the A4 document width on small screens inside an intentional horizontal scrolling viewport.
- Print avoids splitting HTML item rows. PDF keeps ordinary rows together and leaves oversized validated descriptions breakable so content is not lost.
- Invalid or removed public links show a generic Thai not-found state without internal error details.
```

- [ ] **Step 2: Run all automated verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
$sourceRoot = "C:\Projects\webook"
$targetRoot = (Get-Location).Path
$copied = @()
try {
  foreach ($name in @(".env", ".env.local", ".env.production.local")) {
    $target = Join-Path $targetRoot $name
    if (-not (Test-Path -LiteralPath $target)) {
      Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination $target
      $copied += $target
    }
  }
  node --use-system-ca C:\Projects\webook\node_modules\next\dist\bin\next build --webpack
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  foreach ($path in $copied) { Remove-Item -LiteralPath $path -Force }
}
```

Expected: all commands exit 0. The explicit Next path reuses the workspace's
existing dependency runtime without installing or changing dependencies. The
temporary environment copies must be removed by `finally` and must not appear
in `git status`.

- [ ] **Step 3: Perform the responsive and document acceptance pass**

Use one saved quotation with:

```text
- seller/customer/subject values containing long Thai text;
- one unbroken English value longer than 48 characters;
- one ordinary item and one description longer than 600 characters;
- item discount and VAT enabled;
- at least one payment method;
- issuer, approver, company stamp, and Public QR;
- enough items to produce at least two PDF/Print pages.
```

Inspect Preview, Print, PDF, and Public at:

```text
390 × 844
768 × 1024
1280 × 800
1536 × 864
```

Confirm:

```text
- Preview/Print remains the visual reference and section order matches PDF/Public;
- Public at 390px and 768px scrolls horizontally inside its viewport and does not reflow into cards;
- Thai and long English text does not clip or overlap;
- amounts remain right-aligned with comma grouping and two decimals;
- ordinary items move intact when a page lacks space;
- the oversized description remains complete even if it spans a PDF page;
- table headers repeat, certification stays together, and no blank trailing page appears;
- invalid Public tokens show only the generic Thai not-found state;
- Share/Download remain clean-saved only and PDF failure produces no partial file.
```

- [ ] **Step 4: Confirm the diff stayed in the approved boundary**

Run:

```powershell
git diff --check
git status --short
git diff --name-only HEAD~4
```

Expected changed files only:

```text
app/q/[token]/not-found.tsx
app/q/[token]/page.tsx
components/admin/quotations/quotation-pdf.tsx
components/admin/quotations/quotation-editor.tsx
docs/quotation-management.md
lib/quotation-pdf.ts
tests/quotation-pdf-helpers.test.ts
tests/quotation-pdf.test.ts
tests/quotation-public-share.test.ts
tests/quotation-ui.test.ts
```

There must be no migration, repository, API, action, calculation, package, or
lockfile change. `docs/manuals/` remains untracked and untouched.

- [ ] **Step 5: Request read-only project review**

Ask `webook_reviewer` to inspect Tasks 1-4 for data loss, public-data leakage,
incorrect saved-state behavior, PDF overflow, and unsupported scope expansion.
Fix only evidence-backed findings and rerun the affected focused tests followed
by the full verification suite.

- [ ] **Step 6: Commit documentation**

```powershell
git add -- docs/quotation-management.md
git commit -m "docs: describe quotation document surfaces"
```
