# Dashboard New House Detail Design

Date: 2026-10-05

## Intent

Give administrators a complete, trustworthy view of a house newly added in the
selected dashboard month. The page must help an operator assess the house,
its imagery, selling price, facilities, and internal operational facts without
inventing consumer-facing data.

This is a Dashboard reporting detail, not the house-management workspace.
The House Workspace Shell does not apply because this route is reached from
the monthly new-house report and does not own editing tasks or task navigation.

## Scope

In scope:

- Enrich the Dashboard new-house detail with actual listing, image, price, and
  enabled-facility data.
- Present a responsive house-detail layout matching the information hierarchy
  of the supplied reference: gallery, identity/status, facts, price,
  facilities, internal operations, and notes.
- Keep the existing back-to-list action and the link to the existing house
  management workspace.
- Authorize every enriched read on the server and preserve the selected-month
  boundary for a house detail.
- Provide explicit empty states for optional data.

Out of scope:

- Creating, editing, or deleting house data on this Dashboard page.
- A customer review or rating system.
- An internal house code such as `H-030`.
- A count of extra beds; the current `extra_beds` field is a price.
- Resolving an `owner_id` to a person or company name.
- Adding a house booking calendar. Booking data is a separate concern and no
  safe, established Dashboard detail contract has been confirmed for it.
- Changing the existing house-management Workspace Shell.

## Source Data and Truthfulness

The detail may use only these existing data sources:

| Area | Fields or records |
| --- | --- |
| Listing identity | `property_id`, `title`, `location_zone`, `property_type`, `is_active`, `created_at`, `updated_at` |
| Accommodation facts | `bedrooms`, `bathrooms`, `max_guests`, `checkin_time`, `checkout_time`, `extra_beds` |
| Operations | `insurance_fee`, `sort_order`, `notes`, `owner_id` |
| Optional listing content | `description`, `property_tags` |
| Images | listing image metadata and display URL, including cover selection and image zone |
| Prices | weekday, base guests, De Ville price, agency price, price note |
| Facilities | facility name/title, enabled boolean, optional message |

`rating` must never be presented as a star score, review score, or review
count. It is an internal house-quality/readiness status and is out of scope
for this reporting page unless a separately approved label mapping is added.
Likewise, an image zone named `review` is only an image classification and is
not customer-review evidence.

## Page Composition

### Header and gallery

- Keep the Dashboard back link to the selected month’s new-house list.
- Show a gallery with selected cover image, thumbnails, and a total image
  count. When no image exists, show a calm image-empty state rather than a
  broken image or invented stock imagery.
- Beside the gallery, show active/inactive status, house title, DV property
  identifier, zone, type, optional description, and optional tags.
- The page action links to the existing house-management detail for that DV.

### Accommodation facts

Show bedrooms, bathrooms, maximum guests, check-in, and check-out in a
compact responsive facts strip. Do not display `extra_beds` as a bed count.
If the field has a price, it belongs with operational/price information and
must be labelled as the extra-bed price.

### Price card

Show a seven-day price table with separate De Ville and agency values and the
base guest count when it exists. A missing price set produces a clear empty
state. Optional price notes appear only when stored.

### Facility card

Show enabled facilities only, with their human-readable title/name and an
optional message. Disabled facilities are not failures and should not clutter
the main report. If none are enabled, show an empty state.

### Operations and internal note

Show insurance fee, sort order, creation time, latest update time when it
exists, and extra-bed price when it exists. `owner_id` is not shown as an
owner name. Internal notes remain visible only to the authorized Dashboard
administrator and use a dedicated note block; no note is rendered when empty.

## Architecture and Data Flow

Keep the existing Clean Architecture direction:

```text
Dashboard route
  -> loadDashboardHouse service
  -> DashboardRepository
  -> Supabase
```

`DashboardHouse` remains the concise DTO for the new-house list. Add a
separate `DashboardHouseDetailData` (or equivalently named focused contract)
in `lib/dashboard.ts` for the enriched listing detail, images, prices, and
facilities. `DashboardHouseDetail` wraps that rich contract instead of
reusing list-only data.

The service must first authenticate the actor and establish the Dashboard
scope. For a new-house detail it must confirm that the requested listing is
within the selected month’s authorized new-house result before returning the
enriched record. A missing or out-of-month listing remains a not-found result;
non-admin Dashboard scopes remain forbidden. The repository performs queries
only and must not hold authorization policy.

The enriched data stays in Server Components/services and crosses to UI as a
plain, safe display DTO. It must not expose Supabase credentials, privileged
clients, or other private configuration to client code.

## Components and Responsive Behavior

Use existing shadcn/project primitives first: `Card`, `Badge`, `Button`,
`Table`, and existing Dashboard header/layout components. Split the
house-detail presentation into small Dashboard-focused components if that
keeps `DashboardDetails` focused on selecting a detail type.

Desktop order:

1. back action and top gallery/identity area;
2. accommodation facts strip;
3. price, facilities, and operations cards in a responsive grid;
4. internal note.

Mobile order:

1. back action, gallery, and identity;
2. facts in compact wrapping rows;
3. price;
4. facilities;
5. operations;
6. internal note.

Use semantic project tokens and existing visual language. Images need useful
alt text, controls must remain keyboard reachable, and the layout must not
depend on hover alone.

## Empty and Error States

- Missing listing after authorized-month validation: existing dashboard
  not-found state.
- Missing cover/image set: gallery empty state.
- Missing description or tags: omit that optional content without leaving a
  blank card.
- Missing prices: explicit price empty state.
- No enabled facilities: explicit facility empty state.
- Missing `updated_at`, note, extra-bed price, or price note: omit the
  individual value.

Repository failures retain the existing route/service error behavior; the UI
does not substitute guessed facts.

## Testing and Verification

Add focused tests that prove:

- the service refuses non-admin access and does not query enriched data before
  month membership is authorized;
- a selected-month house can load its rich detail while an out-of-month house
  returns not found;
- DTO mapping preserves optional values and excludes review metrics;
- the rendered detail uses real labels for extra-bed price and does not render
  star ratings, review counts, internal codes, or fabricated owner names;
- gallery, price, facility, and optional-content empty states render safely;
- desktop and mobile-safe structure preserves navigation to existing house
  management.

Before completion, run:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
