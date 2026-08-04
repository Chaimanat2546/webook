# Task 8 report - Corporate quotation template

## RED/GREEN evidence

- RED: Corporate HTML and PDF tests failed while both renderers were Current pass-throughs, specifically on the missing `corporate` template marker and `#142d4c` palette.
- GREEN: the focused UI/PDF tests passed after replacing both pass-throughs with Corporate-specific renderers.
- Review RED: an independent review found that a sequential Corporate HTML summary retained the generic print `break-inside: avoid` rule. A focused test then failed because no Corporate print override existed.
- Review GREEN: the print override now includes `[data-corporate-summary-sequential]`, so long payments and notes can flow while the settlement panel remains independently protected.

## Implementation

- Added distinct Corporate HTML and React-PDF layouts using navy `#142d4c` and gray `#f2f5f8`: top rule, seller identity, document-number badge, balanced seller/metadata block, recipient panel, aligned ledger, settlement panel, and a navy-separated certification row.
- Seller contact name, phone, and email are rendered when present. Shared view-model flags continue to govern reference, item unit/discount/VAT columns, monetary lines, payment methods, notes, certification, and optional assets. Internal notes remain absent.
- Corporate reuses the existing safe compact-versus-sequential settlement decision. PDF repeats the navy ledger heading, keeps normal item rows together, permits oversized descriptions to split, and renders sequential payment/settlement content safely for lengthy or QR-bearing fixtures.

## Automated verification

- Focused Corporate/UI/PDF/Public tests: PASS, 116 tests / 0 failures.
- Added a real renderer subprocess test: it statically renders Corporate with unit/discount/VAT disabled (no empty columns), confirms the sequential branch for an uploaded QR, and routes an uploaded PNG through `collectQuotationPdfImageSources` and `resolveQuotationPdfImages` using the production exports: PASS.
- `npm.cmd run typecheck`: PASS.
- Touched-file ESLint: PASS, 0 warnings.
- `git diff --check`: PASS.
- `npm.cmd run build`: compiled successfully and completed TypeScript, then stopped while prerendering `/login/reset-password` because this worktree has no Supabase environment variables. No Corporate compilation/type error occurred.

## Visual QA

- Local synthetic artifacts are intentionally untracked under `tmp/pdfs/task-8-corporate-fixture/`.
- Rendered one-page and 24-item/20-payment five-page Corporate PDFs with React PDF, including uploaded PNG QR sources resolved through the production source collection/resolution pipeline.
- Rendered the PDFs to PNG and visually inspected the compact page plus first and final multi-page pages. The compact fixture is one page; the long fixture is five pages with a repeated ledger heading, visible QR assets, complete settlement/certification content, and no clipping, overlap, or blank trailing page.
- The bundled Poppler wrapper was missing its native executable, so visual PNG rendering used a temporary PyMuPDF environment utility only; no repository dependency was added.
- Local artifact timestamps (Asia/Bangkok, `+07:00`): `one-page.html` at `2026-08-04 13:48:30 +07:00`; `one-page.pdf` at `2026-08-04 13:48:31 +07:00`; `multi-page.html` at `2026-08-04 13:48:31 +07:00`; `multi-page.pdf` at `2026-08-04 13:48:32 +07:00`; `one-page-1.png` and `multi-page-1.png` through `multi-page-5.png` at `2026-08-04 13:48:32 +07:00`.

## Files and scope

- `components/admin/quotations/templates/quotation-document-corporate.tsx`
- `components/admin/quotations/templates/quotation-pdf-corporate.tsx`
- `app/globals.css`
- `tests/quotation-ui.test.ts`
- `tests/quotation-pdf.test.ts`
- `tests/quotation-corporate-render.test.ts`
- `tests/fixtures/quotation-corporate-render.mjs`
- `tests/tsx-loader.mjs`

No dependency, migration, data-model, or dispatcher change was required. `tmp/` is intentionally untracked and must not be staged.

## Commit

- Immutable implementation commit: `e9a473db53b02c776eb2815467bf1ba18a01e900` (`feat: add corporate quotation template`).
