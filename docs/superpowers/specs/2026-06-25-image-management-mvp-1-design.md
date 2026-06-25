# Image Management MVP 1 Design

## Goal

Build the read-only admin image-management foundation for pool villa houses.
MVP 1 must support real Supabase data, admin-only access, paginated house browsing, and read-only image previews without adding mutation controls.

## Source Of Truth

- Requirements: `docs/image-management/mvp-1-read-only-image-display.md`
- UI design: `docs/design/mvp-1.md`
- Global design: `docs/design/DESIGN.md`
- Reference image URL logic: `D:\Project\baan-pool-villa\lib\aws-image-url.ts`

## Approved Decisions

- Use Supabase Auth email/password for login.
- Authorize admin access from `public.users.role_id`.
- Allowed roles:
  - `1`: Administrator
  - `2`: Operator
- Denied role:
  - `3`: Member
- Admin user lookup:
  - primary: `auth.user.id` -> `public.users.uid`
  - fallback: `auth.user.email` -> `public.users.email`
- The `uid` fallback is temporary because 13 of 28 existing `public.users.uid` values are empty.
- House route identity is `property_id`.
- `/admin/houses` uses numbered pagination.
- Page size is 8 houses.
- House list sorting is `is_active = true` first, then `is_active = false`.
- Search applies to `title`, `property_id`, and `location_zone`.
- Search results still sort active houses first.
- Image previews use:
  `https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws/{image_name}`
- Display image fetch does not require Bearer auth based on read-only smoke test.
- Do not build an image proxy in MVP 1.

## Architecture

Use a server-first MVP 1 with future-ready boundaries:

- `app/login`: Supabase Auth email/password UI.
- `app/admin/houses`: server-rendered house list with pagination and search.
- `app/admin/houses/[propertyId]/images`: server-rendered read-only image page.
- `server/auth`: session and role checks.
- `server/repositories`: database reads for users, listings, and images.
- `server/services`: small orchestration layer for MVP rules.
- `lib/aws-image-url`: local image URL builder and validation adapted from the existing reference.
- UI components stay read-only and mobile-first.

Do not add API routes for MVP 1 unless implementation reveals a real client-side consumer.

## Data Flow

Login:

1. User submits email/password.
2. Supabase Auth creates a session cookie.
3. Admin routes read the session server-side.

Admin authorization:

1. Get Supabase Auth user server-side.
2. Lookup `public.users` by `uid = auth.user.id`.
3. If not found, fallback to `email = auth.user.email`.
4. Allow only `role_id in (1, 2)`.
5. Redirect unauthenticated users to `/login`.
6. Show unauthorized state for authenticated users without access.

House list:

1. Read page and search params.
2. Query `listings` with page size 8.
3. Sort active houses before inactive houses.
4. Return total count for numbered pages.

House images:

1. Use route `propertyId`.
2. Lookup house by `listings.property_id`.
3. Query `images` by `property_id`.
4. Group by `image_zone`.
5. Sort folders by lowest `image_move`.
6. Sort images inside each folder by `image_move`.

## UI Flow

Follow `docs/design/mvp-1.md`.

`/admin/houses`:

- Mobile: compact stacked cards, no images.
- Tablet: compact card/list hybrid, no images.
- Laptop/Desktop: dense table, no images.
- One row/card action: `จัดการรูป`.
- Inactive houses are muted but readable and clickable.
- Numbered pagination appears below the list/table.

`/admin/houses/[propertyId]/images`:

- Mobile: top shell, back link, house summary, horizontal zone chips, selected zone image cards.
- Desktop: admin sidebar, header, left zone folder panel, right selected-zone image grid.
- Show only selected zone images.
- Show actual global `image_move` values.
- No mutation controls.

## Validation And Security

- Never select or render `public.users.password`.
- Never expose Supabase service role keys or provider Bearer tokens to the client.
- Do not use `user_metadata` for authorization.
- Validate `image_name` before building image URLs:
  - allowed image extensions only
  - no path traversal
  - no protocol-relative URL
  - no arbitrary external URL for MVP 1 display
- Keep display image URL generation deterministic from `image_name`.
- Use server-side auth checks on every admin page, not only navigation/proxy.

## Performance

- Do not load all `listings`; use server-side pagination with count.
- Keep page size fixed at 8 for MVP 1.
- Do not load images for `/admin/houses`.
- On image page, query images only for the selected house.
- Defer advanced image optimization and provider operations to later MVPs.

## MVP Extension Points

MVP 2 Draft UI:

- Add client-side draft state around the server-provided image list.
- Keep draft logic isolated from server repositories.

MVP 3 Save Metadata:

- Add mutation entry point that calls `server/services/images`.
- Reuse ordering, zone, and cover validation.

MVP 4 Add/Delete Records:

- Add create/delete services and route handlers or server actions.
- Keep duplicate, extension, and URL validation server-side.

MVP 5 Provider/File CRUD:

- Add provider adapter under `server/`.
- Use Bearer tokens only server-side.
- Handle partial failure between database and provider operations.

## Tests And Verification

Minimum tests for MVP 1:

- role authorization allows roles 1 and 2 and denies role 3
- admin lookup prefers `uid` and falls back to email
- house pagination uses 8 records per page
- active houses sort before inactive houses
- search preserves active-first sorting
- image URL builder rejects invalid names and accepts safe image names

Manual verification:

- login required before admin pages
- Administrator and Operator can access
- Member cannot access
- numbered pagination works
- image page shows grouped read-only images
- no mutation controls are visible

## Non-goals

- Upload/import images
- Delete images or files
- Reorder images
- Save metadata
- Set cover
- Public villa pages
- Booking, pricing, SEO, payment
- Open image proxy
