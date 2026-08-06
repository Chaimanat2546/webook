# Task 9 Release-Gate Report

## Scope completed

- Added source contracts and a real TSX subprocess fixture that renders the
  shared `QuotationDocument` root for `current`, `hospitality`, and
  `corporate`. The fixture verifies visible seller, document, customer, item,
  total, payment, note, and certification content for every key.
- Public forwarding coverage confirms the saved public payload reaches the
  template dispatcher and each fixed renderer is available.
- Updated architecture and Thai manual text for template defaults, immutable
  snapshots, and saved-surface behavior. Print renders `lastSavedPayload` even
  with a dirty draft; PDF and Public require a clean saved quotation.

## Manual PDF evidence

- `docs/manuals/quotation/exports/quotation-user-manual-th.pdf` was regenerated
  and rendered with local PyMuPDF. Four pages were inspected on 2026-08-04
  (+07:00): no clipped Thai text, broken images, incorrect numbering, or blank
  pages were found.
- Existing editor image assets were intentionally not replaced. A real
  authenticated Create/Edit flow was unavailable locally; the plan explicitly
  defers those captures until Staging acceptance.

## Bounded QA and handoff

- Automated renderer coverage uses only safe synthetic fixture data. It covers
  the three document keys and required public sections, but does not substitute
  for the authenticated product-flow audit.
- The authenticated Create/Edit, Preview, Print, PDF, and Public browser matrix
  remains deferred to Task 10/Staging. No hosted environment or Production data
  was accessed.
- Focused quotation tests, TypeScript, touched-file lint, and diff checks pass.
  The full repository verification retains unrelated pre-existing failures;
  a normal build without Supabase variables fails at the environment boundary,
  while the local-only environment build previously succeeded.
- Initial Task 9 handoff commit: `4031e91`. Parity commits: `2de3046`,
  `81b624e`, and `8223e95`.
