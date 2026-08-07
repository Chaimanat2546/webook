# Task 7 report - Hospitality quotation template

## RED/GREEN evidence

- RED: `node --import ./tests/register-server-only.mjs --test tests/quotation-ui.test.ts tests/quotation-pdf.test.ts` failed with the expected missing Hospitality palette and template marker assertions while both Hospitality modules were Current pass-throughs.
- GREEN: the same focused UI/PDF suite passed after implementing the dedicated HTML and React-PDF renderers.
- Pagination regression RED: a deterministic React-PDF fixture containing 24 long-description items and 20 payment methods rendered the side-by-side settlement panel across continuation pages. The root cause was a flex-row summary spanning React-PDF page breaks.
- Pagination GREEN: `tests/quotation-hospitality-layout.test.ts` first failed because `canUseHospitalitySideBySideSettlement` did not exist, then passed after the helper selected sequential content for 20 payments and retained side-by-side content for the compact case. The real PDF renderer now keeps the settlement block together and moves it to the next page when necessary.
- Review regression GREEN: an independent review found that the HTML summary still forced a two-column, print-break-avoiding container for long payment lists. The same layout helper now selects an HTML sequential path, and a focused regression test confirms that its explicit print rule permits content flow.
- Root review follow-up: both settlement surfaces now show gross and discount before pre-tax, VAT, grand total, withholding, and amount due. Boundary tests cover 2 payments/250 notes (side-by-side) and each first overflowing value. Real static HTML output confirms compact grid versus long sequential attributes and exact totals; regenerated real PDFs visually confirm gross/discount.
- Final QR regression: the shared helper now has an explicit `hasPaymentQr` input, so one or two visible payment QR sources always select the sequential layout while compact non-QR content remains side-by-side. A regenerated QR PDF exposed a separate React-PDF issue where sequential payment content inherited a zero-basis grow style and collapsed; a RED test captured it and the sequential wrapper now uses no grow style. Independent final scoped review: PASS.
- Post-commit QA correction: the first uploaded-QR evidence fixture passed an unsupported SVG directly to the PDF renderer, so it produced blank boxes and did not exercise the production resolver. The corrected fixture uses a real PNG QR data URL behind an uploaded PNG URL, sends every collected source through `resolveQuotationPdfImages`, asserts a resolved entry for every uploaded QR, and renders only with that resolved-image map.

## Implementation and design evidence

- Replaced both Current pass-through modules with real `HospitalityQuotationDocument` and `HospitalityQuotationPdf` renderers.
- Both surfaces use the approved dark green `#286a5b`, warm gold `#c79b58`, and off-white `#fffdf8` palette; start with a green rule; provide bilingual `QUOTATION` / `ใบเสนอราคา`; prioritize the recipient beside metadata; and render the accommodation/service ledger. Compact content remains side-by-side; longer payment/notes content flows sequentially on both surfaces.
- The shared view model remains the sole data authority. Reference, item unit/discount/VAT, pre-tax/tax/withholding, notes, payments, QR/signatures/stamp, certification labels/dates, optional images, seller contacts, and the full footer are all rendered through the existing model flags and shared helpers. Internal notes are not rendered.
- PDF items use `canKeepQuotationPdfItemTogether`; their heading is fixed/repeated; the compact certification row uses the shared signer/image primitives; and long payment, notes, or QR-bearing content uses the tested sequential settlement fallback without collapsing payment rows.

## Automated verification

- Focused Hospitality/UI/PDF/Public tests: PASS, 121 tests / 0 failures.
- Touched TypeScript-file ESLint: PASS, 0 warnings. The repository ESLint configuration has no CSS matcher, so the narrowly scoped print CSS addition is covered by the focused regression test and `git diff --check` instead.
- `npm.cmd run typecheck`: PASS.
- `git diff --check`: PASS.
- Full `npm.cmd test`: retained the five accepted baseline failures only: central user manager page, central user manager tenant bindings, Cloudflare deployment boundary, house workspace shell guidance, and shadcn usage rules. All quotation/Hospitality tests passed.
- `npm.cmd run build`: compiled successfully and completed TypeScript, then stopped at the established missing Supabase environment variables while prerendering `/login/reset-password`. No Hospitality compile or type error occurred.

## Visual and pagination QA

- Created deterministic local fixtures (untracked under `tmp/pdfs/`): compact and five-page 24-long-description/20-payment cases, single uploaded-QR, automatic PromptPay-QR, two uploaded-QR, and certification-hidden PDFs. The compact and long fixtures deliberately omit logo, signatures, stamp, and Public QR, exercising stable missing-image slots. The certification-hidden fixture turns off certification name/date/QR together.
- Rendered the final PDFs with Poppler at 144 DPI and inspected the compact, multi-page, QR, and certification continuation pages. The one-page PDF retains the intended compact no-QR payment/settlement composition. The automatic PromptPay QR and the corrected production-resolved uploaded PNG QR are visible; the compact two-uploaded-QR fixture visibly contains both QR images, retains both payment rows, and uses the full-width sequential settlement. The multi-page PDF has repeated item headings, legible Thai glyphs, intact rows, no clipped content, stable empty image slots, an intact settlement block, certification, and seller footer.
- The before-fix fixture is retained only in `tmp/pdfs/task-7-hospitality-fixture`; the inspected final fixture is `tmp/pdfs/task-7-hospitality-fixture-fixed`.

## Files and scope

- `components/admin/quotations/templates/quotation-document-hospitality.tsx`
- `components/admin/quotations/templates/quotation-pdf-hospitality.tsx`
- `lib/quotation-hospitality-layout.ts`
- `tests/quotation-hospitality-layout.test.ts`
- `tests/quotation-ui.test.ts`
- `tests/quotation-pdf.test.ts`
- `app/globals.css`

No dependencies, migrations, dispatcher boundaries, or unrelated product files were changed. Local fixture files are intentionally untracked and not staged; this report is force-staged with the implementation if a commit is requested, following the prior task-report convention.

## Self-review and concerns

- Manually checked that the HTML A4 root is `210mm` with a `297mm` minimum height, while the PDF uses A4 and retains the Current base font size of 8pt.
- The HTML surface was verified through renderer structure and shared flag contracts; browser/authenticated quotation QA is unavailable in this worktree, but PDF rendering used only deterministic safe synthetic data and did not contact external systems.
- Commit SHA: recorded in the task handoff after this report is committed atomically with the implementation.
