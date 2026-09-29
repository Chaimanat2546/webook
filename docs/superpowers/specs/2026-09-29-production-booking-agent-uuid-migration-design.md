# Production Booking Agent UUID Migration Design

## Goal

Bring Production booking-agent references to the UUID identity already used by
`public.agents.id` and `public.agent_accounts.agent_id`.  Production must never
change `agents.id` from UUID to bigint or back again.

## Production Source of Truth

Read-only inspection of `https://rqizfiayvcbozlzuvbok.supabase.co` found:

- `public.agents.id` is `uuid not null` with a UUID default.
- `public.agent_accounts.agent_id` is `uuid not null`.
- `public.bookings.agent_id` is nullable `bigint`.
- `public.bookings` has eight rows, one of which has a non-null numeric
  `agent_id`.
- No Agent or Agent Account rows currently exist, so a numeric booking value
  cannot be mapped to an Agent UUID without inventing an identity.
- The booking create and update RPCs currently have no UUID agent contract.

Production does not have migration versions `20260929140000`,
`20260929150000`, or `20260929160000`; Staging has all three.

## Migration History Strategy

`20260929150000` and `20260929160000` were applied only to Staging. Their
original bodies temporarily converted Agent identities to bigint and then back
to UUID.  They must not run on Production.

The approved history rewrite is:

1. Keep `20260929140000_booking_house_information_snapshot.sql` unchanged.
2. Replace the body of version `20260929150000` with a direct Production-safe
   booking-agent UUID migration. It never alters `agents.id` or
   `agent_accounts.agent_id`.
3. Replace the body of version `20260929160000` with a documented no-op. It
   retains the version that Staging has already recorded, but makes no schema
   change when a fresh database or Production applies the sequence.

This is a deliberate exception to the normal immutable-migration rule, limited
to the two versions never applied on Production and explicitly approved for
this correction.

## Direct UUID Migration

The rewritten `20260929150000` migration will:

1. Add a temporary UUID booking-agent column.
2. Set it to `NULL` for every existing numeric `bookings.agent_id`; numeric
   values cannot identify a UUID Agent safely. This includes the one Production
   row currently holding a numeric value.
3. Replace the old bigint column with the UUID column and add a foreign key to
   `public.agents(id)` using `ON DELETE SET NULL`.
4. Leave Agent IDs, Agent Accounts, their constraints, their indexes, and their
   policies unchanged.
5. Replace the booking create/update RPC implementations so an optional
   `p_values.agent_id` is parsed as UUID. Only role `1` may create, clear, or
   change the Agent association; an Agent must be active.
6. Reload the PostgREST schema and preserve service-role-only RPC grants.

The booking snapshot migration continues to run before this migration. The
direct UUID migration therefore includes the final RPC contract for both
snapshot fields and Agent selection.

## Staging Handling

Staging already recorded versions `20260929150000` and `20260929160000`, so it
will not execute their replacement bodies. Its current UUID schema remains in
place. Validation will compare the Staging schema and RPC signatures against
the intended Production end state; no migration-history repair or schema reset
is part of this work.

## Testing and Release Gates

- Update the database migration test to execute the rewritten sequence from a
  Production-shaped baseline.
- Prove `agents.id` and `agent_accounts.agent_id` remain UUID before and after
  the direct migration.
- Prove a legacy numeric booking reference becomes `NULL`, while a role-1 actor
  can set an active UUID Agent through each RPC and a non-admin cannot change
  it.
- Run the focused database tests, the full test suite, typecheck, and lint.
- Before applying Production, re-inspect Production schema, migration history,
  and the count of non-null numeric booking references; summarize the exact
  target URL and data effect, then wait for a fresh confirmation.
