# Task 4: Account-Owned Repositories And Server Actions

## TDD evidence

- Added repository/action expectations to `tests/quotation-repository-actions.test.ts`.
- RED: `node --import ./tests/register-server-only.mjs --test tests/quotation-repository-actions.test.ts` failed on the singleton seller lookup, missing payment repositories/actions, missing wrapped save RPC, and missing payment snapshot hydration.
- GREEN: the focused repository/action, public-share, and UI tests passed after the implementation.

## Changes

- Seller profiles are queried and upserted by trusted `requireAdmin().user.id`, not a singleton row.
- Bank and account-owned payment-master repositories list ordered records and save the full master list through `save_quotation_company_payment_methods`.
- Payment asset uploads require quotation permission, accept only normalized PNG files up to the existing 2 MB payment limit, use random payment object keys, and send `image/png` to the Worker.
- Master and quotation saves validate uploaded payment media URLs against the trusted Worker before writing.
- Quotation saves call `save_quotation_with_payments`; repository reads map ordered payment snapshots for owner and public-token hydration. Successful saves return the normalized payload.

## Security and ownership

- The authenticated session ID is passed only from server-side `requireAdmin()` to seller profile repositories; it is never accepted from form data or client JSON.
- Payment-master replacement relies on the session-scoped security-definer RPC, which validates ownership and replaces the caller's complete list atomically.
- Every new mutation action checks `canUseQuotation(adminUser)` before validation, upload, or persistence.

## Verification

- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed with one existing `@next/next/no-img-element` warning in `components/admin/quotations/company-profile-form.tsx`.
- `npm.cmd run test` — passed: 265 tests, 0 failures.

## Documentation

No product documentation update was needed: this task adds internal server boundaries for the already-approved payment-method design, with no public API or setup change.

## Commit

Recorded with this task.

## Follow-up security fix

- Added `20260718110000_quotation_payment_asset_rpc_boundary.sql` without editing the original payment migration.
- The migration validates non-empty custom-bank-logo and QR URLs against the deployed `webook-media` Worker URL and random PNG payment-key contract, then enforces it with checks on both payment-master and quotation-snapshot tables.
- Direct-RPC integration coverage now rejects an external URL with SQLSTATE `23514` and accepts a valid Worker payment URL for both save RPCs.
- `QuotationCompanyProfileRow` now selects its declared `user_id` field.
- Follow-up verification: typecheck passed; lint has the existing `no-img-element` warning only; the full suite passed 266 tests with the local Supabase integration suite skipped because `RUN_LOCAL_SUPABASE_TESTS` is not enabled.
