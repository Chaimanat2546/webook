# Agency Detail Booking Workflow Design

## Goal

Keep `/admin/dashboard/agencies/[agencyId]` as the agency detail route, retain
its agency sales summary above the list, and make the booking workflow below
it use the same controls, table, cards, empty states, pagination, and booking
links as `/admin/dashboard/bookings`.

## User Intent and Success Criteria

- The agency is a server-controlled filter derived only from `[agencyId]`.
- Users can use every booking-list filter: month, status, text search,
  check-in range, sort, and pagination.
- The default booking status remains `confirmed`.
- The visible booking list is equivalent to the ordinary booking list after
  applying the fixed agency filter.
- The existing agency summary card remains above the booking workflow. Its
  figures remain confirmed sales for the selected month and do not vary with
  the booking-list filters.
- No route changes or new dependencies are introduced.

## Scope

### Included

- Reuse the booking list presentation and its mobile card/desktop table
  behavior on the agency detail route.
- Reuse the booking filter controls, including desktop Popover and mobile
  Sheet layouts for advanced filters.
- Support the established booking filters under the agency detail route.
- Preserve return-state query values for the parent agency list.
- Validate all detail query values and keep agency scoping server-side.
- Add focused route, service, and UI tests and update dashboard documentation.

### Excluded

- Changing the canonical routes.
- Exposing an editable agency selector in the booking toolbar.
- Changing how the agency list aggregates sales.
- Changing booking permissions, RLS, or database schema.
- Making the currently visual-only amount inputs behave differently from the
  existing booking list.

## Query Model

The agency detail needs both parent-list state and booking-list state. Their
overlapping names remain deliberately separate:

| Purpose | Parameters |
| --- | --- |
| Parent agency list return state | `month`, `search`, `agencySort`, `page` |
| Agency detail booking workflow | `status`, `bookingSearch`, `checkInFrom`, `checkInTo`, `sort`, `bookingsPage` |

`bookingSearch` and `bookingsPage` avoid overwriting the parent agency list's
`search` and `page`. The UI adapts these values to the existing
`DashboardBookingsQuery` contract, so it remains visually and behaviorally
the same as the booking list. Changing any booking filter resets
`bookingsPage` to one. Invalid, repeated, or foreign query parameters remain
rejected.

The fixed agency ID is never accepted as a query parameter. The server obtains
it from `[agencyId]`, then applies it after authorization.

## Data and Service Design

The agency detail service has two independently meaningful result sets:

1. **Agency summary:** confirmed bookings grouped by agency for the selected
   month using `created_at`, preserving the current sales/count/share card.
2. **Visible bookings:** all bookings for that fixed agency using the same
   date-field rules as `/admin/dashboard/bookings`: `updated_at` for a selected
   month, or `check_in` for an explicit check-in range. Status, text search,
   sort, and pagination then run in the same order as the booking list.

The service validates the agency from the authorized summary scope before it
loads or returns booking rows. A small internal service option supplies the
fixed agency ID to the booking-list filtering step; it is not exposed to the
client or repository API.

## Component Design

Extract the booking workflow only where reuse is real:

- `BookingsList` accepts navigation adapters for its filter and booking-detail
  links, while keeping its current layout and row components.
- `DashboardBookingFilters` accepts an optional navigation adapter and route
  state adapter, allowing agency detail URLs to use `bookingSearch` and
  `bookingsPage` without duplicating its UI or local interactions.
- The agency detail page renders its existing task header and summary card,
  then passes the agency-scoped booking query and links to the shared booking
  workflow.

The booking list continues to show its normal admin agency column. It is
redundant but intentional: the request is for the exact booking-list
presentation, and it confirms the fixed scope visibly.

## Error Handling and Security

- Owners remain denied from agency routes, including direct URLs.
- Missing, unauthorized, or out-of-scope agency IDs use the existing not-found
  response.
- The filter parser allowlists all supported values and rejects unknown values.
- A client can change ordinary filter query parameters but cannot change the
  agency scope of the route.
- Empty states distinguish an empty agency/month from no booking rows matching
  the selected booking filters.

## Testing

- Route tests cover defaults, filter retention, reset-to-first-page behavior,
  foreign-parameter rejection, and separation between parent and booking
  query state.
- Service tests prove fixed-agency isolation across every booking status and
  booking-list date mode.
- UI tests prove the summary card precedes the shared booking toolbar and the
  detail renders the same desktop table/mobile cards and controls as the
  booking list.
- Run type check, lint, full tests, and production build.

## Trade-offs

The route keeps two query namespaces because preserving parent-list navigation
state is more useful than shortening the URL. The summary's created-date sales
definition and the booking workflow's updated/check-in date behavior are
intentionally distinct: each preserves the established meaning of its source
screen rather than silently redefining sales.
