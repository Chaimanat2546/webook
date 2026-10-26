# Booking lifecycle notifications — Staging

## Agreed behavior

Extend the existing inbox and mobile Push subsystem for every admin and the
owners whose DV matches both booking and listing, with current authorization
checked again on read/send. The user explicitly confirmed that an internal
`waiting` → `confirmed` operator update means successful payment in this system;
there is no separate payment-gateway verification in this change.

- Internal waiting → confirmed: `payment_succeeded`.
- Waiting/confirmed → cancelled by an operator: `booking_cancelled`.
- Due waiting booking cancelled by the existing scheduled expiry sweep:
  `payment_expired`, without a generic cancellation event as well.
- Existing new-booking behavior remains. Creating a confirmed booking does not
  also create a payment event. Repair cancellations do not notify, and iCal
  confirmation updates never imply payment.

Same-status saves/repeated cron sweeps do not notify again. A later real status
transition is a separate event. Lifecycle events do not backfill earlier Push
jobs onto a newly enabled device. Existing inbox history remains accessible.

## Implementation

The new migration `20261022150000_booking_lifecycle_notifications.sql` adds a
validated `event_type` to notifications, retains partial uniqueness for booking
creation, and captures status changes atomically with their recipients/device
jobs. The cancellation provenance column distinguishes a manual cancellation
after its deadline from the expiry sweep; reopening clears that provenance.
Existing client mutation allowlists do not accept the provenance column.

List/claim RPCs return the event type. Typed repository parsing preserves it,
and encrypted Push payloads carry only UUID plus allowlisted kind. Inbox and
detail reuse the existing components, show the event-specific label, and identify
the booking status as current. The service worker chooses only fixed generic
titles and retains UUID-only payload compatibility. It continues to launch the
installed PWA through the existing validated same-origin notification route.

No dependency or new UI primitive was added. House Workspace Shell does not apply
to this notification flow. Installed devices need the PWA update for the new
event-specific Push titles, without disabling/enabling Push.

## Local verification

- Observed RED: missing payment/cancellation/expiry events in real PostgreSQL;
  UI labeled every event new; worker titles and encrypted payload omitted kind.
- GREEN: 18 real SQL integration cases against disposable localhost PostgreSQL,
  including service-role expiry, browser RPC denials, recipient scope, rollback,
  same-status suppression, repeat expiry, reopening and no old-event Push backfill.
- `npm run verify`: typecheck/ESLint passed, 1,254 tests passed, zero failed,
  four optional integration suites skipped in this command. CI enables all.
- `npm run build`: passed.
- Independent read-only review: no correctness, authorization or privacy blocker;
  reviewer independently ran 19 focused tests successfully. Rollout caveat above
  records installed-worker update requirements.

## Staging rollout and acceptance

Only Staging is authorized: Supabase `sxvkhzhqtrpxgzumsswl`, Cloudflare account
`0df55f166fa309dcc904e992c43f86db`, Worker `webook-staging`. Target assertion passed.
CI/CD will apply the new migration and run the approved Staging deployment command,
with compiled bundle environment guards. Production deployment/mutation is forbidden.
Main was verified at `d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1` before push.

Live acceptance uses two synthetic admins, two owners with different DVs and
marked inactive QA houses. Exercise payment + manual cancellation on one booking,
and actual scheduled expiry on another. Check every recipient's authenticated
inbox, denied cross-DV details, encrypted delivery through real Push providers,
and cleanup scoped only to the QA fixtures. Record actual results below.

## Initial deployment and live results

- Feature commit: `fe4b272a5c744da191ba34b78375a93c2dbcce6e`.
- CI/CD: https://github.com/Chaimanat2546/webook/actions/runs/39791645259
- Validation: **1,335 tests passed, zero failures/skips**. Both compiled-bundle
  environment guards and temporary runtime-secret cleanup passed.
- Initial Worker version: `90587583-138b-4264-a119-d065f18d0dca`.
- Live worker matched the committed source, SHA-256
  `ce30168be5eefd6d62e0988b3eaf20e4c5846ed17c1bdf97b2b6f478c9d600e7`.
- Live unauthenticated health checks passed: login 200, dashboard 307 to login,
  inbox 401 private/no-store, worker 200.

Two inactive QA houses, DV 99882211/99882212, and bookings 685/686 exercised:
waiting → confirmed → same-status save → manual cancellation on the first;
new waiting booking with a future one-minute deadline on the second. The actual
deployed scheduled sweep expired the latter without a direct expiry RPC call
from the test. Same-status save added no event.

Exact recipient sets matched for every event: all three admins (one existing,
two synthetic), plus only the matching owner. **20 inbox items** were captured.
Authenticated HTTP checks passed for all four synthetic accounts: five events
per admin, three for owner A, two for owner B; owner cross-DV details were denied
without exposing the other house title. Detail pages showed the event type.

Four real Mozilla Push protocol channels received and independently decrypted
**15 messages**, with exact per-account UUID and event-type matches. The deployed
dispatcher completed **25 delivery jobs**, including five events to the existing
PWA device and five to its other device. The five cancellation jobs needed a
lease-recovery attempt and were successfully sent on attempt two at 21:19:37 ICT;
the cause of the interrupted first attempt is not established. Other jobs sent
on attempt one. No final job remained pending, sending or failed.

Browser testing with owner A confirmed the scoped inbox, payment-event detail,
current cancelled status and explicit read state at mobile-width layout. A local
screenshot is retained in the ignored acceptance directory. Physical iPhone
display of the new event-specific titles is not asserted from provider receipt.

UI inspection found the Sheet description still referred only to new bookings.
A copy-only follow-up expands it to include status changes; build and full local
verification passed again. Final deployment/cleanup evidence follows below.

## Final deployment and cleanup

- Deployed application commit: `9283672997941fba4e4fda5fb0ed3b4d8dadc3ca`.
- Final CI/CD: https://github.com/Chaimanat2546/webook/actions/runs/39795494042
- Both validation and Staging deployment succeeded: **1,335 tests passed, zero
  failures, cancellations or skips**. The compiled bundle contained the Staging
  Supabase reference and no Production reference; temporary-secret cleanup passed.
- Final Worker version: `866555b8-9859-4522-b7ea-cdfd93f85985`.
- Live `/sw.js` matched the committed artifact, SHA-256
  `357bc639b2921fd67b60991d3d76d2122f5ddd366a39c622973280efefd4252c`.
  Login 200, dashboard 307, private/no-store inbox 401 and worker 200 were
  rechecked after deployment.
- Owner B browser acceptance also passed: only its two events appeared; the
  expiry detail retained the expiry heading, current cancelled status and read
  state. Both owner screenshots are retained locally in the ignored QA directory.
- Cleanup was verified again after final deployment: zero QA bookings, houses,
  customers, application users, Auth users, notifications or delivery jobs.
  Both original device subscriptions remain, including the current PWA device.
- Remote `main` remains `d6aa72f57b9e8accf91fc4d74ac6af3539fd58f1`; remote
  `staging` is the deployed application commit above. No Production deployment or
  mutation was performed.

This final evidence-only documentation update is retained locally. It changes no
application behavior, so another build, test run or deployment is unnecessary.
