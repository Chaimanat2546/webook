# Quotation Input Rules Design

## Scope

- New quotation numbers use `QO-YYYYMMDD0001`; saved numbers are never rewritten.
- Seller and customer tax IDs are required and contain exactly 13 digits.
- Seller and customer office types are `unspecified`, `head_office`, or `branch`; new values default to `head_office`.
- Branch number is editable only for `branch` and required in that case.
- Office choices use the horizontal Shadcn Radio Group in seller settings and quotation snapshots.
- New quotations default to seven validity days; the day-count input is disabled while the explicit valid-until date remains editable.
- Item VAT choices are exactly `7%`, `0%`, and `ไม่มี`; no free-rate field remains.
- `0%` is printed as `0%`; `ไม่มี` prints no VAT value.
- Section 03 always exposes item discount and VAT controls and has no document-settings menu.
- Optional reference and subject rows are omitted from document output when empty; the subject editor label includes `(ถ้ามี)`.
- The five-item catalog and its management UI are deferred. Item name and description remain free text.

## Architecture

Keep the existing quotation payload and snapshot flow. Extend the shared office type, enforce the rules at the server normalization boundary, and use the shared Shadcn Radio Group in the editor. Add a new non-destructive Supabase migration that replaces only the number generator and adds `NOT VALID` constraints so existing snapshots remain readable while new writes must comply.

Preview, Print, and Public Read-only continue to share `QuotationDocument`; PDF keeps its separate renderer. Section 03 always shows its editing controls, while generated documents retain content-driven columns: the discount column is omitted when every discount is zero and VAT is omitted when every item chooses `ไม่มี`.

## Error handling and compatibility

- Invalid tax IDs, VAT pairs, office types, and missing branch numbers return field errors without clearing the draft.
- Existing document numbers and snapshots are not backfilled.
- Existing legacy VAT values remain readable; saving a quotation requires selecting one of the new choices.
- No dependency, remote database, deployment, or item-master changes are included.

## Verification

Update service, UI-source, PDF, migration, and database integration tests. Run typecheck, lint, and the complete Node test suite. Run local database integration only when its existing environment variables are available.
