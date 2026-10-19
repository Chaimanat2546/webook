# Integration Tests Reconciliation Plan

**Goal:** Repair the retired booking-migration test and execute the six opt-in integration suites plus the four previously skipped individual tests.

**Approach:** Use current SQL files without modifying any migration. Keep disposable PostgreSQL fixtures and create a separate local Supabase project for quotation API/auth tests; never reset existing local projects or connect these mutation tests to remote environments.

- [x] Reproduce the legacy failure and replace retired empty-schema assumptions with current booking snapshot migration checks: existing data, RLS, grants, actor attribution and reapplication.
- [x] Allow the quotation database suite to select its local Docker container, retaining the existing default.
- [x] Prepare an isolated local quotation stack from the repository's quotation-era migrations and capture credentials in memory only.
- [x] Execute booking Agent UUID, booking RPC, Dashboard PostgreSQL, quotation customers, quotation API/database and quotation ownership upgrade suites; rerun all four individual integrations.
- [x] Review changes, run typecheck/lint/full enabled tests, document exact results and shut down only task-owned test infrastructure.

No application behavior, production/staging data, credentials, existing migrations or deployment workflows change in this task. No commit, push or deployment is requested.

## Final Evidence

- Legacy booking regression: red `ENOENT` reproduced, current snapshot migration checks then passed.
- Full enabled suite: 1,186 tests, 1,170 passed, 16 failed, 0 skipped or cancelled. All six optional suites executed; the remaining failures are existing quotation contract/fixture mismatches, not bypassed.
- Typecheck and build passed; lint has 0 errors and 11 pre-existing warnings. Independent read-only review found no actionable issues.
- Task-owned local Supabase project was stopped; its isolated Docker backup and ignored setup remain available for reruns. Existing local projects were left running.
- Detailed results: `docs/integration-test-results-2026-10-19.md`.

## Follow-up: Quotation Fixture Alignment

User explicitly requests repairing the remaining 16 quotation fixture/test mismatches and rerunning every enabled integration with no failures or skips.

- [x] Reproduce the 16 failures on the isolated local stack.
- [x] Use actual owner-provisioned template revisions for valid quotation snapshots; add missing/forged/foreign snapshot rejection cases without changing database validation.
- [x] Supply explicit customer ownership, verify owner-only table/RPC reads and retain service-only mutations and per-owner uniqueness checks.
- [x] Run focused quotation integrations, all opt-in integrations, typecheck/lint/build and independent review; update final evidence.

Follow-up verification: focused quotation tests 21/21; full enabled run 1,188/1,188
across 93 suites, with 0 failures, skips or cancellations. Two additional security
tests cover both save-RPC layout rejection and expired/revoked public links.
Typecheck and Next.js build pass; lint reports 0 errors and 11 existing warnings.
Independent read-only review finds no actionable issues in the quotation changes.
- [x] Stop only the task-owned local Supabase stack. Do not commit, push, deploy or edit existing migrations.
