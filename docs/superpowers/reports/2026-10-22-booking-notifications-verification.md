# Booking notifications verification

Date: 2026-10-22 (Asia/Bangkok)

## Delivered

- Atomic booking INSERT notifications for linked admins and DV-matching owners.
- Scoped, paginated inbox, unread/read-all state and responsive shared bell/Sheet.
- Approved encrypted Web Push adapter, current-scope checks before each send,
  leased jobs, bounded concurrency, retries and expired-device retirement.
- Per-device opt-in, sign-out/account-switch/recovery cleanup, and a root session
  guard that also runs outside admin routes.
- Safe iCal summaries and authorized links to existing booking/calendar views.
- Private VAPID generation helper and setup/operations documentation.

## Checks

- `npm run build`: passed after the final application source change; generated
  `public/sw.js` from its source.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 11 warnings in existing dashboard/image/route code
  and the pre-existing anonymous Worker export style; no lint errors.
- Full `npm test` with `RUN_NOTIFICATION_DB_TESTS=1`: 1,233 tests, 1,229 passed,
  zero failures, four skipped tests. Other opt-in database/runtime suites remained
  disabled. All 13 new notification SQL integration cases executed and passed.
- SQL fixture: disposable PostgreSQL17 container, no network, no configured
  Supabase credentials. No remote migration or booking mutation performed.
- Additional targeted regression runs passed for read-all PostgreSQL microsecond
  cutoff preservation, account-switch cleanup, post-claim revocation and the
  globally mounted Push session guard.

## Review and regression fixes

An independent reviewer checked recipient permissions, service-only grants/RLS,
Push endpoint validation/encryption, queue behavior, device lifecycle, iCal scope
and missing-VAPID behavior. Two P2 findings were fixed:

1. Claimed jobs could outlive a permission/subscription change before sending.
   Added service-only `booking_push_authorize` and per-delivery checks immediately
   before transport. SQL and dispatcher regression tests exercise revocation after
   claim; the dispatcher test failed before the fix and passed afterward.
2. Switching to an account without module permissions or resetting a password
   could bypass shell-only subscription cleanup. Added server binding retirement
   on successful switching, reset cleanup and the root PWA session guard. Actual
   login-action boundary tests and seven guard runtime tests passed, including
   no-access account changes and focus/online cleanup retries.

Implementation self-review also corrected orphan Auth UID event capture,
NULL-role owner parity with Dashboard, bounded invalid-job cleanup, the Dashboard
detail month, stale acknowledgement handling and truthful partial-cleanup UI.
SQL regressions for orphan UID, NULL role and cleanup bounds were observed failing
against PostgreSQL before their fixes. The initial missing-feature SQL RED run
was not observed before implementation because Docker startup was delayed.

## Limits and rollout

No deployment, remote schema change or environment secret creation was performed.
Apply the new migration and configure per-environment VAPID values before enabling
Push. See `docs/booking-notifications.md` for setup and device acceptance steps.

Actual Android/iPhone delivery and browser viewport inspection remain unverified.
The available CUA browser inventory was empty; no browser surface could open for
390px/desktop screenshots. Runtime/SSR tests verify behavior but do not establish
real-device delivery, OS permission UX or visual overflow.

Test database processes and containers were stopped and removed. Automatic
approval review rejected deletion of the disposable portable PostgreSQL tooling
with the sole reason `blocked by policy`; inert ZIP/binaries remain at
`C:/Users/chaym/AppData/Local/Temp/webook-booking-notifications-pg-20261022`.
No global installation, PATH changes or PostgreSQL system service were created.
