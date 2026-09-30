# Booking dashboard

`/admin/dashboard` is a read-only monthly overview. Desktop navigation exposes Dashboard; on mobile it is in the More sidebar. Existing booking-edit permissions are not expanded.

## Access

The server resolves the authenticated Supabase user and reads `users.role_id,dv_id` by `uid` using the server-only service client. Role 1 sees all houses, agency sales and new-house history. Other users need a positive `dv_id` and see bookings only where both `bookings.houseid` and the joined `listings.property_id` match it. The listing ID must also match. Missing identities or missing/invalid owner IDs are denied; email fallback and URL-supplied role/house IDs never grant access.

Owner responses exclude agency data and new-house history. Customer details and internal booking notes are never selected. Every page request rechecks access and is dynamically rendered, without shared report caching.

## Monthly reporting rules

- The month picker defaults to the current Asia/Bangkok month and applies to all report sections. Query dates use an inclusive start and exclusive next-month start at Bangkok midnight.
- Bookings and sales use booking **creation date**, not check-in date or the time the status changed. Status is the current status, so historical totals can change if a booking is later cancelled.
- Agency sales count only `confirmed` (ติดจอง). Sum `price_max`, the full stay price, once per booking. Do not multiply by nights, add deposits, include additional charges or treat sales as payments received.
- Missing prices contribute to the booking count and show a missing-price notice; they do not contribute money. Totals use integer satang. Unassigned bookings are shown separately as “ไม่ระบุเอเจนซี่”; inactive agencies retain their sales.
- Booking count includes **all statuses**, including repair, cancelled and unknown legacy values. Status counts partition the full authorized month. Sales and agency sales remain confirmed-only. Status/search/agency filters affect only the detail list, before pagination; they never reduce monthly headline totals.
- Valid status filters are `all`, `confirmed`, `waiting`, `cancelled`, `repair`, and `unknown`. Search matches house title, DV ID or booking code, case-insensitively. Admin agency drilldown uses the agency ID (`unassigned` for null); owners ignore agency filters and never receive agency data. Invalid/repeated filters are rejected.
- New houses use `listings.created_at`, including inactive houses. This is creation history of currently existing rows, not a deletion audit log.
- Full monthly results are explicitly paginated from Supabase before aggregation, including when the configured response cap is below 500. Every complete list has 10 rows per page after filtering. An incomplete or failed read shows an error instead of a partial total.

## Architecture and checks

The page authenticates and validates query parameters, the service scopes and aggregates results, and the repository alone issues Supabase reads. Existing Card, Badge, Input, Button, Pagination and Skeleton primitives provide the responsive UI. Share bars use directly labelled percentages; the previously approved chart files/dependency are preserved but not imported by this layout.

The overview combines confirmed sales and all-status distribution in one surface. Admin sees three top agencies, three newest houses and their full monthly counts; everyone sees three recent authorized bookings. All previews lead to complete lists or selected-item details. No entire monthly dataset is sent to a client component for filtering.

## Views and navigation

`view` is allowlisted to `overview`, `bookings`, `agencies`, `houses`, `booking`, `agency` and `house`. Bare/month-only URLs open the overview; legacy booking-filter URLs open bookings. Owners cannot enter the agency/history views, including direct URLs. Missing and foreign details use the same not-found response.

- Bookings: GET search by title, numeric/formatted DV or code; status selection; admin agency selection through the agency-sales list/detail and a clear-filter action. Searching retains the active status/agency and resets page one.
- Agencies: GET name search, sales-ranked rows, counts and percentages of **full-month** sales. Detail shows confirmed totals/share, up to four house contributions grouped by DV, total contributing houses and a link to all confirmed bookings for that agency.
- Houses: GET title/DV search and newest-first creation history. Detail includes the creation timestamp in Bangkok and a link to the existing house workspace when DV exists.
- Booking detail: code, title/DV, current status, check-in/out, date-only nights, amount and creation timestamp. Agency name is admin-only. Repair amount is “—”; missing prices are “ไม่ระบุยอด”.

Lists show the visible range and filtered total, with previous/next pagination. Positive out-of-range pages clamp to the last page, and detail links retain that displayed page. Empty-month and no-filter-match messages are distinct. The monthly headline totals do not change with list filters.

Back URLs are built only from allowlisted dashboard fields, retaining month/filter/page. `DashboardNavigationContext` is the small client boundary around server-rendered content. A session entry scoped to authenticated UID, authorized DV/admin scope and month records only source/detail URL, stable origin-row DOM ID, scroll offset and pending-return flag. Explicit Back restores scroll/focus only for the matching source and consumes the state once; changing scope/month clears stale entries. Blocked storage and direct links work as ordinary links. Browser Back uses standard history behavior; arbitrary return URLs are never accepted.

Mobile rows wrap names and keep amounts/status visible. No speculative growth percentages, profit, occupancy or month-over-month comparisons are shown.

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
