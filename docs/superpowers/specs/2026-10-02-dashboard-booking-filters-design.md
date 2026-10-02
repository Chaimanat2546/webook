# Dashboard Booking Filters Design

Date: 2026-10-02

## Goal

Make `/admin/dashboard/bookings` a focused operational list for finding and
reviewing bookings. The list keeps its existing nine-items-per-page behavior
and its separate mobile cards, while its filters match the supplied desktop
and mobile reference.

## Scope

In scope:

- Search bookings by house title, DV property ID, customer name, and agency
  name.
- Filter bookings by the month containing `bookings.updated_at`.
- Use the existing `ThaiMonthPicker`; no date-range picker is introduced.
- Default the selected month to the current Bangkok month.
- Default the status to `confirmed` (ติดจอง).
- Support sorting by latest check-in, highest price, lowest price, and most
  recently updated booking. Most recently updated is the default.
- Render the controls as a search row plus compact filter controls on desktop
  and mobile. Do not render an agency dropdown.

Out of scope:

- Date-range filtering.
- Any filter or behavior change to dashboard overview, agency, or house
  modules.
- A new generic picker library or dependency.

## Query Contract

The booking route owns only these parameters:

- `month`: `YYYY-MM`, interpreted as the Bangkok calendar month for
  `updated_at` filtering.
- `search`: free text, maximum 200 characters.
- `status`: a supported booking status; omitted means `confirmed`.
- `sort`: one of `checkin-desc`, `price-desc`, `price-asc`, or
  `updated-desc`; omitted means `updated-desc`.
- `page`: positive page number.

Changing month, search, status, or sort resets `page` to `1`. Booking detail
links and their return link retain all of these values. The legacy `agency`
parameter is rejected for this route and is never rendered as a control.

## Data and Authorization

The repository reads bookings whose `updated_at` is within the selected
Bangkok month. It joins only the minimum customer-name fields needed for the
search and does not expose those fields in the list DTO. It preserves the
existing owner scope by requiring both booking house ID and joined listing
property ID to equal the owner property ID. Administrator reads may include
agency data; owner reads do not gain agency or customer data outside their
already authorized booking rows.

The service applies search, status filtering, ordering, and nine-item
pagination after it has verified the scoped source rows. Search compares
normalized Thai text across the four approved fields. Null customers and
agencies simply do not match those particular terms.

## UI

The existing `ThaiMonthPicker` is used as the month filter and navigates while
preserving the other booking-query parameters. Desktop presents a full-width
search field followed by month, status, and sort controls. Mobile keeps the
search field prominent and uses the same three controls in a compact,
horizontally scrollable row. The booking page keeps its `max-w-7xl` layout;
the desktop table and mobile card list remain separate presentations.

No agency selector, clear-filter control, date range, or additional filter is
added.

## Error Handling

Malformed or foreign query parameters resolve to the existing not-found
boundary. Missing joined customer or agency records are treated as absent
search fields rather than errors. Repository failures retain the existing
generic dashboard-unavailable handling and do not expose database details.

## Verification

- Route-parser tests cover defaults, allowlisted parameters, pagination reset,
  and rejection of agency parameters.
- Service tests cover updated-month filtering, all search fields, each sort,
  default confirmed status, and scoped owner results.
- Repository tests confirm the `updated_at` interval and minimal authorized
  joins.
- UI tests cover the Thai month picker, filter controls, absent agency
  dropdown, and mobile/desktop control layouts.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
