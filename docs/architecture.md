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

The admin app deploys to Cloudflare Workers through OpenNext using the root `wrangler.jsonc`.
The advertisement media Worker is separate and uses `workers/media/wrangler.jsonc`.

## MVP 1 Admin Image Flow

Supabase Auth session is checked server-side in admin routes.
The app looks up `public.users` by `uid = auth.user.id`, then falls back to `email = auth.user.email` while legacy rows are backfilled.
Only `role_id = 1` can access MVP 1 admin image management.
Listings and images are read through server repositories; client components do not access Supabase directly.
Image display URLs are built from `image_name` using the approved Lambda host, without an image proxy or client-side credential.
The image page uses the `zone` query parameter to select one image category at a time; missing or unknown zones fall back to the first grouped zone.
Known image zones are mapped to Thai display labels and Lucide icon names in `server/services/images.ts`; unknown zones keep their raw label and use the fallback image icon.

## Advertisement Media Flow

Admin pages write advertisement metadata through server actions and Supabase repositories.
Advertisement files are uploaded/deleted through the server-only Worker adapter.
Supabase stores `image_name` keys only.
External systems read active advertisements through Supabase API and build image URLs from `{ADVERTISEMENT_IMAGE_WORKER_URL}/{image_name}`.

## Rules

- Client components should not access private credentials.
- Route handlers should validate input before calling services.
- Storage provider details should stay behind adapter modules.
- Implementation choices should favor maintainability, reuse, security, and performance over the shortest local patch.
- New dependencies are acceptable when they make the implementation safer, simpler, or easier to maintain. Agents must explain the reason and ask before installing them.
- UI flow and screen structure must be confirmed with the user step by step before implementation, unless an approved design already exists.
- UI layout must be mobile-first and support mobile, tablet, laptop, and desktop screen sizes.
