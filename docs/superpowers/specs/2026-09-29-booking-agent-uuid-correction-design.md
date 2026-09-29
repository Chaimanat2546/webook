# Booking Agent UUID Correction Design

## Goal

Keep `public.agents.id` and `public.agent_accounts.agent_id` as UUID values,
matching Production, while allowing only a WeBooks Administrator to select an
active Agent for a booking.

## Context

Production was inspected on 2026-09-29 and has UUID Agent IDs, UUID
agent-account references, and a nullable bigint `bookings.agent_id` without a
foreign key. The already-applied Staging migration
`20260929150000_booking_agent_numeric_id.sql` incorrectly converted the Agent
identity to bigint. Existing migration files are immutable, so this design
uses a forward correction only. It supersedes the numeric-ID portion of
`2026-09-29-booking-agent-selection-design.md`.

## Chosen Design

A new forward migration runs after the numeric migration. It creates a
temporary bigint-to-UUID map for the current Agent rows, converts Agent and
agent-account identifiers back to UUID, and changes `bookings.agent_id` to a
nullable UUID mapped through the same table. It recreates the booking foreign
key as `on delete set null` and preserves Staging selections made after the
numeric migration. The original Production bigint booking reference cannot be
mapped to a UUID identity, so it remains null after the migration sequence.

The migration replaces the two exact booking RPC signatures without changing
their arguments. Their optional `agent_id` JSON field accepts a UUID string.
An explicit assignment or change requires `public.users.role_id = 1`, and a
non-null selected Agent must be active. Omitting `agent_id` during an update
preserves the existing value for non-administrators.

Application types, validation, repository, service, and editor use UUID
Agent IDs represented as strings. The native **เอเจนซี่** selector remains
above the customer selector and is visible only to role-1 users. It lists
active Agents plus the null choice; an inactive historic selection remains
readable in the editor.

## Constraints

- Production schema is the sole database source of truth; Production is never
  changed by this work.
- Do not alter an existing migration. Apply only forward migrations.
- Before applying the correction on Staging, inspect Production again,
  summarize its observed schema and await explicit confirmation.
- Staging uses project `sxvkhzhqtrpxgzumsswl`; deployment requires separate
  explicit authorization.
- The booking dialog is not a house workspace page, so the House Workspace
  Shell does not apply.

## Failure Handling and Tests

- A forged non-administrator UUID assignment is rejected in the service and
  RPC; inactive and malformed UUIDs are rejected safely.
- Migration integration tests cover numeric-to-UUID Agent/account conversion,
  booking selection preservation, the nulling of unmappable legacy booking
  numbers, foreign-key behavior, and RPC authorization.
- Unit/UI tests cover UUID parsing, role-1-only choice loading and selector
  placement. Run typecheck, lint, full tests, and opt-in database tests.
