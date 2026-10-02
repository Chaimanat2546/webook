# Scalable Dashboard Reporting Design

## Goal

Make every dashboard summary and list derive from a consistent, database-scoped
booking dataset that supports tens of thousands of records without loading all
rows into Next.js.

## Reporting Rule

- A selected monthly dashboard period uses `bookings.updated_at` as its source
  date range.
- A booking stay-range filter uses `bookings.check_in` for the booking-list
  workflow that exposes it.
- Metrics describe the complete date-scoped dataset before presentation-only
  filters. Status, text search, and amount range limit only list rows, filtered
  totals, and pagination.
- Booking count means all statuses. Sales, sales charts, and sales share use
  only `confirmed`; missing prices are counted separately and excluded from
  money totals.

## Scope

The rule applies to Dashboard overview, booking list/detail context, agency
list/detail, sales cards, status counts, daily confirmed chart, top agencies,
and agency share. House creation history remains independently based on
`listings.created_at` because it is not booking reporting.

## Architecture

Create read-only PostgreSQL RPCs (or one composed RPC with explicit report
mode) that receive only validated date scope, dashboard scope, list filters,
sort, and bounded pagination. PostgreSQL creates a base scoped relation once,
derives aggregates/charts/agency groups before list filters, then derives the
filtered page with `LIMIT/OFFSET`.

The repository calls the RPC and maps typed result contracts. Services retain
authentication/authorization, input validation, and orchestration only; no
unbounded booking dataset crosses into Next.js.

## Database and Security

- Add only new migrations.
- Add indexes for dashboard access patterns, at minimum date-scoped
  `updated_at`, agency plus `updated_at`, and agency plus `check_in`; validate
  final choices with `EXPLAIN (ANALYZE, BUFFERS)` against large fixtures.
- Use fixed `search_path`, bounded page sizes, allowlisted sort/status/date
  modes, no dynamic SQL, and least-privilege RPC grants.
- Server-side role checks remain mandatory. Owners receive only authorized
  property data and cannot access agency reporting. Client code never invokes
  privileged database access.

## Migration Strategy

1. Introduce indexes and read-only RPCs alongside current repository methods.
2. Add repository/service contracts and tests that compare result semantics to
   the agreed rules.
3. Migrate overview, booking, agency, and detail routes to RPC-backed reads.
4. Remove obsolete in-memory aggregate paths only after every route is covered.

## Verification

- Test date boundary, all-status counts, confirmed-only money, missing prices,
  agency isolation, pagination, filter-independent summaries, and owner
  authorization.
- Use multi-ten-thousand-row fixtures or equivalent database data with EXPLAIN
  to prove page-sized transfer and index-backed base scope.
- Run typecheck, lint, tests, build, and migration/RPC contract tests.
