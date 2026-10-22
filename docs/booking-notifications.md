# Booking notifications

New `waiting` and `confirmed` booking inserts create a durable inbox item for
every linked Auth user with role 1 and each non-admin whose positive DV matches
both the booking house and its listing. The database captures recipients and
delivery jobs in the booking transaction. The creator receives a notification
when eligible. Existing bookings are not backfilled; ordinary edits and repair
inserts do not notify.

Lifecycle status changes also create a separate inbox item and Push job per
eligible current recipient:

- `waiting` → `confirmed` for an internal booking: **ชำระเงิน booking สำเร็จ**.
  The user explicitly defines this operator status change as payment confirmation;
  no payment gateway or bank reconciliation is implied. A new confirmed INSERT
  sends only the new-booking event, not an additional payment event.
- `waiting`/`confirmed` → `cancelled`: **ยกเลิก booking** for manual cancellation.
- The payment-expiry sweep cancelling a due waiting booking:
  **booking หมดเวลาชำระเงิน**, without a second generic cancellation event.

`bookings.cancellation_reason` records sweep provenance, distinguishing a manual
cancellation even after its deadline. Leaving cancelled clears that provenance.
The existing client mutation allowlist does not accept this field.
`booking_notifications.event_type` preserves the event's meaning independently
of later booking changes; the displayed badge explicitly shows the current status.
The new migration is `20261022150000_booking_lifecycle_notifications.sql`.

Same-status saves and repeated sweeps do not create duplicate events. A later real
status transition is a new event. Event creation, recipients and device jobs commit
or roll back together. Devices enabled after an earlier event receive only future
event Push jobs; existing inbox history remains accessible. Repair cancellation
does not notify, and iCal status changes never imply payment confirmation. An iCal
row changing from confirmed to cancelled does notify; deleting a row is not a
cancellation event and retains the existing cascading-history deletion behavior.

iCal INSERTs also notify, including an initial import of several events.
Subsequent UID updates do not notify again. Imported items say they were imported;
their notification timestamp is not represented as the time of booking.

## Inbox and permissions

Desktop/mobile bells and a shared sidebar entry open the existing shadcn Sheet.
Inbox reads use an authenticated, private/no-store endpoint. Visible online tabs
refresh every 30 seconds and on focus/online; hidden and offline tabs do not poll.
The inbox supports pagination, retry, individual read state and read-all with a
server-supplied cutoff. A failed initial load leaves the unread count unknown.

Every read and mutation checks recipient ownership and current role/DV. Changing
a DV or removing access revokes old-house items even when the notification was
created earlier. Auth UID comes from the session; email fallback and browser
actor/role/DV values grant no access. Browser roles have no direct table or RPC
permissions. Only server-authenticated, service-role RPCs reach these tables.

`/admin/notifications/[notificationId]` checks access again and shows a safe
summary. GET/prefetch does not mark an item read. Users can explicitly mark it
read; inbox clicks perform a read action before navigation. Internal bookings
link to Dashboard details using the current booking update month and all statuses.
iCal items stay outside Dashboard reports and expose a calendar link only to
booking operators; an owner can still read the authorized notification summary.

## Per-device Push

Push is opt-in through **เปิดแจ้งเตือนบนอุปกรณ์นี้**. Permission is requested only
after this button is pressed. One account may subscribe several devices, and
disabling one leaves the others enabled. Unsupported or denied devices can use
the inbox. On iPhone/iPad, use iOS/iPadOS 16.4+ and add WeBooks to the Home Screen,
then open that installed web app before enabling Push.

The existing `/sw.js` registration handles Push; `worker/pwa-sw.js` is its source.
After opting in once, the root device guard synchronizes the browser's current
subscription with the authenticated server on app load, focus, foreground resume, reconnect and
Service Worker activation. This repairs missing server rows and renewed endpoints
without a Push off/on cycle. With prior account-bound consent and permission still
granted, it also attempts to restore a missing browser subscription; this automatic
path never requests notification permission. Failed synchronization can also be
retried through the existing settings button without disabling Push.

The device settings report enabled only after server acknowledgment. Transient
failures keep prior consent and retry on focus/online. Explicit disable/logout
clear consent before browser cleanup; device operations use a shared Web Lock
(or an in-context queue where unavailable) so a queued repair cannot re-enable an
opted-out device. Mutation locks remain held until the actual operation settles,
even if the UI stops waiting. A failed browser retirement remains visibly
unconfirmed, and opt-out stays available during synchronization failures.
Configuration retry reloads the inbox configuration too. Every automatic registration
includes its expected actor, which the server checks against its current verified
session before writing. Other devices are not removed during repair, and an
unchanged binding cookie is not rewritten on every sync.

If a network mutation stalls, opt-out starts local browser retirement immediately
and queues server cleanup behind the existing mutation. A late subscription is
retired when consent has been revoked. The UI and logout stop waiting after a
bounded deadline, while queued cleanup continues; incomplete cleanup is reported.

Run `npm run build:pwa` after source changes rather than editing `public/sw.js`.
Service-worker registration runs in production builds; use `npm run build` and
`npm start` for local worker checks. Normal development mode still supports the
inbox. Mobile acceptance needs an HTTPS origin.
Payloads contain only a notification UUID and an allowlisted event type. Older
UUID-only payloads still display the new-booking message. The lock screen displays
a generic event-specific WeBooks message without house, customer, phone or price details. A click can
only focus/open a same-origin notification route; normal authentication follows.
No private notification or booking responses are added to service-worker caches.
Already installed devices need to accept the PWA update before event-specific
lock-screen titles are available; an older worker retains its generic new-booking
title. Updating does not require disabling/re-enabling Push.
Notification clicks call `clients.openWindow` directly for the fixed same-origin
detail route, allowing the platform to launch the installed web app. They do not
reuse an arbitrary same-origin browser tab, which could bring Safari forward on
iPhone. After a click-handler update, open the installed app and accept its update
prompt before testing a newly sent notification. Physical-device standalone
launch is checked separately from successful Push delivery and detail access.

The admin sign-out flow removes the server binding and unsubscribes the browser,
with a per-device HttpOnly cookie as server-side fallback. Successful account
switches retire the prior authenticated user's cookie binding. A root PWA session
guard also retires old browser subscriptions on login, logout and recovery,
including pages with no module permissions. Reset-password logout performs device
cleanup too. Partial cleanup is not reported as successful disablement.

## Setup and rollout

1. Apply `supabase/migrations/20261022100000_booking_notifications.sql` to the
   intended database before running this application revision.
2. Generate a separate VAPID pair per environment. For example:

   ```powershell
   node scripts/generate-vapid-keys.mjs --out .env.push.staging --subject mailto:ops@example.com
   ```

   Replace the example address with an operations contact. The script writes a
   new private file, refuses overwrite and never prints either key. `.env*` files
   are ignored by Git. Keep the file restricted on Windows as well as other OSes.
3. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as server
   environment values/Worker secrets. Do not put the private key in
   `NEXT_PUBLIC_*`, Wrangler vars, source code, logs or documentation. Runtime
   Worker bindings take precedence over local Node environment values. Use the
   same public key for browser subscription and server sending; keep it stable
   across routine deployments. Key rotation requires devices to unsubscribe
   and subscribe again.
4. Only Staging deployment is permitted without the separate explicit Production
   instructions required by AGENTS.md. Use `npm run deploy:cf:staging` and verify
   its target configuration. This implementation does not automatically apply
   migrations, generate environment credentials or deploy.
5. On each test device, sign in, enable Push, create a future booking for that DV,
   and verify inbox, notification click, read state and device sign-out. Use
   synthetic booking/customer data for acceptance checks.

The Staging CI/CD workflow reads the three VAPID values from GitHub Environment
`staging` only. After validation and migration, it writes an ignored, temporary
`.env.staging-worker-secrets.json`; `npm run deploy:cf:staging` passes this as the
Worker's runtime secrets file. VAPID values are absent from the build step's
environment and are not printed or uploaded as artifacts. Wrangler adds these
secrets while retaining omitted existing secrets. Cleanup runs even on failure.
The legacy ignored `.env.ical-staging` path remains supported and is merged when
present. CI also enables all notification PostgreSQL integration tests and rejects
skipped tests through its existing strict gate.

If VAPID is missing or malformed, the inbox works and Push opt-in is disabled.
The cron does not claim jobs or consume attempts without valid configuration.
The package is `@block65/webcrypto-web-push` 2.x, which uses RFC8291 aes128gcm and
VAPID and is compatible with Cloudflare Workers. The application validates known
Chrome, Firefox, Apple and Windows Push provider endpoints and disallows redirects.
The transport uses Workers-compatible `redirect: "manual"` and treats every 3xx
as a permanent rejection, without sending the encrypted body or VAPID headers to
the redirect destination. A native Workers runtime regression test covers this.

## Delivery behavior and operations

The existing every-minute Worker cron independently runs payment expiry and Push
dispatch. Either task is attempted even if the other fails; cron errors use a
generic message without database/provider details. Push may wait about a minute
plus provider/network scheduling. It is not an exact-time delivery guarantee.

The service claims up to 50 jobs using row locks and 3-minute leases, sends up to
5 concurrently, and checks current scope, subscription binding, lease and age
again immediately before each send. Each network request has a 10-second timeout.
A provider error cannot roll back a saved booking or remove its inbox item.

Network/429/5xx failures retry up to 5 total attempts, after 1/2/4/8 minutes and
no earlier than a valid Retry-After. Jobs older than 24 hours stop. HTTP404/410
retire the subscription and its jobs. Other permanent provider errors stop that
delivery without deleting the subscription; inspect VAPID/configuration for
401/403 failures. Expired Worker leases can be reclaimed after a crash.

The database tables are `booking_notifications`, `push_subscriptions` and
`booking_push_deliveries`. Failed deliveries retain a safe machine error code,
attempt count and timestamps for server-side diagnosis. Maintenance cleanup is
bounded. Do not expose subscription endpoints, keys or raw provider responses in
logs or dashboards. Notification history currently has no automatic retention
deletion; expired/failed delivery records remain until explicitly maintained.

Sending is at-least-once. A crash after provider acceptance but before DB
acknowledgment may repeat a submission. The notification UUID is its display tag,
so repeated submissions replace the displayed item where the browser supports it.
Provider acceptance is not a read receipt or proof that the phone displayed it.

## Verification

Run the normal `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
The default suite includes adapter encryption/decryption, retry classifications,
bounded dispatcher behavior, post-claim revocation, account switching, browser
subscription cleanup, inbox states and bundled service-worker push/click handlers.

Run real SQL integration against disposable PostgreSQL, never configured project
credentials:

```powershell
$env:RUN_NOTIFICATION_DB_TESTS = '1'
node --import ./tests/register-server-only.mjs --test tests/booking-notifications-database.test.ts
Remove-Item Env:RUN_NOTIFICATION_DB_TESTS
```

Docker uses a task-specific PostgreSQL17 container without a network. Alternatively
`BOOKING_NOTIFICATION_PG_BIN` may point to an existing local PostgreSQL bin
directory; the fixture creates and cleans a temporary cluster bound to localhost.
Tests cover recipients, iCal, rollback, no duplicate events, read cutoff,
role/DV revocation, table/RPC permissions, shared-device transfer, concurrent
claims, stale leases, bounded cleanup, exhausted/old jobs and expired subscriptions.

Mocked HTTP and browser-runtime tests do not verify actual Android/iPhone Push
delivery or viewport layout. Record actual device/browser checks separately.
