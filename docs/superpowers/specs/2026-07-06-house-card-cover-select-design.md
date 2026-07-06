# House Card Cover Select Design

Date: 2026-07-06

## Context

The house image manager currently manages image files and zone-scoped ordering through
`image_zone` and `image_move`.

This feature adds a separate admin flow for choosing which images appear on each house
card. The selected order is stored in `public.images.cover_select`. It is independent
from `image_move` and counts across all image zones for a house.

This stays inside admin-only house image management. It does not add public listing
pages, booking, payment, SEO, or full house data CRUD.

## Decisions

- Add the feature as a mode in the existing route:
  `/admin/houses/[propertyId]/images?mode=cover-select`.
- Keep normal upload/delete behavior in the existing image manager mode.
- Render a separate `CoverSelectViewer` component for card-cover ordering.
- Reuse existing image cards, zone helpers, storage display URL behavior, and
  shadcn/Tailwind UI primitives.
- Use `@dnd-kit/react` and `@dnd-kit/helpers` for selected-image drag and drop.
- Do not add a table migration because `public.images.cover_select` already exists.
- Treat `cover_select = 0` or `null` as not selected.
- A valid saved selection contains 3-10 images.
- Saving resets unselected images for the house to `cover_select = 0`.
- Saving never changes `image_move`.

## UI Flow

Default image mode:

- The existing image manager remains the default screen.
- Add a clear entry button for the cover-select mode.
- Zone-scoped upload, delete, preview, and bulk delete behavior stays unchanged.

Cover-select mode:

1. Load all images for the house with `cover_select`.
2. Initialize the selected strip from images whose `cover_select` is between 1 and 10,
   sorted by `cover_select`.
3. Normalize only the UI state on load:
   - ignore invalid `cover_select` values
   - ignore duplicate image ids
   - renumber the displayed selected order contiguously
4. Show a selected strip at the top with the chosen images labeled 1-10.
5. Use dnd-kit to reorder the selected strip by drag and drop.
6. Provide non-drag controls to move a selected image left or right and remove it.
7. Show all house images in the lower grid.
8. Keep the existing zone sidebar as a filter for the lower grid, but selection order
   is global across all zones.
9. Clicking an unselected image appends it as the next selected image.
10. Clicking a selected image removes it and renumbers the remaining selected images.
11. Disable or block adding more when 10 images are already selected.
12. Save is enabled only for 3-10 selected images.
13. Cancel discards local changes and returns to the database-backed state or normal
    image mode.

## Server/Data Flow

Repository changes:

- Add `cover_select` to the house image select list.
- Add a repository helper to persist cover selection for a property.

Server action:

`saveHouseCoverSelectAction(propertyId, imageIds)`

Inputs:

- `propertyId`
- ordered `imageIds`

Validation:

- Require authenticated admin access.
- Require `allow_tools.allow_accommodation = true`.
- Confirm the house exists.
- Require 3-10 unique positive image ids.
- Load the requested images from trusted server-side data.
- Confirm every requested image belongs to the requested `propertyId`.

Persistence:

- Set all images for the property to `cover_select = 0`.
- Set selected image ids to `cover_select = 1..n` in the submitted order.
- Revalidate `/admin/houses` and the current house image page.
- Return the saved count.

The implementation should keep the save as small as possible. If the plain Supabase
repository update cannot provide a reliable multi-row save, add the smallest database
RPC or SQL helper needed to make the reset-and-rank update atomic.

## Error Handling

- Client validation blocks save when fewer than 3 or more than 10 images are selected.
- Server validation repeats the same 3-10 rule.
- If Supabase save fails, show a toast error and keep the current local selection so
  the admin can retry.
- If images were deleted or changed while the screen was open, server validation fails
  rather than saving a partial or cross-house selection.
- Do not expose secrets, tokens, authorization headers, or storage credentials.

## Testing

Add or update tests for:

- `HouseImageItem` and repository selection include `cover_select`.
- Cover-select normalization:
  - selected images sort by `cover_select`
  - invalid values are ignored
  - displayed order renumbers contiguously
- Save validation:
  - rejects fewer than 3 images
  - rejects more than 10 images
  - rejects duplicate ids
  - rejects images outside the property
- Save behavior updates only `cover_select` and does not touch `image_move`.
- UI wiring:
  - route can switch to `mode=cover-select`
  - `CoverSelectViewer` renders a selected strip
  - dnd-kit is used for reorder
  - save and cancel controls exist
  - lower grid keeps zone filtering while selected order is global

Before finishing implementation, run:

- `npm run typecheck`
- `npm run lint`
- `npm run test`

## Documentation Updates

When implementing, update:

- `docs/image-management.md`
- `docs/architecture.md`

The docs should state that house card display images use `images.cover_select`, that
the value is independent from `image_move`, and that selection is global across image
zones.

## Open Questions

None. The selected design is ready for implementation planning after user review.
