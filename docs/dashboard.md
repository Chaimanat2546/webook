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
- Total booking count excludes repair but includes cancelled bookings; the detail list shows all statuses.
- New houses use `listings.created_at`, including inactive houses. This is creation history of currently existing rows, not a deletion audit log.
- Full monthly results are explicitly paginated from Supabase before aggregation, including when the configured response cap is below 500. The UI pages booking and house details in groups of 20. An incomplete or failed read shows an error instead of a partial total.

## Architecture and checks

The page authenticates and validates query parameters, the service scopes and aggregates results, and the repository alone issues Supabase reads. Existing Card, Table, Badge, Input, Button and Skeleton components provide the responsive UI. No new dependencies, migrations or deployment are needed to build the feature; normal app deployment is required to publish it.

Tests cover denied/owner/admin access, attempted URL scope escalation, owner payload redaction, confirmed-only totals and missing prices, Bangkok month boundaries, and repository pagination/filtering.
