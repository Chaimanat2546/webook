# Integration verification — 19 October 2026

## Final quotation fixture repair result

The follow-up full run enabled every opt-in integration flag: **1,188 tests;
1,188 passed; 0 failed; 0 cancelled; 0 skipped; 93 suites**. Exit status was 0.
The focused quotation run passed all 21 tests with no failures or skips. This
includes all 16 originally failing cases and two additional security tests.

| Previously disabled suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Direct booking Agent UUID migration | 3 | 0 | 0 |
| House booking RPC | 8 | 0 | 0 |
| Dashboard PostgreSQL contract | 20 | 0 | 0 |
| Quotation customers | 1 | 0 | 0 |
| Quotation API/database | 20 | 0 | 0 |
| Quotation ownership legacy upgrade | 7 | 0 | 0 |
| **Six suites combined** | **59** | **0** | **0** |

The two dashboard migration-availability tests outside the suite and all four
formerly skipped individual integrations also passed, included once in 1,188.

### Changes and security coverage

- Valid quotation payloads load actual published template/revision rows through
  each owner's authenticated client, including layout schema version 2 and an
  independent copy of the saved layout. Hospitality saves use the hospitality
  revision rather than changing only the template label. Saved source, revision,
  schema and configuration are asserted exactly.
- Both save RPCs still reject unsupported templates, missing snapshots, obsolete
  schema and invalid layouts; unknown sources, unpublished revisions, modified
  layouts and another owner's real revision must be denied. The owner's visible
  quotation IDs must remain unchanged after rejected saves.
- Cross-account quotation updates use the caller's valid layout so the existing
  ownership assertion reaches the quotation boundary, not an unrelated malformed
  snapshot error. Existing permissions, payment-media restrictions, financial
  validation, soft-delete and public-data redaction assertions remain intact.
- Customer fixtures explicitly set the matching owner and audit actor. Owner
  identity comes from ordered account creation results, not the order in which
  parallel requests complete. Table and list-RPC reads cannot cross owners;
  anonymous/unauthorized access and direct client mutations remain denied.
  Duplicate active/inactive customer constraints still apply within an owner,
  while a second owner can use the same tax identifier independently.
- Public quotation reads work before expiry/revocation and return no data after
  either state. Those states are prepared with local administrative SQL, without
  granting the API role extra privileges or changing validation functions.
- No application code, schema, RLS policy, grant or existing migration was changed.
  Independent read-only review of both quotation test files found no actionable
  issues. Typecheck, Next.js build and ESLint passed (0 errors, 11 existing
  warnings).

Fresh logs in this chat's local artifact directory:
`quotation-fixtures-red.log` (reproduced 16 failures),
`quotation-fixtures-focused.log`, `quotation-fixtures-all-enabled.log`,
`quotation-fixtures-typecheck.log`, `quotation-fixtures-lint.log` and
`quotation-fixtures-build.log`. The isolated-stack scope and limitations below
still apply: this is not remote Staging verification or a full migration-chain
bootstrap. No commit, push or deployment was performed.

## Initial result before quotation fixture repair

The full suite ran with every opt-in integration flag enabled: **1,186 tests;
1,170 passed; 16 failed; 0 cancelled; 0 skipped**. The command exited with
status 1. This is not an all-green result and is not a deployment approval.

TypeScript and Next.js build passed. ESLint reported zero errors and 11
pre-existing warnings. Independent read-only review found no actionable issues
in the two changed test files.

## Initial six-suite breakdown

| Suite | Passed | Failed |
| --- | ---: | ---: |
| Direct booking Agent UUID migration | 3 | 0 |
| House booking RPC | 8 | 0 |
| Dashboard PostgreSQL contract | 20 | 0 |
| Quotation customers | 0 | 1 |
| Quotation API/database | 3 | 15 |
| Quotation ownership legacy upgrade | 7 | 0 |
| **Six suites combined** | **41** | **16** |

The dashboard test file additionally includes two passing migration-availability
tests outside its suite; its standalone file total is 22. These are already
included in the full-suite total, not counted again.

All four formerly skipped individual tests also passed in this full run:

- Transactional iCal PostgreSQL contract.
- Native Workers feed fetching without following redirects.
- iCal parsing/encryption/fetching in the local Workers runtime.
- Current booking snapshot migration on a populated fixture.

## Legacy test repair

`tests/legacy-booking-upgrade.test.ts` no longer reads the September 18 SQL
files deleted by commit `845280b`. It applies the current September 29 booking
snapshot migration to a synthetic production-shaped bigint schema with an
existing booking. Assertions preserve existing values, enabled RLS, service-only
RPC grants and the deposit; exercise the current update payload, derived nights
and attributed audit; and verify repeat application leaves the saved row and
audit count unchanged. The original `ENOENT` was reproduced before the repair.

This checks that specific migration and fixture, not automatic conversion of
the retired UUID legacy schema, the complete migration history, every deployed
RLS policy or remote database behavior. No existing migration was edited.

## Initial failures, now resolved

### Quotation customers — one failure

`tests/quotation-customer-database-integration.test.ts:49` still assumes shared
customer reads and inserts a service-role fixture without `owner_id`. The
current `20260806103000_quotation_security_hardening.sql` requires `owner_id`
and scopes reads to the owner. The fixture insert fails with PostgreSQL
`23502` before the remaining sharing assertions can execute. Updating this
suite must preserve the current ownership boundary rather than restore shared
reads or relax the constraint.

### Quotation API/database — fifteen failures

The shared `payload()` fixture lacks the current document layout snapshot,
schema version, template source and revision fields that the application service
supplies. Current database validation raises `22023` / `Invalid quotation
document layout snapshot`, preventing many tests from reaching their intended
assertions. This mismatch was reproduced against the repository's current
quotation migrations. It does not establish that each downstream behavior is
broken in the application.

Failed cases:

1. Reject unsupported item names in the direct save RPC.
2. Persist document display through both save RPCs.
3. Persist immutable template snapshots through both public save boundaries.
4. Enforce permission, atomic daily numbers, edit stability and soft delete.
5. Keep saved seller snapshots after profile changes.
6. Persist independent certification snapshots and public reads.
7. Validate certification masters and snapshots at the database boundary.
8. Persist a null unit with required quantity.
9. Reject inconsistent item and quotation money.
10. Persist withholding and expose saved public data.
11. Isolate seller, masters, quotations and public payment snapshots by owner.
12. Allow empty payment data without an asset-origin configuration.
13. Report missing payment asset origin through master and snapshot RPCs.
14. Reject external payment media through direct master and snapshot RPCs.
15. Normalize PromptPay and reject invalid payment methods.

The three passing quotation cases verify snapshot-table SELECT-only privileges,
the read-only item catalogue and the 1–100-item limit. No failing assertions were
deleted, weakened, marked skipped or changed to accept invalid behavior. The
quotation contract mismatches were reported, not fixed as part of the requested
legacy booking test repair.

## Local execution and safety

- Booking, dashboard and iCal suites create and remove their own disposable
  PostgreSQL 17 containers; Workers tests use the installed Miniflare runtime.
- Quotation API/auth tests used a separate task-owned local Supabase project,
  `webook-integration-20261019`, at `http://127.0.0.1:56321`, with Docker target
  `supabase_db_webook-integration-20261019`.
- The isolated work directory received 45 unmodified repository migrations
  through `20260806173000_save_quotation_layout_snapshot_before_insert.sql`,
  covering the quotation schema and its preceding baseline. A synthetic role-3
  row was seeded because the schema's user default references it. This setup is
  not a clean-bootstrap test of the entire later application migration chain.
- Local credentials were captured from CLI status into process environment
  variables without printing or committing their values. The test command
  checked the exact loopback API URL before running mutation tests.
- Existing local projects, Staging and Production were not reset or modified.
  No commit, push or deployment was performed for this task.
- The task-owned Supabase project was stopped after verification. Its isolated
  Docker backup and ignored setup directory remain for reproducibility; no
  task-owned test service is left running. Existing local projects remain up.

With an isolated, migrated local stack already running and its credentials
assigned to `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_ANON_KEY` and
`LOCAL_SUPABASE_SERVICE_ROLE_KEY`, the full run uses:

```powershell
$env:SUPABASE_DB_CONTAINER='supabase_db_webook-integration-20261019'
$env:RUN_BOOKING_DB_TESTS='1'
$env:RUN_DASHBOARD_DB_TESTS='1'
$env:RUN_LOCAL_SUPABASE_TESTS='1'
$env:RUN_QUOTATION_MIGRATION_UPGRADE_TESTS='1'
$env:ICAL_DB_INTEGRATION='1'
$env:ICAL_WORKER_INTEGRATION='1'
node --import ./tests/register-server-only.mjs --test --test-concurrency=2 "tests/**/*.test.ts"
```

Raw evidence is saved in this chat's local artifact directory:
`integration-all-enabled.log`, `integration-booking-dashboard.log`,
`integration-quotation-api.log`, `integration-lint.log` and
`integration-build.log`. Initial fixture-preparation failures are not represented
as passing test runs.
