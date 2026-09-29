# Booking House Information Snapshot Design

## Goal

Allow each booking to retain editable accommodation information without
changing its source listing or house. Production is the sole schema source of
truth.

## Production Contract

- `public.bookings` already has nullable `insurance numeric` and
  `extra_person numeric`, both with a `0.00` default.
- `public.bookings` does not have `checkin_time` or `checkout_time`.
- `public.listings` has `insurance_fee`, `extra_beds`, `checkin_time`, and
  `checkout_time`. These are creation-time source values only.
- Booking create and update RPCs currently do not accept the four booking
  house-information values.

## Data Model

Create one new forward migration that:

1. Adds nullable `checkin_time time without time zone` and `checkout_time
   time without time zone` to `public.bookings`.
2. Replaces `admin_create_house_booking` and `admin_update_house_booking` so
   their JSON contracts accept `insurance`, `extra_person`, `checkin_time`,
   and `checkout_time`, validate them, and persist only booking columns.
3. Retains the existing RPC signature, authorization, optimistic-concurrency,
   booking overlap, audit-log, and grant behavior.

No migration changes `listings`, `house`, `agents`, or `agent_accounts`.
No old migration is edited.

## Application Flow

For a new booking, the service reads the selected listing once and maps:

| Listing source | Booking snapshot |
| --- | --- |
| `insurance_fee` | `insurance` |
| `extra_beds` | `extra_person` |
| `checkin_time` | `checkin_time` |
| `checkout_time` | `checkout_time` |

An explicit form value overrides its creation default. For an existing
booking, the UI reads and writes only booking values; it does not fetch a
listing for fallback data.

## UI and Boundaries

The booking “ข้อมูลที่พัก” form displays editable insurance, extra-person,
check-in time, and check-out time values. Its wording and types use booking
field names only. Listing field names stay isolated inside the creation-time
mapping repository/service boundary.

The work updates the booking TypeScript contracts, validation, repositories,
services, server actions, RPC payloads, tests, and relevant documentation.
All booking references to `insurance_fee` and `extra_beds` are removed.

## Error Handling and Validation

- Monetary values are nullable non-negative numeric amounts with at most two
  decimal places.
- Times are nullable `HH:mm` or `HH:mm:ss` values.
- Invalid payload keys or values return the existing `booking_invalid_input`
  error.
- Existing stale-write and authorization failures are preserved.

## Testing and Verification

Tests cover listing-to-booking snapshot mapping, explicit booking overrides,
existing-booking isolation from listing changes, field-name validation, RPC
payload contracts, and the UI fields. Before completion, run typecheck, lint,
the relevant tests, and the full test suite.

## Deployment Gate

Before any migration apply or Staging deploy, re-check and summarize the
Production schema and wait for explicit confirmation. Staging deployment uses
only `npm run deploy:cf:staging` after verification.
