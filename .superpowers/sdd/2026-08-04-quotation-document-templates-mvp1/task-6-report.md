# Task 6 report - Extract Current PDF and dispatch templates

## RED/GREEN evidence

- RED: `node --import ./tests/register-server-only.mjs --test tests/quotation-pdf.test.ts tests/quotation-pdf-helpers.test.ts` failed as expected after the dispatcher/Current extraction assertions were added. The existing helpers passed; the failures identified the missing extracted Current renderer and missing template dispatch.
- GREEN: the same command passed with 21 tests and 0 failures after the extraction and dispatcher were implemented.

## Implementation

- Added the typed `ResolvedImages` and `QuotationPdfRendererProps` contract.
- Moved PDF presentation primitives, image lookup, office/VAT labels, payment, and signer rendering into the typed shared module.
- Extracted the Current `Document`/`Page` tree and its exact color/style sheet into `CurrentQuotationPdf`.
- Kept font registration, hyphenation, image collection/conversion, resolved-image lifecycle, download lifecycle, and their public exports at `quotation-pdf.tsx`.
- Added exhaustive typed dispatch from `model.payload.template`. Hospitality and Corporate are typed Current pass-through renderers until their dedicated layout tasks.

## Mechanical Current compatibility

- Compared `const colors` plus the complete `StyleSheet.create(...)` block against base `e588fed08e117c1feed7f2d80bac92fe42286921`: byte-identical.
- Verified the extracted Current source retains A4, Noto Sans Thai, `paddingHorizontal: 28.35`, the required semantic sections, and the oversized-item wrap decision.
- `git diff --check` passed.

## PDF render and visual verification

- The existing fixture `output/pdf/QO-20260718-0001.pdf` is a one-page A4 React PDF. It was rendered at 144 DPI with the bundled Poppler executable into `tmp/pdfs/task-6-current-fixture/current-1.png` and inspected at 100%. The baseline has legible Thai text, aligned tables, un-clipped certification content, and no blank page.
- The safe reference screenshot `output/screenshots/quotation-pdf-QO-20260718-0001.png` was not changed.
- Blocker: this worktree contains no authenticated quotation session or non-secret fixture input that can be used to download/regenerate the post-extraction Current PDF. The initial production build also confirmed there are no Supabase runtime values in the worktree. Therefore a before/after rendered-PDF image comparison cannot be claimed. The automated and source-level compatibility checks above were completed instead.

## Automated checks

- Focused PDF tests: PASS (21/21).
- `npm.cmd run typecheck`: PASS.
- Touched-file ESLint: PASS.
- `npm.cmd run build`: PASS with non-secret placeholder Supabase values. A no-environment build compiled and type-checked, then stopped at the expected missing Supabase environment error during static rendering.
- Full suite: 469 pass, 5 accepted baseline failures: central user manager page; central user manager tenant bindings; Cloudflare deployment boundary; house workspace shell agent guidance; shadcn usage rules.

## Files

- `components/admin/quotations/quotation-pdf.tsx`
- `components/admin/quotations/templates/quotation-pdf-contract.ts`
- `components/admin/quotations/templates/quotation-pdf-shared.tsx`
- `components/admin/quotations/templates/quotation-pdf-current.tsx`
- `components/admin/quotations/templates/quotation-pdf-hospitality.tsx`
- `components/admin/quotations/templates/quotation-pdf-corporate.tsx`
- `tests/quotation-pdf.test.ts`

## Self-review and concerns

- Public helper exports and the exact download filename remain at the existing module boundary.
- No dependency or unrelated source changes were made.
- The post-extraction visual render remains blocked as described above; authenticated fixture regeneration should be completed in an environment with approved test access before release acceptance.

## Commit

- Task revision: `HEAD` at commit `refactor: dispatch quotation PDF templates` (the immutable SHA is included in the task handoff after commit creation).
