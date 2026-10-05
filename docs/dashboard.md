# Booking dashboard

`/admin/dashboard` is a read-only monthly overview. Desktop navigation exposes Dashboard; on mobile it is in the More sidebar. Existing booking-edit permissions are not expanded.

## Access

The server resolves the authenticated Supabase user and reads `users.role_id,dv_id` by `uid` using the server-only service client. Role 1 sees all houses, agency sales and new-house history. Other users need a positive `dv_id` and see bookings only where both `bookings.houseid` and the joined `listings.property_id` match it. The listing ID must also match. Missing identities or missing/invalid owner IDs are denied; email fallback and URL-supplied role/house IDs never grant access.

Owner responses exclude agency data and new-house history. Customer details are loaded only by the separately authorized deferred endpoint. Internal notes and cost snapshots are selected only for the requested booking detail, never list rows. Customer-name search joins require the customer DV to match the booking house. Every page request rechecks access and is dynamically rendered, without shared report caching.

## Monthly reporting rules

- The month picker defaults to the current Asia/Bangkok month and applies to all report sections. Query dates use an inclusive start and exclusive next-month start at Bangkok midnight.
- Bookings, sales, agency summaries and daily overview points use **updated_at**. Explicit stay ranges use inclusive **check_in** dates for both summaries and lists. Status is current: edits can move a booking between monthly reports; these reports are not an immutable revenue ledger.
- Agency sales count only `confirmed` (ติดจอง). Sum `price_max`, the full stay price, once per booking. Do not multiply by nights, add deposits, include additional charges or treat sales as payments received.
- Missing prices contribute to the booking count and show a missing-price notice; they do not contribute money. Totals use integer satang. Unassigned bookings are shown separately as “ไม่ระบุเอเจนซี่”; inactive agencies retain their sales.
- Booking count includes **all statuses**, including repair, cancelled and unknown legacy values. Status counts partition the full authorized month. Sales and agency sales remain confirmed-only. Status/search/amount filters affect only list rows and filtered pagination; they never reduce date-scoped headline totals. Agency detail fixes the agency scope for counts, status totals and sales, while share uses all authorized agencies in the same date scope as denominator.
- Valid status filters are `all`, `confirmed`, `waiting`, `cancelled`, `repair`, and `unknown`. Search matches house title, formatted DV ID, customer full name and (admin only) agency name, case-insensitively. Admin agency drilldown uses the agency ID (`unassigned` for null); owners ignore agency filters and never receive agency data. Invalid/repeated filters are rejected.
- New houses use `listings.created_at`, including inactive houses. This is creation history of currently existing rows, not a deletion audit log.
- PostgreSQL aggregates the scoped dataset, then returns only the requested page: 9 booking rows or 10 agency rows. No complete booking dataset enters Next.js. Malformed, overflowing or failed RPC results show an error instead of partial totals. House creation history retains its independent repository path.

## Architecture and checks

The page authenticates and validates query parameters, the service authorizes and orchestrates results, and the repository alone issues Supabase reads. `dashboard_report(uuid,jsonb)` derives actor scope again, aggregates in PostgreSQL, and returns a bounded typed result. Only the server service role can execute it; public, anon and authenticated roles cannot. The overview owns its heading/month form. A shared Dashboard task header owns the compact back link, heading and description on every list and detail route; focused Booking, Agency, and New House list components own only their local form and pagination state, while shared list primitives provide the pager. Agency and house pages put search above a single full-width bordered list, without a second card heading. Existing Card, Badge, Input, Button, Pagination and Skeleton primitives provide the responsive UI. Charts use the existing ChartContainer/Recharts client boundary, primary-color series for contrast, while source data remains server-scoped. Share bars use directly labelled percentages.

The overview combines confirmed sales and all-status distribution in one surface. Everyone sees the daily authorized confirmed-booking count chart first, with no explanatory caption. Admin then sees a five-agency sales chart and up to six newest houses. The booking chart retains zero-count days, abbreviates X-axis labels at five-day intervals, and exposes the full date and count through its tooltip. Its link opens the complete confirmed-booking list. The overview cards use fixed minimum heights and context-specific shared icon empty states when their datasets are empty. No entire monthly dataset is sent to a client component for filtering.

## Routes and navigation

The canonical dashboard routes separate each operational task: `/admin/dashboard` for overview, `/admin/dashboard/bookings` for booking reconciliation, `/admin/dashboard/agencies` for agency sales, and `/admin/dashboard/houses` for new-house history. Their details live below their parent list routes. Every list has only its own query parameters: bookings use `month`, `status`, `search`, `sort`, `checkInFrom`, `checkInTo`, `amountFrom`, `amountTo`, and `page`; agencies use `month`, `search`, `agencySort`, and `page`; houses use `month`, `search`, and `page`. Agency details retain parent `month`, `search`, `agencySort`, and `page`, and use `status`, `bookingSearch`, `checkInFrom`, `checkInTo`, `sort`, and `bookingsPage` for their booking workflow. Owners cannot enter agency/history routes, including direct URLs. Missing and foreign canonical details use the same not-found response.

The former `view`, `from`, `housesPage`, and `agenciesPage` URLs are compatibility inputs only: they redirect to the equivalent canonical route, retaining only relevant filters. Dashboard navigation uses normal URL/browser history; it does not retain session-storage return state.

- Bookings: GET search by title, formatted DV, customer or agency name; status/sort/stay-range/amount controls. Agency selection is fixed by the agency detail route. The page is headed “การจอง”; its compact toolbar is followed by a one-line full-month confirmed count and sales amount, then the list. Desktop rows have house/DV, stay dates, admin-only agency, and amount columns; mobile rows preserve the same fields in a compact card. Searching retains the active filters and resets page one.
- Agencies: search by name and sort aggregate rows by sales, booking count, or Thai agency name; `agencySort` is separate from the detail page's booking `sort`. The list table has only agency name, booking count and sales columns; selecting the name opens that agency's details. Detail keeps its all-status booking count and confirmed sales/share above the exact shared booking-list toolbar, table, mobile cards, empty states, pager, and booking links. The route ID is the fixed server-side agency filter; users can use every booking filter, defaulting to `confirmed`. Detail booking rows use `updated_at` for a selected month or `check_in` for an explicit date range, and the summary uses that exact same date scope before status/search/amount filters. `bookingSearch` matches the normal booking-list fields without replacing the agency-list `search`; booking filter changes reset only `bookingsPage`. The former top-house-sales section and section toggle are not part of the agency detail workflow.
- Houses: GET title/DV search and newest-first creation history. Detail includes the creation timestamp in Bangkok, property type, zone, bedroom/bathroom counts, maximum guests, active status, and check-in/out times when present. Its house-workspace link carries the exact detail URL (including list filters/page) as a safe return destination; workspace navigation and saves preserve that destination.
- Booking detail: code, title/DV, current status, check-in/out, date-only nights, amount and creation timestamp. Agency name is admin-only. Repair amount is “—”; missing prices are “ไม่ระบุยอด”.

Lists show the visible range and filtered total, with previous/next pagination. Positive out-of-range pages clamp to the last page, and detail links retain that displayed page. Empty-month and no-filter-match messages are distinct. The monthly headline totals do not change with list filters.

Every dashboard task route uses the same header: a ghost arrow back link above the title and description. Lists return to the overview; details return to their parent list. Back links retain the parent route's allowlisted month/filter/page query; ordinary browser Back uses standard history. Arbitrary return URLs are never accepted. All list filters use a mobile-first three-row layout: full-width search, date and route-specific filters, then a full-width submit action. Agencies and new-house history expose their month input instead of silently preserving a hidden month; on wider screens the controls return to a single horizontal toolbar.

Mobile filters keep the search field and action visible, with booking month and status side-by-side; agency and house lists provide a full-width month control in the same filter row. Agency details also expose month and sort separately before the submit button. House rows place title and DV together with the creation date beneath them on narrow screens, avoiding identifiers splitting beside long names. Booking rows retain status, amount, stay dates and agency. Dashboard detail fields use two columns on mobile (long booking codes span the row) to reduce vertical scrolling without hiding data. No speculative growth percentages, profit, occupancy or month-over-month comparisons are shown.

Tests cover denied/owner/admin access, direct foreign detail URLs, owner payload redaction, confirmed-only totals and missing prices, Bangkok boundaries, 100-agency pagination, DV-grouped contributions, GET filter retention, detail destinations/fields, repair amount, empty states and return-state matching. Browser QA uses an isolated local fixture harness with the real components/services (120 bookings/100 houses), then live Staging; fixtures are not app routes and do not write to DB.

## Staging demo data

Run `node --use-system-ca --env-file=.env.staging scripts/seed-staging-dashboard.mjs`.
The script refuses every Supabase URL except the approved Staging project. It
inserts clearly labelled monthly DEMO houses, agencies, dummy customers and
bookings; reruns reuse matching fixtures without overwriting existing records.
No login accounts or owner permissions are changed.

For the run month, fixtures add four confirmed bookings totalling THB 38,000
(Agency A: 20,000; Agency B: 15,000; unassigned: 3,000), plus one waiting,
one cancelled and one repair entry. Two houses were created in the run month;
one house and a THB 9,000 confirmed booking belong to the previous month.
The waiting fixture expires 24 hours after its initial insertion. Existing
Staging data also contributes to dashboard totals.

For a larger dataset, run `node --use-system-ca --env-file=.env.staging scripts/seed-staging-dashboard-large.mjs`.
This separate insert-only, Staging-guarded batch adds 30 houses, eight agencies,
30 dummy customers and 228 bookings, all labelled `DEMO LARGE`. It checks DV
collisions before writing, resumes partial runs without updating existing rows,
and verifies inserted counts and confirmed sums by reading the database.
The run month has 180 bookings (120 confirmed, THB 1,374,000) and 24 new houses;
the preceding month has 36 bookings (24 confirmed, THB 380,400), and the month
before that has 12 bookings (eight confirmed, THB 134,000). Older bookings only
use houses already created in those months. Current waiting fixtures expire
after 24 hours. No user accounts, access permissions, or existing rows change.

Deployment includes the booking payment-expiry migration
`20260930100000_booking_payment_expiry.sql`. Apply it only to the approved
Staging project before deploying the scheduled Worker. The ambient declaration
in `types/open-next-worker.d.ts` lets a clean Next build type-check before
OpenNext generates its Worker module.

## Scalable reporting deployment and verification

Apply `20261002110000_scalable_dashboard_reporting.sql` before deploying the
application revision that calls the RPC. It creates date/agency/owner indexes
and a read-only, fixed-search-path function. Thai name sorting uses an ICU Thai
collation (the target PostgreSQL installation must support ICU). No browser role gets execution
permission. Migration and app rollout have not been performed by the local
test command.

Run the real database contract suite against disposable local PostgreSQL 17:

```powershell
$env:RUN_DASHBOARD_DB_TESTS='1'
node --import ./tests/register-server-only.mjs --test tests/dashboard-migration.test.ts
Remove-Item Env:RUN_DASHBOARD_DB_TESTS
```

Docker must be running. The suite creates and removes only its own test
container; it never loads environment credentials or contacts Supabase.
It covers Bangkok date boundaries, confirmed-only money and missing prices,
all-status agency counts, owner isolation, filters, pagination, grants and
30,000-row fixtures with EXPLAIN ANALYZE/BUFFERS. Timing is local evidence,
not a production latency guarantee. Regular UI/service unit tests use an
explicit test-only RPC double; database semantics are verified by this suite.

For arbitrary stay ranges, summary/list scope follows the entire range;
daily chart points remain bounded to the selected month (the chart is shown
only on the monthly overview). Agency count means all statuses, not just
confirmed bookings. Sales still mean confirmed full booking prices, not cash
received.
