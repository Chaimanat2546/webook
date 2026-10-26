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

Mobile bells and the sidebar entry navigate to `/admin/notifications`; desktop
bells open the existing shadcn Sheet. Both surfaces reuse the same inbox/cards.
The mobile inbox keeps the existing permission-aware bottom navigation and owns
its 56px back/title header (plus safe-area inset). The desktop Sheet header is
also 56px with a 44px close target. Direct desktop navigation to the inbox URL is
supported. Filters consist only of category chips; no decorative status dot,
filter heading, unread-count chip or read-all button is shown.

Categories are All, New booking, Payment (succeeded/expired), and Cancelled.
`GET /api/notifications` validates `filter=all|booking|payment|cancelled` and JSON
`cursor` parameters containing `createdAt` (UTC, preserving microseconds) and `id`.
Migration `20261026100000_notification_cursor_feed.sql` adds service-role-only
`booking_notification_feed`. Categories apply before a strict `(created_at,id)`
keyset boundary, fetching 20 items plus one lookahead to return `nextCursor`.
The existing recipient/date/id index is reused. Apply this migration before
releasing this UI. The earlier filtered-page RPC remains available for compatibility;
detail queries still use the original RPC. No event, read-state or Push data is migrated.

Scrolling within 200px of the end automatically appends the next batch, with a
keyboard-accessible load-more fallback. Loading and retry are separate from initial
load failures; duplicate IDs are removed and old requests are cancelled on category
change. Exhausted feeds stop requesting. Category changes reset to the newest batch.
Counts in date headings describe all currently loaded items, not the total history.

Polling sends the loaded `head`/`tail` cursor window to revalidate current access,
booking details and read state. Each response contains at most 100 retained rows;
`windowCursor`/`retainedCursor` continue larger validation windows in bounded batches.
The client applies validation only after collecting those batches, retaining rows
appended concurrently. This avoids an unbounded history payload in a single request.
The number of validation requests and browser memory still grow with loaded history.

Polling updates global unread counts and `observedAt` for relative times/Bangkok day
groups without replacing loaded rows. New rows above the head, or newly visible
inside the loaded range, show **มีแจ้งเตือนใหม่**. In an already-open reading session,
global unread items also retain that acceptance prompt across category changes.
Pressing it fetches the newest batch and scrolls to the top only after successful
loading. The accepted cutoff is then read as described below; background polls and
filter changes after the initial opening do not automatically read new arrivals.

Selecting a different category immediately resets the inbox's inner scroll area
to the top, including the desktop Sheet. Selecting the current category again,
loading older rows and background polling preserve the reading position.

Opening the inbox registers a cancellable viewing session and requests a fresh
latest snapshot. Once it successfully loads while visible, the client invokes the
existing authenticated read action with that server `asOf` cutoff. This marks all
currently authorized notifications through the cutoff, including unloaded history
and other categories. The unread badge changes only after acknowledgement and
refresh. Failed loads, hidden views, closed panels and background-only fetching do
not mark read. Failed read actions retain unread state and report an error; reopening
or explicitly accepting again retries. There is no schema/RPC migration for this change.

Sheet/page sessions are distinguished so the Sheet's closing animation or a resize
cannot cancel a newly opened full-page session. Repeated mounting/closing cancels
stale fetches before they can read a later viewing session. Read actions validate an
optional expected actor, matching the account whose snapshot/view initiated them.

Items group by Bangkok calendar day. Compact cards contain an event label, relative
time, house title, DV and a localized stay range; iCal inserts explicitly say they
were imported. Event labels describe the event, independently of the current
booking status (available in details). The whole card links to details, with no
extra footer action, duplicate status text or unread dot. Amounts,
slip verification, pre-expiry reminders and SMS/LINE delivery are not inferred.
Empty, filtered-empty, initial loading and retry states are distinct. Device Push
settings remain available under an expandable section with the original opt-in flow.

Inbox reads use an authenticated, private/no-store endpoint. Visible online tabs
refresh every 30 seconds and on focus/online; hidden and offline tabs do not poll.
The inbox supports cursor loading, retry, individual read state and read-all with a
server-supplied cutoff. A failed initial load leaves the unread count unknown.

Every read and mutation checks recipient ownership and current role/DV. Changing
a DV or removing access revokes old-house items even when the notification was
created earlier. Auth UID comes from the session; email fallback and browser
actor/role/DV values grant no access. Browser roles have no direct table or RPC
permissions. Only server-authenticated, service-role RPCs reach these tables.

Internal notification cards open Dashboard booking details in one click for all
four event types, without a separate notification summary. Cards retain the stable
notification URL so the server can resolve the latest booking update month in
Bangkok and all statuses, avoiding a stale month from a previously loaded feed.
Inbox clicks retain their individual-read fallback if the inbox-wide read has not
completed. Destination pages enforce their own authorization.

`/admin/notifications/[notificationId]` remains the stable entry point for existing
Push payloads and saved links. It checks access again, then a visible client view
marks only that item read and replaces the URL with its destination. GET/prefetch,
hidden/abandoned views and Strict Mode cleanup do not write read state. An already
read item forwards without another write; a read failure still allows navigation.
A manual destination link is available if automatic forwarding cannot run.
iCal cards use this resolver to check booking permission before opening the house
calendar. Missing items and unavailable destinations offer a return to the inbox.

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
Payloads contain a notification UUID, an allowlisted event type and the captured
house DV (`propertyId`) as validated positive bigint decimal text. They contain no
house name, customer, phone or price details. The lock-screen title is **WeBooks**;
the body is the event label followed by ` • DV <propertyId>`, for example
**ชำระเงิน booking สำเร็จ • DV 12345**. This applies to all four event types,
including iCal creation, which uses **มี booking ใหม่** on the lock screen.
The `20261023090000_booking_push_house_id.sql` migration exposes the stored DV in
the service-role-only claim RPC; existing recipient and send-time scope checks
remain in force. No historical notifications or delivery jobs are created.
Older payloads without a DV still show their event label without a DV suffix;
UUID-only payloads show **มี booking ใหม่**. A click can
only focus/open a same-origin notification route; normal authentication follows.
No private notification or booking responses are added to service-worker caches.
Already installed devices need to accept the PWA update before the new title and
event/DV body are available; an older worker retains its previous display format.
Updating does not require disabling/re-enabling Push.
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

1. Apply migrations in order through
   `supabase/migrations/20261023090000_booking_push_house_id.sql`,
   including the original `20261022100000_booking_notifications.sql`, to the
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

Staging deployment dependency maintenance (2026-10-26): the CI audit gate caught
new advisories in the existing transitive HTTP dependencies before migration or
deployment. The Undici override is updated to 7.30.1 and the lockfile resolves
body-parser 2.4.0 (with its required subdependencies), retaining the existing
Wrangler/OpenNext versions and security gate. See the upstream advisories for
[Undici](https://github.com/advisories/GHSA-4qv8-2p9j-2685) and
[body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828).

UI/cursor feed verification (2026-10-26): build and typecheck pass; lint has zero
errors and 11 pre-existing warnings outside this change. The default suite has
1,285 passing tests and four opt-in skips. The disposable PostgreSQL notification
suite separately passes all 21 tests, including timestamp ties, cursor continuation
under new inserts, bounded retained-history payloads, global counts, RPC grants and
DV revocation. Provider tests cover deduplication, append failures, filter/read
races, validation chunks and late commits in empty/exhausted feeds. UI tests pin
Bangkok midnight grouping and a display clock separate from the read-all cutoff.

Browser checks used a local synthetic-data fixture of the actual shared page,
Sheet and card components at 360, 390, 768 and 1280px. Inspected populated, empty,
loading and error states, category selection, read-all feedback and Escape close;
no document horizontal overflow was observed. The fixture stubs routing and Push
transport, so it does not verify authenticated end-to-end navigation, actual
device Push delivery or the complete admin shell on physical phones.

The cursor follow-up additionally exercised the actual NotificationsProvider with
a local HTTP fixture at 390px and 1280px. Mobile auto-scroll appended 20 to 40 rows;
adding a simulated notification kept all 40 rows and scrollY exactly unchanged.
Accepting the new-item button reset to 20 newest rows and scrollY=0. A failed append
and retry produced 40 unique rows. Desktop inner scrolling appended 40 to 60 rows;
switching category reset to 20 matching rows and inner scrollTop=0. This HTTP fixture
does not replace the disposable PostgreSQL tests or live authenticated-device checks.

The compact/read-on-open revision was verified locally at 360, 390 and 1280px
using the actual provider with the synthetic HTTP fixture. Both header heights
measured 56px; an ordinary desktop card measured approximately 88px. Opening a
20-row view changed the fixture's global unread count from 65 to zero, including
unloaded history. A new arrival stayed unread across category changes until
explicit acceptance; the prompt then disappeared after acknowledgement. Desktop
to mobile resizing retained the page session, and infinite scrolling still
appended 20 to 40 rows with no document horizontal overflow observed. Focused
PostgreSQL cutoff/idempotency and permission-revocation tests also passed (2/2).
These local checks preceded deployment; live Staging acceptance is recorded below.

### Live Staging acceptance — 2026-10-26

Created real synthetic bookings through the existing booking service/repository
and approved RPCs on `sxvkhzhqtrpxgzumsswl`, using DEMO DV `99202627` and its existing
synthetic customer. Marker: `TEST-NOTIFY-20261026123236`; creation began at 12:32
Asia/Bangkok. This was not the local UI fixture or disposable PostgreSQL.

| Event | Real booking ID | Verified notification ID |
| --- | --- | --- |
| New booking | 721 | `bd8ce5bf-955d-492c-8eaf-5e3f0fff2a9c` |
| Payment succeeded | 721 | `e2686964-749d-4291-a0bd-d302df4956fc` |
| Manual cancellation | 721 | `6310d574-c371-446e-950d-add414363fa0` |
| Automatic payment expiry | 722 | `6df32bd9-69c4-4445-84ac-7e8399593674` |

The actual notification-feed RPC returned all four event types. Booking 722 also
produced its own new-booking event, giving five inbox items total. Its short payment
deadline was allowed to expire through the deployed Worker's normal cron; no manual
status/provenance substitution was used for the expiry event.

Read-only Staging SQL verification confirmed 10 delivery jobs (five notifications
times two registered devices), all `sent`, with zero pending or failed. The user
explicitly confirmed receiving all four Push event types on the receiving device(s).
Provider acceptance alone was not treated as proof of on-device display.

Both test bookings finished `cancelled`: 721 with `manual`, 722 with
`payment_expired`. Sell/full prices were zero and no active test reservation remains.
The marked cancelled records were retained for inspection; existing business
bookings, user unread states, subscriptions and credentials were not edited by the
test script. Device-by-device observation and browser-form creation were not part
of this service/RPC-based acceptance run.

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
