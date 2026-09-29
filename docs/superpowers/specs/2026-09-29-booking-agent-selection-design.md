# Booking Agent Selection Design

## Goal

Allow only a WeBooks Administrator to select an active Agent in the booking
editor. The selected numeric Agent ID is saved on `public.bookings.agent_id`
for both new and existing bookings.

## Scope and Constraints

- This change applies to the booking dialog only; it is not a house workspace
  page, so the House Workspace Shell does not apply.
- Production is the schema source of truth. The schema was inspected on
  2026-09-29 before this design was written.
- No existing migration is edited. The implementation creates one new
  migration.
- Deployment and migration application target Staging only unless the user
  directly asks for Production deployment. Before any migration is applied,
  the observed Production schema and planned change are presented for user
  confirmation.
- The Agent select is shown only when the signed-in user has `role_id = 1`.
  The server and database enforce the same restriction; the client visibility
  is not an authorization boundary.
- The select is placed above the customer field, matching the supplied UI
  reference. It includes an explicit “not specified” option and keeps an
  inactive previously selected Agent visible for historical bookings.

## Production Schema Observed

At design time, Production has:

- `public.agents.id uuid primary key default uuid_generate_v4()` with required
  `name` and `video_url`, plus `is_active`.
- `public.agent_accounts.agent_id uuid not null`, referencing
  `public.agents(id)` with `on delete cascade`; its unique constraint includes
  `agent_id`, `bank_id`, and `account_number`.
- `public.bookings.agent_id bigint nullable`, with no foreign key to
  `agents`.
- Booking RPCs `admin_create_house_booking(bigint, uuid, uuid, jsonb)` and
  `admin_update_house_booking(bigint, bigint, timestamptz, uuid, jsonb)`;
  their JSON allowlists do not include `agent_id`.

This mismatch is why the selection was not rendered in the deployed booking
editor: a UI-only selector could not persist a valid relationship.

## Chosen Design

The new migration changes the Agent identity domain from UUID to generated
bigint, preserves every existing Agent row and every `agent_accounts`
relationship, and retains booking history. It does so in a transaction by
assigning a generated bigint to each Agent, replacing the dependent
`agent_accounts.agent_id` and its constraints/indexes, then recreating the
Agent primary key as bigint. `bookings.agent_id` already has the target bigint
type, so the migration adds a foreign key to `agents(id)` using `on delete set
null`; booking history remains valid if an Agent is removed.

The migration also replaces the two exact Production booking RPC signatures.
Both add `agent_id` to their strict JSON allowlists. They accept either null or
an active numeric Agent. The database checks the acting user’s `public.users`
row has `role_id = 1` whenever a non-null Agent is supplied or changed. The
create RPC saves the selected ID; the update RPC preserves the stored value for
non-administrators and allows an Administrator to set or clear it. Existing
date, overlap, customer, auditing, idempotency, and booking-snapshot behavior
remain unchanged.

The application introduces a small shared Agent contract and a repository
query that returns only active Agents ordered by name, plus the current Agent
when needed for an existing record. A server action loads choices only for an
Administrator. Service-layer validation rejects unknown or inactive choices
before calling the repository, while the RPC repeats the authorization and
active-Agent checks. `BookingCreate` and `BookingUpdate` carry nullable
`agent_id`; the repository includes it in create and update RPC payloads.

The booking editor fetches the authorized choices when it opens and renders a
native select immediately above the customer picker. For other roles it
neither renders nor sends an Agent choice. The booking detail keeps displaying
the saved numeric ID as historical data; resolving a display name outside the
editor is intentionally out of scope.

## Failure Handling

- A non-administrator cannot load options or alter an Agent ID, even if they
  forge a request.
- Null remains a valid “not specified” choice.
- An inactive or nonexistent ID fails with the existing safe booking error,
  rather than writing arbitrary data.
- An existing booking that references an inactive Agent remains editable; its
  historic selection is shown but no longer appears among selectable active
  options.
- Primary-key conversion either commits all relationship rewrites together or
  leaves the original UUID schema unchanged.

## Tests and Verification

- Add unit tests for numeric Agent parsing, Administrator-only choices, and
  payload forwarding on booking create/update.
- Extend migration/integration coverage to prove UUID Agent and dependent
  account data convert to numeric IDs, booking foreign-key behavior works, and
  the RPC accepts an active Agent but rejects an inactive ID or unauthorized
  change.
- Add UI coverage for the administrator-only selector position and its null
  option.
- Run typecheck, lint, focused tests, full tests, and the opt-in booking
  database integration tests before completion.
