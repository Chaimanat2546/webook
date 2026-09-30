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
- Full monthly results are explicitly paginated from Supabase before aggregation, including when the configured response cap is below 500. The UI pages booking and house details in groups of 20. An incomplete or failed read shows an error instead of a partial total.

## Architecture and checks

The page authenticates and validates query parameters, the service scopes and aggregates results, and the repository alone issues Supabase reads. Existing Card, Table, Badge, Input, Button, Alert and Skeleton components provide the responsive UI. The shadcn Chart component uses Recharts (approved dependency); its generated import is adapted to the existing `lib/utils` utility.

The compact summary leads with confirmed sales and all-status booking count. Admin agency rows show names, sales, counts and shares directly, with name search and five-row pagination instead of a duplicated chart/table. Expanding an agency exposes a link to its confirmed bookings in the same month. Only aggregated agency data crosses the client boundary. Owners never receive it.

Booking status counts remain visible; the complete paginated list opens on demand or when a status/search/agency filter is active. Each booking keeps house, stay dates, status and amount visible; a native disclosure reveals code, DV and creation time. New-house history has its own disclosure and pagination. Disclosures retain the current page without navigation; URL filters persist across booking/house pagination. Monetary values reflow on mobile rather than requiring horizontal table scrolling. No speculative growth percentages, profit, occupancy or month-over-month comparisons are shown.

Tests cover denied/owner/admin access, attempted URL scope escalation, owner payload redaction, confirmed-only totals and missing prices, Bangkok month boundaries, and repository pagination/filtering.

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
