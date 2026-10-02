# Dashboard UI Primitives Design

## Purpose

Extract the established Dashboard booking UI composition into reusable
components without changing the visible layout, route behavior, data loading,
or authorization. The first consumer is the booking detail and booking list.
House and agency pages remain unchanged in this delivery, but the interfaces
must be suitable for their later adoption.

## Scope

### Included

- A shared detail layout with responsive desktop and mobile regions.
- A shared summary card wrapper for detail pages.
- A shared interactive tab strip for enabled detail sections.
- A shared list toolbar layout for search and filter controls.
- Migration of the existing booking UI to those primitives with unchanged
  labels, spacing, accessibility labels, links, and interaction behavior.
- Focused UI tests proving the components are used and the current booking
  behavior remains available.

### Excluded

- Changing any booking data, route, server action, permission, or lazy-load
  behavior.
- Adding document or status-history tabs.
- Migrating house, agency, overview, or report screens in this delivery.
- Adding dependencies or a new design system.

## Component Boundaries

### `DashboardDetailLayout`

Owns the page-width container and responsive composition. It receives desktop
header content, mobile header content, optional tabs, main content, and a
summary region. On desktop it keeps the current two-column detail and summary
layout. On mobile it renders the mobile header, summary, tabs, then content.
It is presentational and does not fetch data or own tab state.

### `DashboardSummaryCard`

Owns only the standard card frame: title, optional status/action slot, and
children. It renders as the existing right-side card on desktop and does not
change the booking-specific image, facts, or house link passed as children.

### `DashboardTabs`

Client component because it handles click events. It receives a typed list of
enabled tabs, active value, and change callback. It renders only enabled tabs;
there is no disabled placeholder state. The booking detail retains its
customer lazy-load decision in its parent callback, so this primitive has no
knowledge of data loading.

### `DashboardListToolbar`

Presentational layout for a list form. It provides the current mobile-first
toolbar grid and desktop wrapping behavior while accepting search, primary
filters, advanced-filter trigger, and submit children. Existing filter
controls retain their form names, URLs, and local state.

## Data and Rendering

Pages remain Server Components. `DashboardDetails` remains a Client Component
because booking tabs and deferred customer loading require state. The new
layout and summary wrappers stay server-compatible; the tab primitive is the
smallest client boundary. Server Actions remain passed only to
`DashboardDetails`; no new client access to repositories or privileged
Supabase clients is introduced.

The booking page continues to omit customer details from the initial report.
Selecting the customer tab continues to call the authorized Server Action and
then renders its result.

## Adoption Plan

1. Add the four primitives under `components/admin/dashboard/`.
2. Replace duplicated booking detail container, summary-card frame, and tab
   markup with the new primitives.
3. Replace the booking list toolbar layout with `DashboardListToolbar` without
   changing filter controls.
4. Keep existing `DashboardTaskHeader`, month picker, pagination, rows, and
   status badge as the canonical specialized components.
5. In a later feature, migrate house and agency pages after comparing their
   information architecture to the new slots.

## Error Handling and Accessibility

- Tab controls retain `role="tablist"`, `role="tab"`, and `aria-selected`.
- The tab component only exposes selectable, enabled values.
- Responsive layout uses the existing semantic headers and preserves mobile
  reading order: header, summary, tabs, content.
- Error and loading UI remain owned by booking content, including the existing
  customer-load failure message and skeleton.

## Verification

- Add a failing Dashboard UI test before each extracted primitive migration.
- Run the targeted dashboard test, full test suite, type check, lint, and
  production build.
- Manually verify a numeric booking ID can still load the customer tab on the
  local booking detail route.
