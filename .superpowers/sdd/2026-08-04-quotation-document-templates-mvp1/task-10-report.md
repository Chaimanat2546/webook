# Task 10 Staging-Gate Report

## Result

**MVP 1 Staging gate: PASS**

**MVP 2 implementation: unblocked after this MVP 1 deployment gate**

No Production action was attempted.

This final result supersedes the historical blocker and "not run" sections
retained below as release provenance.

## Final Staging deployment and acceptance

- Final clean code deployment: Worker version
  `2371c19b-bbd2-49e3-9425-be101aa6a86b` at
  `https://webook-staging.chaymanus2003.workers.dev/`.
- Final Staging public-origin secret deployment: version
  `8b095d8d-80d2-4b53-94b6-16200cef3314`. The copied Share URL now uses the
  deployed Staging Worker host and `/q/<token>` path.
- Root commit `9eb7ccc` normalizes surrounding whitespace from the media
  Worker URL at the environment boundary. Its regression test failed before
  the fix and passed after it. This resolved quotation saves when a Cloudflare
  secret contained a trailing line break without modifying the media Worker
  secret value itself.
- Authenticated synthetic acceptance created and saved `QO-202608040001`.
  Hospitality Preview, Print portal, downloaded PDF, and Public read-only
  surfaces all rendered the same saved snapshot. The one-page Hospitality PDF
  was extracted and visually rendered with no clipping or overlap.
- Corporate was selected and saved as the account default. Before the quote
  save, Preview changed immediately while Public remained Hospitality. After
  save, Public changed to Corporate. A new quotation then opened with Corporate
  checked and labelled as the account default.
- The existing `QO-202607230001` quotation remained Current, with Current
  checked and its legacy Preview structure unchanged.
- Responsive acceptance covered a mobile breakpoint (`478px` effective
  browser content width from the requested mobile override) and desktop
  `1280px`. The editor had no mobile page overflow; the fixed A4 preview stayed
  intact in its intentional horizontal scroll container. Desktop A4 preview
  rendered without internal overflow.
- The saved synthetic Corporate quotation was expanded to 18 items and
  downloaded from Staging as a two-page A4 PDF. Both pages were rendered and
  visually inspected: all 18 items were present, the continuation table began
  correctly on page 2, and payment, totals, notes, QR, and certification were
  intact with no blank or clipped page.
- Deferred manual assets were replaced with the accepted synthetic Staging
  editor capture and fresh eight-point annotation. The Thai manual PDF was
  regenerated as four non-blank pages; all pages were rendered and inspected,
  and the pre-existing page-1 title/subtitle overlap was corrected.
- Final independent code review found no Critical or Important findings and
  judged MVP 1 ready to release.
- Fresh final verification passed the 113-test focused environment, quotation
  asset, and quotation UI suite, TypeScript, ESLint, and the Staging-environment
  Next.js production build. The complete test suite passed 490 of 495 tests;
  its five failures are the unchanged, unrelated baseline checks for Central
  User Manager UI/bindings, the legacy Cloudflare deployment boundary, house
  workspace guidance, and shadcn usage guidance.

## Pre-mutation target guard

- Worktree: `C:/Users/chaym/Projects/webook/.worktrees/quotation-templates-mvp1`
- Release-candidate SHA: `27b83a95287becad883f047cf36a1e220fd53713`
- Cloudflare guard: passed (`webook-staging`, account
  `0df55f166fa309dcc904e992c43f86db`).
- The worktree has no `.env.staging` file. The shared project-level
  `.env.staging` file verifies the required
  `NEXT_PUBLIC_SUPABASE_URL=https://sxvkhzhqtrpxgzumsswl.supabase.co` entry.
- `STAGING_DB_URL` was added to the shared `.env.staging` file and was loaded
  into the migration command process only after its parsed host exactly matched
  `db.sxvkhzhqtrpxgzumsswl.supabase.co`; its value was never printed.
- The direct Staging database hostname exposes only an IPv6 DNS record on this
  machine, and a port-5432 reachability check fails. The Staging API hostname
  resolves normally. This is an execution-host IPv6/connectivity limitation,
  not an ambiguous target.
- A subsequent supplied replacement was evaluated as a proposed Supavisor
  Session Pooler without printing its URL, user, or password. It uses a
  PostgreSQL scheme, port 5432, and database `postgres`, but fails both the
  official `*.pooler.supabase.com` hostname check and the expected
  `postgres.sxvkhzhqtrpxgzumsswl` Staging session-role check. It was rejected
  before connection.
- The corrected root-level `.env.staging` connection then passed every
  non-secret Session Pooler validation: official pooler hostname, port 5432,
  database `postgres`, and the `postgres.sxvkhzhqtrpxgzumsswl` Staging role.
  It was used only in the release command process.
- The required Staging dry-run connected successfully but reported unexpected
  remote migration history. The following remote versions have no local
  counterpart: `20260730032359`, `20260730040925`, `20260730050131`,
  `20260730063310`, `20260730072218`, `20260731041629`, `20260731055620`,
  `20260731084500`, and `20260731101500`. No migration was applied.
- After the nine remote-applied source migrations were aligned in commit
  `b208918`, the next Staging dry-run completed successfully, but it proposed
  two migrations: the intended
  `20260804044057_quotation_document_templates_mvp1.sql` and the unrelated
  `20260802090000_central_user_manager_rpc_audit.sql`. The latter is outside
  this MVP1 gate, so the required one-migration dry-run condition is not met
  and nothing was applied.
- The user subsequently explicitly approved that exact two-migration scope.
  The dry-run was repeated and again listed exactly those two migrations. The
  apply then stopped at the first statement of
  `20260802090000_central_user_manager_rpc_audit.sql` because Staging already
  has the `central_user_audit_events` relation (`42P07`). A read-only migration
  list confirms that both `20260802090000` and `20260804044057` remain
  local-only with no remote version recorded. No retry, repair, reset, or
  migration-source edit was performed.
- The only untracked worktree content is the previously recorded `tmp/` visual
  QA output; it was not staged, used as deploy source, or modified.

## Not run

The following remains blocked after the database release completed:

- authenticated Staging acceptance or screenshots;
- deferred manual editor-image update or final PDF regeneration.

## Successful Staging database release

- With explicit user authorization, migration-history repair marked **only**
  `20260802090000` as applied. Read-only history verification confirmed that
  exact remote version.
- The post-repair dry-run listed exactly one migration:
  `20260804044057_quotation_document_templates_mvp1.sql`.
- That quotation-template migration applied successfully. Read-only remote
  history confirms `20260804044057` is now present, and schema checks passed
  for both template columns, both constraints, the private validator/wrapper,
  and the public save wrapper.
- The Supabase CLI emitted a post-apply catalog-cache warning, but returned
  success and remote migration history/schema verification succeeded.

## Release-candidate checks

- Focused quotation suite: 172 passed, 0 failed; local database integration
  remains intentionally skipped without its local-stack flag.
- TypeScript and ESLint: passed.
- Full suite: exactly the five previously accepted unrelated baseline failures;
  no quotation/MVP1 failure was introduced.
- Staging-environment Next.js production build: passed. It retained the
  pre-existing multiple-lockfile workspace-root warning.

## First Staging Cloudflare deployment attempt (superseded)

- The Staging target guard passed for account
  `0df55f166fa309dcc904e992c43f86db` and Worker `webook-staging`.
- OpenNext build and static-asset upload completed, but Cloudflare rejected the
  Worker version request with API code `10143`: the required
  `CUM_BAANPARTY` service binding references `baan-pool-villa`, which is not
  present in the approved Staging account.
- No `webook-staging` Worker version was deployed. Do not run browser
  acceptance against an undeployed version.

## Successful Staging Cloudflare deployment retry

- Root commit `34d5ce5` removed the retired Central User Manager service
  binding. The Staging target guard and focused Cloudflare boundary test passed
  before retrying; the worktree had only the known untracked `tmp/` artifacts.
- The guarded Staging deployment completed successfully to account
  `0df55f166fa309dcc904e992c43f86db`, Worker `webook-staging`.
- Deployment URL: `https://webook-staging.chaymanus2003.workers.dev/`.
- Current Worker version: `7cd8f5b2-a4e0-4d5d-a08a-7ed355b35d44`.
- A non-authenticated health check followed the expected root redirect and
  reached `/login` with HTTP `200`. This is not a substitute for the required
  authenticated acceptance.
- The deployment retained pre-existing OpenNext-on-Windows and bundled
  duplicate-key warnings, but Wrangler completed the upload and trigger
  deployment successfully.

## Authenticated acceptance blocker

- The required Browser skill was initialized, but no browser backend/session is
  available in this environment (available-browser list is empty).
- Therefore the disposable-account/synthetic-data flow, 390px and 1280px
  screenshots, A4 multi-page inspection, public-share verification, and the
  deferred manual editor image/PDF regeneration have not been performed.
- Do not mark the Staging gate passed or unblock MVP2 until a browser-enabled
  session completes and records the full acceptance matrix.

## Validation-details deployment retry

- Root commit `08666e7` added the TDD-backed quotation validation-details UX
  fix. Deployment preflight confirmed the guarded Staging target and that the
  only untracked path is `tmp/`; no database action was run.
- The Staging deployment completed successfully to
  `https://webook-staging.chaymanus2003.workers.dev/`.
- Current Worker version: `d6af63f6-dda5-4607-bf0c-0250f7acce60`.
- The root agent is executing authenticated acceptance against this version;
  this deployment task did not run browser acceptance or alter the deferred
  manual assets/PDF.

## Read-only Staging provenance: `public.central_user_audit_events`

Catalog inspection used the validated Staging Session Pooler connection and
returned no row data, identifiers, emails, payloads, credentials, or default
expressions.

- Total row count: `106`.
- Columns: `operation_id uuid NOT NULL` (no default), `tenant_id uuid NOT
  NULL` (no default), `actor_uid uuid NOT NULL` (no default), `action text NOT
  NULL` (no default), `status text NOT NULL` (no default), `safe_error_code
  text NULL` (no default), `created_at timestamptz NOT NULL` (default present),
  and `completed_at timestamptz NULL` (no default).
- Primary key: `central_user_audit_events_pkey` — `PRIMARY KEY
  (operation_id)`. No separate unique constraints or unique indexes exist.
- Check constraints:
  `central_user_audit_events_action_check` restricts the five approved audit
  actions; `central_user_audit_events_status_check` restricts the six approved
  statuses; `central_user_audit_events_safe_error_code_check` permits null or
  a length of at most 64; `central_user_audit_terminal_state` enforces terminal
  statuses with `completed_at` and active statuses without it; and
  `central_user_audit_terminal_error` requires an error code only for `failed`
  status. Their catalog definitions match the corresponding expressions in
  `20260802090000_central_user_manager_rpc_audit.sql`.
- Indexes: unique btree `central_user_audit_events_pkey (operation_id)` and
  non-unique btree `central_user_audit_tenant_time_idx (tenant_id,
  created_at DESC)`.
- User triggers: none. Referencing foreign keys: `0` (no names).
- Rename-then-create collision analysis: renaming the table would free the
  table relation name, and check-constraint names are table-local; however, it
  would retain the schema-local index names
  `central_user_audit_events_pkey` and
  `central_user_audit_tenant_time_idx`. The restored migration would attempt
  to create both names again, so a table rename alone cannot make this
  migration apply cleanly.

## Read-only equivalence result

One final catalog-only comparison against
`20260802090000_central_user_manager_rpc_audit.sql` returned these booleans:

- RLS enabled: `true`; RLS forced: `true`.
- All eight column names, data types, and nullability values equivalent:
  `true`; mismatch names: none.
- All five check-constraint expressions semantically equivalent: `true`;
  mismatch names: none.
- Direct `PUBLIC` ACL entries absent: `true`.
- Effective privileges for `anon`: none (`true`); for `authenticated`: none
  (`true`).
- Effective `service_role` ACL is exactly `SELECT`, `INSERT`, and `UPDATE`
  with no other table privileges: `true`.

This evidence supports recommending a narrowly scoped migration-history repair
for the pre-existing audit table only. The user later explicitly authorized and
completed that single-version repair as recorded above. The MVP1 Staging gate
remains failed and MVP2 remains blocked until the Worker binding is restored
and the full deployment and acceptance sequence passes.

## Required resumption prerequisites

The database and Staging Worker release are complete. Resume in a
browser-enabled session authenticated to a disposable Staging quotation
account, then complete and screenshot the full acceptance matrix with synthetic
data, update the deferred manual images/PDF, and rerun the required document
visual checks. Do not rerun migration repair, migration apply, or deployment
unless a new dry-run or release change requires it.
