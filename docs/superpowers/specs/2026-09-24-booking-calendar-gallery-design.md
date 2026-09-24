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
  rounded date cells, red confirmed dates, green waiting dates, yellow holidays,
  and the existing status legend. The card also shows the house name and summary.
- A shared toolbar controls the month, zone filtering, ordering, and new-booking
  action. On wide viewports show up to five cards per row; reduce progressively to
  two cards per row on mobile.
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
- Load authorised houses and bookings for the selected visible month through a
  booking service/repository query; filter only from trusted server parameters.
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
  return focus to the selected gallery card, and toolbar/filter updates.
- Run typecheck, lint, relevant Node tests, build, and code review before release.
