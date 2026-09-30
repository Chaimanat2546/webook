# Booking payment-expiry design

Date: 2026-09-30

## Goal

Allow an operator to set a payment deadline for a `waiting` booking. New
waiting bookings default to a deadline ten minutes after creation. When the
deadline passes, the system cancels the booking without browser activity so
the accommodation dates become available again.

## Scope

- Add an optional `payment_expires_at timestamptz` field to `public.bookings`.
- Expose the deadline only while a booking is in the `waiting` status.
- Default a new waiting booking to ten minutes after the database receives the
  create request when no explicit deadline is supplied.
- Clear the deadline whenever the saved status is not `waiting`.
- Run an expiry sweep every minute through a Cloudflare Cron Trigger.
- Update expired waiting bookings atomically to `cancelled`.

Out of scope: notifications, retrying payment collection, changing the
meaning or database value of existing booking statuses, and backfilling a
deadline for existing waiting bookings.

## Data and database boundary

A new migration will add the nullable timestamp and an index supporting the
expiry predicate. It will replace the existing create/update booking RPCs so
their JSON allowlists accept `payment_expires_at` and enforce these rules:

- Only `waiting` may retain a non-null deadline.
- An explicitly supplied deadline must be a valid future timestamp.
- A new waiting booking without a supplied deadline receives
  `clock_timestamp() + interval '10 minutes'` in the database.
- A non-waiting booking always saves the deadline as null.

A separate service-role-only RPC will cancel bounded batches where
`status = 'waiting'` and `payment_expires_at <= clock_timestamp()`. Its update
predicate repeats those conditions, making duplicate Cron deliveries harmless.
The RPC updates `updated_at` and returns the count of rows cancelled. It never
changes a booking that an operator has already confirmed, manually cancelled,
or given a later deadline.

## Application architecture

`lib/house-bookings.ts` owns the strict timestamp parsing and shared booking
contracts. The house-bookings repository selects/maps the new field and passes
it to the existing create/update RPCs. The service remains the authorization
and orchestration boundary for interactive saves.

The Cloudflare runtime will use an OpenNext custom worker. It forwards normal
HTTP traffic to the generated OpenNext handler and adds a `scheduled` handler.
The scheduled handler calls a server-side expiry repository operation using
only configured server credentials. It is triggered by `* * * * *` in both
production and staging Wrangler configurations. No client receives privileged
Supabase credentials or a scheduler secret.

Cloudflare Cron delivery is at-least-once and can run slightly after the target
minute. The SQL predicate, rather than scheduler deduplication, supplies
idempotency. Timestamps are stored and compared in UTC. The browser converts
the `datetime-local` control to and from Asia/Bangkok for operator input.

## User experience

The existing booking editor remains an embedded booking flow, so the House
Workspace Shell does not apply. When the selected status is `waiting`, it
shows a labelled local date/time control for the payment deadline and concise
help text. A new waiting draft initially displays ten minutes from the current
Bangkok time. Existing waiting bookings display their saved deadline; a null
legacy deadline remains empty.

Changing status away from `waiting` hides the control and removes its value
from the submitted payload. Returning to `waiting` restores a default of ten
minutes from the current time if the draft has no deadline. Server validation
remains authoritative; a stale or already-expired value produces an actionable
Thai validation message.

## Testing and verification

- Unit-test parsing, status-dependent defaults, and clearing behavior.
- Repository/service tests cover field forwarding and expiry RPC authorization.
- Migration tests assert the timestamp, index, RPC grants, and atomic expiry
  predicate.
- UI tests assert the control is only present for waiting bookings and defaults
  to ten minutes.
- Worker tests cover the once-per-minute trigger and call path.
- Run `npm run verify` and `npm run build`; test the scheduled handler locally
  through Wrangler's scheduled-event endpoint. Deploy only to Staging if a
  deployment is required.
