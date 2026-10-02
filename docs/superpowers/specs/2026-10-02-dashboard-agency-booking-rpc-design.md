# Scalable Agency Booking Dashboard RPC Design

## Goal

Make the agency detail dashboard support tens of thousands of bookings without
loading every row into Next.js, while ensuring summary cards and the booking
list use the same date-scoped source data.

## RPC Contract

Add `public.dashboard_agency_bookings` in a new migration. It accepts a
validated agency ID, date mode and range, optional list-only status/search/
amount filters, sort, and page. It returns one JSON result containing:

1. A summary for every agency booking in the date scope.
2. The all-agency confirmed sales total for share calculation.
3. The filtered list total and one paginated page of booking rows.

The repository calls the RPC once. The service retains server authorization,
input validation, and response mapping; it never receives the complete booking
set.

## Data Semantics

- A selected month scopes the source by `updated_at`; an explicit stay range
  scopes it by `check_in`.
- Summary cards always aggregate the entire date-scoped agency dataset, before
  status, text, and amount filters.
- The summary count is every status. Sales/share sum only `confirmed`; missing
  prices remain countable and are reported separately.
- Filters affect only rows, filtered total, and pagination.
- Share is agency confirmed sales divided by confirmed sales for all agencies
  using that identical date scope.

## Performance and Security

- Add indexes matching `(agent_id, updated_at)` and `(agent_id, check_in)`,
  plus a confirmed-sales aggregate index where justified by `EXPLAIN`.
- Apply filtering, sorting, and `LIMIT/OFFSET` inside PostgreSQL; return only
  the requested page.
- The server resolves the actor scope before RPC execution. Owners cannot use
  agency dashboard paths. The RPC validates bounded page/page-size, date mode,
  status, sort, amount bounds, and search length; no dynamic SQL is used.
- Use a fixed `search_path`, revoke default public execution where needed, and
  grant only the application role required by existing repository access.

## Verification

- SQL/RPC tests cover source/date semantics, summary independence from list
  filters, agency isolation, missing prices, and status totals.
- Repository/service tests assert one RPC result maps to the current UI
  contracts without full-row reads.
- Seed a large fixture and use `EXPLAIN (ANALYZE, BUFFERS)` to verify the
  index-backed scoped query and bounded page output.
