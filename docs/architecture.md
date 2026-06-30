# Architecture

## Main areas

- `app/login/` - admin login
- `app/admin/` - protected admin pages
- `app/api/` - route handlers for admin operations
- `server/` - server-only auth, services, repositories, and storage adapters
- `components/` - UI components

## Data flow

Admin UI -> Server Component / Server Action -> Server Service -> Repository / Storage Adapter -> Supabase / External API

## Deployment

The Next.js admin app has no Cloudflare app deployment config in this repo.
Cloudflare is used only for the media Worker/R2 image pipeline through `workers/media/wrangler.jsonc`.

## MVP 1 Admin Image Flow

Supabase Auth session is checked server-side in admin routes.
The app looks up `public.users` by `uid = auth.user.id`, then falls back to `email = auth.user.email` while legacy rows are backfilled.
House image access is controlled by `public.users.allow_tools.allow_accommodation = true`.
Adding house image records uses `public.users.mid` as the legacy numeric `images.create_by` value, so write actions require `mid > 0`.
Listings and images are read through server repositories; client components do not access Supabase directly.
Legacy AWS/S3 image display URLs are built from `image_name` using the approved Lambda host, without an image proxy or client-side credential.
House and advertisement image cards share `components/admin/image-asset-card.tsx` for the card layout, 4:3 preview area, click-to-preview dialog, and Thai create/update metadata rows.
The image page uses the `zone` query parameter to select one image category at a time; missing or unknown zones fall back to the first configured zone.
Known image zones are mapped to Thai display labels and Lucide icon names in `server/services/images.ts`; the setup menu always includes `cover`, `outside`, `parking`, `inside`, `kitchen`, `bedroom`, `bathroom`, and `review` in that order, even when a zone has no images. Unknown zones with existing images keep their raw label and use the fallback image icon after the configured zones.
House `image_move` values are scoped to `property_id + image_zone`; new uploads calculate the next order number only from the selected zone.

House image storage has two provider classes:

- Legacy AWS/S3-backed images are valid for display through the existing Lambda URL path, but physical file mutation is disabled for now.
- Cloudflare R2 is the only writable storage for new or replaced house image files; create, replace/edit, and delete operations must go through server-side adapters.
- The provider class is inferred from `images.image_url`; do not add a separate provider column.
- New house image files store a filename-only `images.image_name` such as `20260222205910_63fe3bcbc8.webp`.
- New house image R2 object keys are composed server-side as `houses/{property_id}/{image_name}`; clients must not submit storage paths.
- New house image rows store the full Worker URL in `images.image_url` for R2 display/provider detection.
- The same shared media Worker/R2 bucket also serves `advertisements/...`.
- `/admin/houses/[propertyId]/images` uses operation-specific server actions: uploads run immediately when files are selected, single deletes require preview confirmation, and bulk deletes require selecting images from the current zone before the client processes a per-image delete queue.
- New R2 files are uploaded before inserting `images` rows; if the database write fails, uploaded R2 objects are cleaned up best-effort.
- Delete operations are allowed only for trusted R2-backed image rows. Legacy AWS/S3-backed house images remain display-only.
- Bulk select-all is scoped to the currently selected image zone in the client. Bulk delete progress flows call the single-image delete action one trusted R2 image id at a time; do not use one bulk server action when the UI needs per-image status or retry.

## Advertisement Media Flow

Advertisement management is part of the accommodation admin menu and uses `public.users.allow_tools.allow_accommodation = true`.
Admin pages write advertisement metadata through server actions and Supabase repositories.
Advertisement files are uploaded/deleted through the server-only Worker adapter. Create mode uploads images on create submit after generating an advertisement id; edit mode uploads selected images immediately through a client queue and uses operation-specific delete actions.
Supabase stores filename-only `advertisement_images.image_name` values.
Advertisement R2 object keys are composed server-side as `advertisements/{advertisement_id}/{image_name}`.
External systems read active advertisements through Supabase API and build image URLs from `{ADVERTISEMENT_IMAGE_WORKER_URL}/advertisements/{advertisement_id}/{image_name}`.
The media Worker accepts only `advertisements/` and `houses/` key prefixes.
Advertisement edit bulk delete flows call the single-image delete action one image id at a time so the client can show per-image progress and retry failed rows.

## Rules

- Client components should not access private credentials.
- Route handlers should validate input before calling services.
- Storage provider details should stay behind adapter modules.
- House image file operations must route by trusted `images.image_url` values and reject unsupported mutations instead of falling back to another provider.
- Implementation choices should favor maintainability, reuse, security, and performance over the shortest local patch.
- New dependencies are acceptable when they make the implementation safer, simpler, or easier to maintain. Agents must explain the reason and ask before installing them.
- UI flow and screen structure must be confirmed with the user step by step before implementation, unless an approved design already exists.
- UI layout must be mobile-first and support mobile, tablet, laptop, and desktop screen sizes.
