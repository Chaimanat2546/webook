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
