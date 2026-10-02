# Agency Booking Return State Design

## Goal

When a user opens a booking from an agency detail, the booking detail back
link returns to that same agency detail and retains its allowed filter state.

## Design

- Booking-list links retain their current behavior and return to
  `/admin/dashboard/bookings`.
- Agency-detail links add an allowlisted `fromAgency` context and the
  agency-detail query fields needed to reconstruct the source page.
- The booking-detail route parses that context separately from ordinary
  booking filters, validates every value with the existing agency-detail
  parser, and constructs the back link with `dashboardAgencyDetailHref`.
- The route derives the destination only from the validated agency ID and
  recognized query fields; it never accepts a general `returnTo` URL.
- Invalid, repeated, foreign, or unauthorized context falls back to the
  established not-found response rather than redirecting externally.

## Scope

- Preserve the agency list return state and booking workflow filters,
  including amount and check-in ranges.
- Add route/helper tests for agency-origin booking links and ordinary booking
  links.
- Keep booking authorization and the canonical booking route unchanged.
