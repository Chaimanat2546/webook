# Booking Calendar Gallery

## Purpose

Move booking management into a top-level Booking area and provide an at-a-glance
monthly calendar for every house. Operators can identify availability and booking
state across the portfolio without entering a house workspace first.

## Selected experience

- The top-level route is a Calendar Gallery: one compact calendar card per house,
  shown in a responsive grid.
- The Gallery is additive. The current per-house booking calendar route
  (`/admin/houses/[propertyId]/bookings`) remains available, unchanged, and is
  not redirected or removed in this scope. Existing house actions and sidebar
  entry points keep opening that page.
- Every card follows the public `baan-pool-villa` detail-calendar visual language:
  rounded date cells, red confirmed dates, green waiting dates, and a booking
  status legend. Yellow holiday dates are deferred by user approval until an
  authoritative holiday source is available; use actual booking statuses now.
  The card also shows the house name and summary.
- The approved revision places Thai month navigation inside each house card.
  Each house may display a different month. Search matches house title or DV
  property ID; the results show six houses per page and reset to page one when
  the search changes. Desktop shows three columns and mobile shows one. The
  shared month, zone, ordering, and new-booking controls and the expanded
  calendar dialog are removed. Day cells remain directly keyboard accessible.
- Selecting a booking opens a centred modal rather than navigating away. The
  gallery remains visible but is dimmed behind the modal.

## Booking modal

The modal preserves the existing `BookingEditor` form and its business behavior;
it is a new presentation host, not a new booking form.

- The left column contains the existing stay-date workflow: check-in/check-out
  steps, availability calendar, stay nights, legend, and unchanged-price warning.
- The right column contains the existing customer picker, status, derived nights,
  price maximum, deposit required, extra charge, note, cancellation action, and
  save action.
- On narrow screens, the modal becomes a vertically scrolling, full-width dialog
  with the stay section before the remaining form fields.
- Existing validation, conflict checks, save/cancel actions, optimistic revision
  protection, dirty-close confirmation, accessibility labels, and Thai messages
  remain unchanged.

## Architecture

- Add a dedicated top-level Booking route and server guard that reuses
  `requireBookingAdmin` for every gallery and modal operation.
- Load authorised house metadata through a six-row server page with an exact
  total. The server searches title substrings and exact raw or DV-prefixed
  property IDs. Availability is requested separately for only the visible
  property/month pairs, with a minimal booking projection and explicit row
  pagination. The client keeps at most 24 pairs fresh for 30 seconds; failed or
  loading months do not show old date availability. Saving or cancelling
  invalidates every cached month for that house and reloads only its currently
  visible month.
- Introduce framework-light gallery view models in `lib/`, mapping each property
  and monthly booking interval to the visual date-cell state. Keep date-only,
  Bangkok-safe behavior and exclusive checkout semantics.
- Reuse `BookingEditor` by separating its form body from the current per-house
  Sheet host, then render that body inside a reusable modal host. The current
  house route retains its Sheet host and all existing behavior; the Gallery uses
  the modal host. No legacy route, component, navigation entry, or data flow is
  removed in this implementation.
- Add Booking as a new primary admin navigation item. The house-level booking
  route remains an entry point for a preselected house.

The six-row page uses the database's deterministic title/property ID order.
Its collation may differ from JavaScript Thai locale ordering. Exact partial
numeric property-ID substring search is unavailable without a database cast or
index; raw and DV-prefixed exact IDs are supported.

## Error handling and access

All gallery, detail, creation, update, cancellation, customer and availability
requests require `allow_booking === true` on the server. Show actionable Thai
errors without losing entered modal values. Close/navigation attempts retain the
current dirty-form warning. Do not expose booking data for an unauthorised house
or allow client-provided privilege/scope values.

## Verification

- Unit-test gallery mapping for month spillover, exclusive checkout, confirmed,
  waiting, repair/cancelled states, filters, ordering, and houses without bookings.
- Test that the modal uses the current editor validation and actions unchanged,
  including conflict, stale revision, dirty-close, and cancellation behavior.
- Browser-test desktop modal layout and mobile stacked layout, focus trapping,
  return focus to the selected gallery date or search input, independent card
  month navigation, search, paging, and failed-month retry.
- Run typecheck, lint, relevant Node tests, build, and code review before release.
