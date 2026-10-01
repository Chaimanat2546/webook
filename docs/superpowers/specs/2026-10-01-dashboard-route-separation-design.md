# Dashboard Route Separation Design

## Intent

Make each dashboard task a dedicated, URL-addressable workflow. The current
single route combines overview, three lists, and three detail pages through
`view`, `from`, and several unrelated pagination and filter query parameters.
That coupling creates duplicate UI responsibilities and makes navigation hard
to predict.

The result must preserve the existing monthly reporting rules, authorization
boundaries, booking drill-down capability, and responsive presentation while
making browser history and URLs natural to use.

## Goals

- Give overview, booking reconciliation, agency reconciliation, and new-house
  history a distinct route and a single purpose.
- Restrict each list URL to filters and pagination that apply to that list.
- Reuse access, aggregation, formatting, filtering, empty-state, and
  responsive list primitives without duplicating business rules.
- Let browser Back navigate naturally; do not retain custom `from` state or
  session-storage return state for dashboard details.
- Preserve existing authorization: owners see only their own overview and
  bookings; agency and house history remain administrator-only.

## Non-goals

- Changing sales definitions, booking status semantics, page size, or source
  tables.
- Adding client-side report filtering, new API endpoints, or new dependencies.
- Changing the existing house workspace route or its shell.

## Route Contract

| Route | Responsibility | Query parameters |
| --- | --- | --- |
| `/admin/dashboard` | Monthly overview and drill-down entry points | `month` |
| `/admin/dashboard/bookings` | Booking reconciliation and sales verification | `month`, `status`, `search`, `agency`, `page` |
| `/admin/dashboard/bookings/[bookingId]` | One authorized booking | `month`, `status`, `search`, `agency`, `page` |
| `/admin/dashboard/agencies` | Agency sales list | `month`, `search`, `page` |
| `/admin/dashboard/agencies/[agencyId]` | One authorized agency and its top houses | `month`, `search`, `page` |
| `/admin/dashboard/houses` | New-house history | `month`, `search`, `page` |
| `/admin/dashboard/houses/[id]` | One authorized house-history item | `month`, `search`, `page` |

All routes validate only their own parameters. The shared month parser keeps
the existing Bangkok-month boundary behavior. List-to-detail links preserve
their list's query so the detail page can render an explicit back link. Agency
detail's booking drill-down points directly to the booking route with
`status=confirmed` and the selected `agency`.

## Legacy URL Migration

`/admin/dashboard?view=...` remains an input-only compatibility route. It
validates the legacy query, selects the matching destination, retains only the
destination's relevant filters, and redirects to the canonical route. Examples:

- `?view=bookings&status=confirmed&agency=a&page=2` becomes
  `/admin/dashboard/bookings?month=...&status=confirmed&agency=a&page=2`.
- `?view=agency&agency=a` becomes `/admin/dashboard/agencies/a?month=...`.
- `?view=houses&housesPage=2` becomes `/admin/dashboard/houses?month=...&page=2`.

No legacy `view`, `from`, `housesPage`, `agenciesPage`, `bookingId`, or
`houseId` parameters appear in a canonical URL.

## Server Architecture

`server/services/dashboard.ts` is split by use case without splitting the
business rules themselves:

- shared authorization/scope resolution;
- shared monthly source read and aggregation helpers;
- `loadDashboardOverview`;
- `loadDashboardBookings` and `loadDashboardBookingDetail`;
- `loadDashboardAgencies` and `loadDashboardAgencyDetail`;
- `loadDashboardHouses` and `loadDashboardHouseDetail`.

The repository remains the sole Supabase query boundary. Booking DTOs include
agency display data only when an administrator requests a booking list or
detail. Owner DTOs must omit it entirely.

## UI Architecture

`DashboardShell` owns the shared page heading and month picker. It accepts a
route-local main body and never owns filters or pagination.

Each list gets a focused component (`BookingsList`, `AgenciesList`,
`NewHousesList`) which owns its own form and table/card presentation. Shared
presentational primitives cover pagination, empty states, list rows and the
desktop-table/mobile-card boundary. Bookings render a semantic table on
desktop and compact cards on mobile; it shows house/DV, stay dates,
administrator-only agency, and amount, without a booking-code column.

Overview cards only summarize and link to their destination route. The unused
client-side `agency-sales.tsx` component is removed; it duplicates the agency
list's filtering, pagination, and sales display.

Details use explicit route-local back links and normal browser history. The
custom `DashboardNavigationContext`, return session storage, and `view/from`
navigation helpers are removed after the new routes replace all callers.

## Errors and Authorization

Every route authorizes server-side before reading or projecting data.
Administrator-only agency and house routes reject owners. Missing, malformed,
foreign, or inaccessible detail identifiers use the existing not-found
behavior. Query validation failures use the current dashboard error surface.

## Verification

Tests must cover:

- canonical parsing and links for every route;
- redirecting legacy URLs while dropping irrelevant state;
- Bangkok month boundaries and status/search/agency filtering;
- pagination and detail-back query preservation;
- agency-to-bookings drill-down;
- owner isolation and agency-data redaction;
- desktop booking table, mobile booking card, and empty states for each list;
- removal of the obsolete client-side agency list and custom dashboard return
  state.

Run `npm run build:pwa`, `npm run typecheck`, `npm run lint`, `npm test`, and
`npm run build`. The existing `worker.ts` lint warning is outside this scope.
