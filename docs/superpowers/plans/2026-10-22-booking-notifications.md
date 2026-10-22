# Booking Notifications Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; independent database and UI tasks may run under superpowers:dispatching-parallel-agents.

**Goal:** Ship durable in-app notifications and opt-in mobile Web Push for admins and DV-scoped owners.
**Architecture:** A booking INSERT trigger creates recipient notifications and per-subscription jobs atomically. Authenticated application services expose the inbox; a leased, bounded Cloudflare cron dispatcher sends encrypted generic Web Push through the approved adapter.
**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgreSQL, existing shadcn Sheet, Workbox, Cloudflare Workers, @block65/webcrypto-web-push.
**Spec:** `docs/superpowers/specs/2026-10-22-booking-notifications-design.md` (user approved; dependency approved; user explicitly requested implementation without further plan approval).

## Global Constraints

- Admin recipients: role_id = 1; owners: positive users.dv_id matching bookings.houseid and listings.property_id; identity always Auth UID.
- INSERT waiting/confirmed only, including iCal; no historical backfill and no customer information in Push.
- Use existing UI primitives and the existing /sw.js scope. No House Workspace Shell for global notifications.
- Claim at most 50 deliveries, send at most 5 concurrently, 10-second request timeout, 3-minute leases, at most 5 attempts, expire after 24 hours.
- Retry 1/2/4/8 minutes, respect Retry-After; 404/410 retire subscriptions; network/429/5xx retry.
- Never expose secrets, subscription endpoints or keys in errors/logs; validate provider endpoints and disallow redirects.
- Preserve other work. No Production deployment. No deployment needed to complete local implementation/tests.

## Shared Interfaces

`BookingNotification`: id, bookingId, propertyId, title, checkIn, checkOut, status, source (internal/ical), createdAt, bookingUpdatedAt, readAt (nullable); all other fields strings.

`NotificationPage`: items, unreadCount, total, page, pageSize, asOf, actorId, pushPublicKey (nullable). GET `/api/notifications?page=1` returns this shape or 401/403/503 with a safe error.

Actions in `app/admin/notifications/actions.ts`: `subscribePush(raw: unknown)`, `unsubscribePush(endpoint: unknown)`, `readNotifications(raw: unknown)` return `{ok:true}` or `{ok:false,message:string}`. Read input is `{id:string}` or `{before:string}`. Browser subscription shape is `{endpoint,keys:{p256dh,auth}}`.

Database RPCs: booking_notification_list(p_actor,p_page,p_id), booking_notification_read(p_actor,p_id,p_before), booking_push_subscribe(p_actor,p_endpoint,p_p256dh,p_auth), booking_push_unsubscribe(p_actor,p_endpoint,p_subscription), booking_push_claim(p_limit), booking_push_authorize(p_id,p_lease), booking_push_complete(p_id,p_lease,p_status,p_error,p_retry_at).

Claim DTO: id, leaseToken, notificationId, subscriptionId, endpoint, keys:{p256dh,auth}, attempt. List RPC returns inbox fields excluding actorId/pushPublicKey. All functions service-role-only.

## Review Focus

- A DV change after event capture must revoke inbox and pending Push access.
- A shared device signing out or changing accounts must not receive the former account's Push.
- A Worker crash or concurrent cron must not strand or concurrently send the same leased job.
- iCal notifications must have an authorized detail view even though Dashboard excludes imported records.
- A missing VAPID configuration must disable subscription without disabling the inbox or booking expiry sweep.

### Task 1: Database events, inbox and delivery leases

**Files:** new `supabase/migrations/20261022100000_booking_notifications.sql`; `tests/booking-notifications-database.test.ts`.
**Produces:** RPC contracts above with durable recipient/event deduplication and current-scope checks.

- [x] Write integration cases for recipients, rollback, read ownership/cutoff, revoked DV, lease races, expiry and subscription transfer.
- [x] Run against disposable local PostgreSQL. Initial missing-feature RED was delayed by Docker startup; later permission/cleanup/authorization regressions were observed RED before fixes (recorded in verification report).
- [x] Implement schema, deny-by-default RLS, scoped RPCs, INSERT trigger, leased queue and token-guarded acknowledgement.
- [x] Run the database integration tests; no remote database mutation.

### Task 2: Server contracts, services and Web Push dispatcher

**Files:** `lib/booking-notifications.ts`; `server/auth/notifications.ts`; notification repository/service; `server/notifications/web-push.ts`; `app/api/notifications/route.ts`; notification actions/detail route; `worker.ts`; relevant tests.
**Consumes:** database RPCs. **Produces:** shared HTTP/action DTOs for Task 3 and safe Worker dispatch.

- [x] Write validation, endpoint, payload, encryption/transport, retry and concurrency tests, including failing-before-fix regression cases.
- [x] Implement typed validation, authenticated services, repository mapping and generic-error boundaries.
- [x] Implement approved encrypted Web Push adapter, bounded dispatcher and independent cron outcomes.
- [x] Add explicit mutation actions, no-store inbox endpoint and authorized notification detail route.
- [x] Run targeted tests and typecheck; confirm no privileged input is accepted from browser.

### Task 3: Inbox UI and Service Worker interaction

**Files:** `components/admin/notifications/*`; shared headers/sidebar; `worker/pwa-sw.js`; UI/SW tests.
**Consumes:** shared DTOs and actions above. **Produces:** responsive bell/Sheet, opt-in per-device Push and safe click routing.

- [x] Write runtime tests for safe SW payload/click routing and subscription lifecycle.
- [x] Reuse existing Sheet/Button/Badge/Skeleton; implement paginated inbox, cutoff read-all, failure/empty/loading states and visibility-aware polling.
- [x] Add permission/capability state and iOS Home Screen guidance; cancel/rebind browser subscriptions on account switch and sign-out.
- [x] Add validated push/click listeners to existing SW; regenerate via build:pwa.
- [x] Attempt viewport verification: no enabled CUA browser surfaces. Record viewport and real-phone delivery as unverified; runtime/SSR checks pass.

### Task 4: Integration, documentation and review

**Files:** `docs/booking-notifications.md`, `docs/pwa.md`, tests and fixes to the preceding files.

- [x] Run typecheck, lint, full tests and build; investigate any failure before fixing.
- [x] Request an independent code review covering the Review Focus items; fix material findings with regression tests.
- [x] Document migration order, VAPID configuration, operational states, delivery limitations and real-device acceptance steps.
- [x] Record verified results and checks requiring a phone/environment in `docs/superpowers/reports/2026-10-22-booking-notifications-verification.md`. No deployment or real delivery claim.
