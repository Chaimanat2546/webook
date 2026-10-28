# Login and Location History

## Behavior

- Password sign-in records one `public.login_history` row per verified Auth user/session.
  Refreshing a page/token, opening a bookmarked page, and password recovery do not create rows.
- The sign-in Server Action awaits persistence before redirecting to `/login/location`.
  Audit verification and persistence share a 3-second budget, with one DB retry for serialization/deadlock/connection errors,
  using the original metadata and the same unique key. It never retries authentication.
- If recording fails, sign-in continues to `/` and logs only `login_history_record_failed`.
  There is no durable retry queue; outages can leave gaps. No historical session backfill occurs.
- `/login/location` explains the purpose and offers sharing or skipping. Neither missing location
  nor a declined permission blocks access to another module. Management has not defined a location requirement.
- Sharing uses `getCurrentPosition` with a 10-second read timeout, no cached position, and normal accuracy.
  A separate 15-second watchdog finishes waiting even when permission UI remains unanswered.
- Reading happens once per mounted attempt. A sessionStorage marker containing only the history UUID
  prevents another read after reload in the same tab; no coordinates enter browser persistence.
  Separate tabs may make separate explicit attempts, but only one terminal result can be stored.
- Skip dispatches `skipped` and immediately continues to `/` without awaiting persistence.
  Sharing waits only for permission/location classification, then dispatches and continues.
  The existing same-origin JSON API uses bounded `fetch` with `keepalive: true`, surviving route unmount.
  There is no durable queue, automatic retry, visible save progress/result/error, or location toast.
  Browser shutdown or network loss can leave the existing row pending; coordinates never enter browser storage.
- An auth account change or sign-out cancels pending callbacks. The API also checks the old history ID
  against the *current* user/session, including when the same account signs in under a new session.
- The location window closes 10 minutes after login. Late/unanswered reports stay `pending` and appear
  as “ไม่ได้รับข้อมูลพิกัด”; that does not claim a user denied permission or that their device timed out.
- Location save failures leave unfinalized rows `pending` (ไม่ได้รับข้อมูลพิกัด), never a false denied/success outcome.
- Reloading a previously attempted event continues without another permission/location read.
- Login supports password visibility, username/current-password autocomplete, disabled pending controls,
  and inline credential/transport errors preserving the identifier. Session expiry has its own Thai message.

## Data and authority

`login_history.user_id` references `auth.users.id`; profiles and root roles are resolved only through
`public.users.uid`. `public.users.id`, email fallback, `mid`, and `dv_id` are not authentication identities.
Deleting an Auth user cascades their history. `session_id` deliberately has no FK to `auth.sessions`,
so logout/session cleanup does not erase audit history. Tokens/passwords/cookies are never audit columns.

Database constraints protect status, device values, coordinate ranges, finite accuracy, required success
fields, and null coordinates for failure/skip states. User-Agent classification is best effort and uses
bounded labels; raw User-Agent is not retained. Both device information and location are client-derived
signals, not proof of identity or physical presence.

IP is read only from `CF-Connecting-IP` when running in the production Cloudflare request context.
Untrusted forwarded headers and ordinary local Next.js runs yield null. Verify actual forwarding on Staging,
including IPv6 and any upstream Worker/proxy configuration, before treating it as the original visitor IP.

## Access control

- Only a unique `public.users.uid` mapping with `role_id = 1` may view History, including their own records.
  Non-root users cannot directly read even their own table rows. Sellers/property owners and `allow_members` alone grant no viewing access.
  No external tenant is queried, and no seller-level membership is inferred from `dv_id`.
- Signed-in session owners still record and attach their own current-session evidence through existing server-only RPCs.
- RLS protects direct reads; authenticated users have no direct history writes, deletes, or truncate.
- Server routes verify the *same* JWT using `getClaims(token)` and `getUser(token)`, and verify its
  session is still present. The attach RPC additionally locks that session and the history row and
  checks ownership/window/finalization atomically. Replaying identical reports succeeds; conflicting
  reports cannot overwrite the first result.
- Service-role RPCs are not executable by anon/authenticated. RPC listing independently derives
  root status from the actor; a forged UI filter/scope cannot grant additional access.
- `POST /api/login-history/location` requires matching Origin, JSON content type, and a body <=2 KiB.
  It accepts only history ID and a validated result; identity/role/IP/login time cannot come from the body.
  Responses use `private, no-store` and never return session UUID or raw database errors.

**Root assignment prerequisite:** user management now passes its verified actor to
`webook_update_user_guarded`. That RPC locks actor/target and requires the actor's current `allow_members`.
Non-root managers cannot appoint role 1 or modify existing role-1 targets (including permissions).
Only root actors who also pass the existing membership-management gate can do so.
Client writes to `public.users` are revoked and a trigger rejects client-origin mutations even through
legacy SECURITY DEFINER functions. Service and Auth maintenance remain available.
Review any additional remote RPC/schema changes before rollout: the local tests do not establish that
unseen external systems enforce the same authorization contract.

## History UI

`/admin/login-history` is available from the shared desktop/mobile sidebar and the authenticated
no-module-access screen. It does not change the default module landing order or mobile dock.
Navigation/shortcuts are root-only. Direct non-root navigation displays forbidden content with กลับหน้าหลัก,
without loading rows/counts. Root admins search current profile name/username/email.
Unmapped profiles get a fallback label, never an email-based identity match.

The date filter is a calendar-day filter in Asia/Bangkok. For example, 2026-10-26 means
`[2026-10-25T17:00:00Z, 2026-10-26T17:00:00Z)`. Invalid filters show an error, never an unrestricted query.
Pages default to 25 records (max 100). `status` accepts the existing seven statuses; omitted means all.
`sort=latest` (default) orders login time/UUID descending; `sort=oldest` orders both ascending.
Status/date/search predicates and ordering apply before pagination; count and rows use the same predicate.
Mobile uses a Sheet for status/order, Bangkok-day journal groups and separate date controls.
The date picker shares the dashboard's `ThaiDateRangePicker` and compact `RangeShortcuts`.
Date presets and manual ranges stay as drafts until the picker’s Apply action; Cancel leaves the filter unchanged.
Applying a range navigates immediately, preserving search/status/order and resetting pagination.
Without a date filter, history remains unrestricted by date. Clear filters restores this state.
Loading, default empty, filtered empty, invalid date and load failure retain the shared page context.
Date errors use ช่วงวันที่ไม่ถูกต้อง กรุณาเลือกใหม่; retry/page changes preserve criteria.
The desktop table becomes journal cards on mobile. Coordinates and accuracy are shown without contacting
a map/reverse-geocoding provider. Private data is excluded from service-worker caches/offline replay.

## Retention and operations

The existing database cleanup remains **90 days**, an operational setting. The updated in-scope product UI
does not disclose a retention duration. This UI change does not modify the cleanup function/policy.
The existing minute cron in both Wrangler environments calls `login_history_purge`, which uses the DB
clock, deletes at most 1,000 expired rows per run, and uses `FOR UPDATE SKIP LOCKED` for overlapping runs.
Rows exactly at the 90-day cutoff are retained until a later run. Primary DB deletion does not remove
older backups immediately; document the actual backup lifecycle separately in the approved policy.

Booking expiry, Push dispatch and history cleanup are awaited under separate failure boundaries.
Cleanup failure cannot prevent booking maintenance, nor can booking failure skip cleanup.
The Worker throws a sanitized `scheduled_maintenance_failed` if either branch fails.

Monitor these diagnostics (never add IP, coordinates, cookies, credentials, or database messages):

| Diagnostic | Meaning / response |
| --- | --- |
| `login_history_record_failed` | Possible missing audit row; inspect DB health/migration/config, without retrying user sign-in |
| `login_history_cleanup_failed` | Check job status and DB health; next cron retries |
| `login_history_cleanup_backlog` | A full 1,000-row batch; sustained occurrences need capacity/batch/frequency review |

Change retention through a **new migration**, update disclosure/UI copy and this document together,
and confirm the policy before enabling it. Browser permission is a technical permission, not an
organizational decision about legal basis or mandatory location use.

## Local verification

```powershell
npm run verify
npm run build
```

Build requires the normal Supabase public environment configuration. This worktree was built with
local placeholder values only; no Production environment or credentials were copied into it.

Behavioral SQL tests use a dedicated isolated PostgreSQL container with no published ports.
The Staging validation workflow now runs these Login History SQL suites and concurrent checks in
that isolated container before the existing full integration gate; a failure blocks migrations/deployment.
They do not use or reset any existing Supabase instance. Start the test container once:

```powershell
docker run --detach --name webook-login-history-tests --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
node scripts/test-login-history-db.mjs
```

If this named test container already exists but is stopped, use `docker start webook-login-history-tests`
instead of creating it again. The implementation session left it stopped, with only fictional fixture data.

The script resets **only this named disposable test database**, loads the minimal fixture from
`tests/fixtures/login-history-db.sql`, then runs the role-guard/history/root-filter migrations and SQL assertions.
It covers root-only RLS, status predicates, ascending/descending order and ties, blocked writes/RPCs, self-promotion, root-edit protection, session revocation,
account deletion, finite constraints, Bangkok date boundaries, retention limits, and actual concurrent
insert/report/purge calls. The fixture mirrors relevant public.users types from the baseline schema;
it is not a substitute for validating migration compatibility with the complete Staging schema.
The Node suite also exercises scheduled cleanup inside the native Workers runtime through Miniflare.

## Rollout checklist

1. Confirm purpose, 90-day retention, root-only reads, user disclosure, and backup handling with management.
   No location-dependent booking/payment rule is enabled by this release.
2. Review the complete Staging schema for extra user-writing functions/grants; verify Auth user creation,
   profile maintenance and user edits still work with the new direct-write restriction.
3. Apply `20261026160000_webook_user_role_guard.sql`, `20261026161000_login_history.sql`, then `20261028100000_login_history_root_filters.sql`
   using the repository's approved Staging migration workflow (GitHub Actions).
4. Verify Staging Supabase is `https://sxvkhzhqtrpxgzumsswl.supabase.co` and Cloudflare account is
   `0df55f166fa309dcc904e992c43f86db`; use only `npm run deploy:cf:staging` for the web Worker.
5. Test two accounts/sessions, refresh, concurrent requests, stale callbacks, denied/unavailable/timeout,
   absent mapping, forbidden member-manager escalation, root viewing, DB failures and cleanup on HTTPS.
   Include Chrome Android, Safari/iOS and installed PWA. Verify actual IP forwarding without printing IPs.
6. Review observed results before a separate Production release request. Production is not authorized here.

Rollback may remove the new UI/producer/cleanup while retaining stored history. Preserve the role guard
and guarded user-update path; redeploying an old unguarded user-management path reopens self-promotion.
Do not drop the history table or restore broad client-write grants as an automatic rollback step.

## Verification record

The 2026-10-28 UI update is recorded separately in `docs/superpowers/reports/2026-10-28-login-history-ui-verification.md`.
Results below are historical evidence for the previous implementation, not verification of the updated UI/access policy.

- 2026-10-26: `npm run verify` passed: strict typecheck, ESLint (11 pre-existing warnings),
  and 1,320 passed tests, 4 skipped, 0 failed after the independent review fix.
- `npm run build` passed with local placeholder Supabase configuration.
- `node scripts/test-login-history-db.mjs` passed both SQL suites and concurrent record/report/purge.
- Native Workers runtime test passed through Miniflare.
- Browser preview with fictional local Auth/data verified sign-in → explanation → skip → landing → own history,
  including a repeat after the audit-deadline fix. Desktop (1280 px) and narrow (319 px) layouts were observed.
  It revealed a Next.js loopback URL canonicalization issue; the endpoint now accepts loopback aliases
  only when scheme, port and actual Host match. Foreign production hosts remain rejected.
- Independent review found one Important issue: verification could stall before the DB timeout started.
  An abort-aware public Auth client now uses the same deadline, and no insert starts after expired verification.
  The stalled-verifier and actual SDK stalled-fetch regression tests pass. No Critical or Minor findings remain.
- Physical-device permission behavior and complete Staging schema compatibility remain
  rollout checks. No remote database was changed and no deployment was performed.

### Staging acceptance — 2026-10-26

Historical behavior below is superseded on 2026-10-28: self-history access, visible location results/retry,
and the temporary diagnostic route/links have been removed from the updated implementation.

The sign-in redirect includes the current history UUID in `/login/location?history=…`.
The login submit button disables while its Server Action is pending and displays
progress, preventing repeated button/implicit Enter submission from starting competing
Auth sessions in the same form. Separate deliberate sign-ins still have separate records.
The page resolves the verified session's pending record and redirects old/missing
history query values to its canonical URL. Prompt state resets for each record.
If a restored PWA page submits an old history UUID and receives 404, the error UI
offers a full page navigation to resolve the current session instead of replaying
the stale report. User/session authorization and one terminal result per record remain enforced.
Saving a denied, unavailable, timeout or unsupported result keeps the explanation
on screen and explicitly states that no coordinates were obtained. Only coordinate
success or explicit skip automatically continues into the application. An expired
or revoked session offers sign-in again instead of repeatedly retrying an invalid
session; other failed saves include their public HTTP status without database details.

For the unresolved installed-iPhone-PWA denial, Staging exposes a temporary
`/login/location/check` HTML diagnostic through links on login and saved-without-
coordinates screens. The route returns 404 unless the public Supabase URL is the
exact Staging target. It bypasses the React/auth workflow, requests geolocation
synchronously from a native button click and displays secure-context, standalone,
top-frame, policy, activation and native error information locally. It neither
posts coordinates nor prints them, and never changes login history. Use it from
inside the installed PWA to preserve the context being investigated. Remove the
probe after device triage; it is not a permission workaround or a completed fix.

After the local verification above, the implementation was combined with the requested
current-branch commit `6e68aab` at `552ba05`, then integrated with existing Staging work
at `fd7b64c`. The approved GitHub Actions workflow successfully applied migrations and
deployed Staging. Seventeen live HTTP/security checks and the browser sign-in → skip →
own-history flow passed with fictional accounts; all task-created accounts/history and
temporary credentials were cleaned up. Actual device permission and administrator
workflows remain pending. See the [Staging acceptance report](superpowers/reports/2026-10-26-login-location-history-staging.md)
for evidence and the remaining catalog-audit limitation.
