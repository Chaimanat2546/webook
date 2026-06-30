# Webook

Admin-only web app for managing pool villa images and advertisement images.

Current focus:

- House image management
- Advertisement management MVP

Authenticated system users can sign in. Feature access is controlled by `public.users.allow_tools`.
House/accommodation menu access currently requires `allow_tools.allow_accommodation = true`.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Cloudflare R2 with a dedicated media Worker for advertisement image files and new managed house image files

## House Image Storage Policy

- Existing imported house images may continue to display through the current AWS/S3-backed image source.
- New or replaced house image files must be managed in Cloudflare R2 through server-side code.
- AWS/S3-backed house images can be displayed through the legacy Lambda image URL and deleted after confirmation through signed server-side S3 `DELETE` requests. Keep provider detection, but do not upload, replace, or edit physical house image files in AWS/S3.
- Use `images.image_url` to distinguish AWS/S3 legacy images from Cloudflare R2 images; do not add a provider column.
- New house image uploads use the shared media Worker env vars: `ADVERTISEMENT_IMAGE_WORKER_URL` and `ADVERTISEMENT_IMAGE_WORKER_SECRET`.
- AWS/S3 house image deletes use `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` server-side only.
- House image admins must have `allow_tools.allow_accommodation = true`. Adding new house images also requires a positive `users.mid` because `images.create_by` is required.

## House Image Admin Flow

- The image manager works one image zone at a time through `/admin/houses/[propertyId]/images?zone=...`.
- File selection uploads house images immediately to R2 through server-side code. There is no staged upload/save step for house images.
- Single-image delete opens a confirmation dialog with the image preview before deleting.
- Bulk delete uses selection mode for the current zone only. `Select all` selects only deletable images visible in that zone, and the admin confirms from a preview list before deletion.
- AWS/S3-backed legacy house images are included in delete controls when their `image_url` identifies the AWS/S3 provider.

## Supabase Feature Workflow

Use this flow for every new feature that touches Supabase.

```text
local -> staging -> production
```

- `local`: fast development, TDD, migrations, RLS checks
- `staging`: QA with a cloud database and app-like credentials
- `production`: reviewed migration release only

Never test new SQL directly on production first.

## PowerShell Setup

Run commands from the repo root.

```powershell
$env:USERPROFILE="C:\tmp"
$SUPABASE=".\node_modules\.bin\supabase.cmd"
```

`USERPROFILE=C:\tmp` avoids Supabase CLI telemetry/profile write errors under `C:\Users\Poolvilla\.supabase`.

## Local Setup

Start Docker Desktop, then:

```powershell
& $SUPABASE start
& $SUPABASE status
```

Copy `.env.example` to `.env.local` and point the app at local Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_LOCAL_ANON_KEY
# Shared media Worker for advertisements and new house images.
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
# Legacy AWS/S3 house image delete credentials. Server-side only.
AWS_REGION=
AWS_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Restart Next.js after changing `.env.local`:

```powershell
npm.cmd run dev
```

## Local Baseline

This repo contains a production-schema baseline migration for local and fresh staging setup:

```text
20260626050000_remote_public_schema.sql
```

Rules:

- Keep it before feature migrations by timestamp.
- Use it to build local or a fresh staging project.
- Do not push it to production. Production already has that schema.

If the baseline is missing and production schema must be pulled again:

```powershell
& $SUPABASE db dump --schema public -f C:\tmp\remote_public_schema.sql
& $SUPABASE migration new remote_public_schema
```

Copy the dump into the generated migration and rename the timestamp so it sorts before feature migrations.

If reset fails on a GiST exclusion constraint with UUID, ensure the baseline has this near the top:

```sql
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";
```

## Creating A Supabase Feature

1. Write the smallest failing test first.
2. Create a migration with the CLI:

```powershell
& $SUPABASE migration new feature_name
```

3. Put only the required SQL in that migration.
4. Apply locally:

```powershell
& $SUPABASE migration up --local
```

If local state is messy, rebuild from scratch:

```powershell
& $SUPABASE db reset --local
```

`db reset --local` only resets local. Never add `--linked` or `--db-url` unless intentionally targeting a remote database.

5. Run checks:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

## RLS Rules

Every table in `public` that is exposed through Supabase APIs must have RLS enabled and explicit policies.

Admin-only house image policies should follow the existing accommodation permission check:

```sql
exists (
  select 1
  from public.users
  where users.allow_tools @> '{"allow_accommodation": true}'::jsonb
    and (
      users.uid = auth.uid()
      or users.email = auth.jwt() ->> 'email'
    )
)
```

Do not use broad policies like this for admin-only data:

```sql
using (true)
```

or:

```sql
to authenticated using (true)
```

Those allow every logged-in user to read the table through Supabase APIs.

## Local Admin User

Create a local auth user in Supabase Studio from `supabase status`:

```text
Authentication -> Users -> Add user
Email: admin@example.local
Password: Admin123456!
Auto Confirm User: true
```

Copy the new auth user UID, then insert the matching admin row. Keep `mid` when testing house image uploads:

```powershell
& $SUPABASE db query "insert into public.users (email, role_id, uid, name, mid, allow_tools) values ('admin@example.local', 1, 'PASTE_AUTH_UID', 'Local Admin', 1, '{""allow_accommodation"": true}'::jsonb);"
```

`public.users.uid` must equal `auth.users.id`. `public.users.id` is not the auth UID.

If login behaves strangely after changing users or env vars, clear cookies for `localhost:3000` or use an incognito window.

## Seed Data

Prefer small fake seeds for feature work.

The existing `supabase/seed.sql` may contain production-like data. Use it only for private local/staging testing and never treat it as a clean fixture.

To restore a multi-statement seed file, use `psql`; `supabase db query -f` may fail on multi-statement dumps:

```powershell
psql "$STAGING_DB_URL" -f supabase\seed.sql
```

If `psql` is unavailable, install/use a PostgreSQL client rather than splitting the dump by hand.

## Staging

Use a separate staging Supabase project for QA.

For a fresh staging project, pushing the local baseline plus feature migrations is expected:

```powershell
& $SUPABASE db push --db-url $STAGING_DB_URL --dry-run
& $SUPABASE db push --db-url $STAGING_DB_URL
```

Use a pooler connection string from the staging dashboard when direct `db.<project-ref>.supabase.co` DNS does not resolve.

Keep staging credentials out of committed files. If a database URL or password is pasted into chat/logs, rotate it.

Create staging auth/admin users in the staging dashboard, then insert matching rows in `public.users`.

## Production

Before production, temporarily move the local-only baseline out of `supabase/migrations`:

```powershell
Move-Item supabase\migrations\20260626050000_remote_public_schema.sql C:\tmp\20260626050000_remote_public_schema.sql
```

Dry-run production:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
& $SUPABASE db push --dry-run
```

The dry-run must list only new production migrations. It must not list:

```text
20260626050000_remote_public_schema.sql
```

Push only after reviewing the dry-run:

```powershell
& $SUPABASE db push
```

Move the baseline back after the production workflow:

```powershell
Move-Item C:\tmp\20260626050000_remote_public_schema.sql supabase\migrations\20260626050000_remote_public_schema.sql
```

Do not run these against production:

```powershell
& $SUPABASE db reset --linked
& $SUPABASE db reset --db-url "..."
```

Use `migration repair` only after confirming the schema already exists remotely and only the migration history table is wrong.

## Admin Web Worker Deploy

The Next.js admin app deploys to a separate Cloudflare Worker through OpenNext:

```powershell
npm.cmd run deploy:cf
```

The root `wrangler.jsonc` deploys the admin web Worker named `webook-admin`.
Do not use `workers/media/wrangler.jsonc` for the admin web app.
The build script runs Next.js with `--webpack` and `--use-system-ca` so OpenNext can bundle server chunks correctly on this Windows workspace.
The admin Worker uses an R2 binding named `NEXT_INC_CACHE_R2_BUCKET` for OpenNext incremental cache.

Production owners should set the app runtime variables/secrets in their own Cloudflare account before deploying:

```powershell
npx.cmd wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx.cmd wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_URL
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_SECRET
npx.cmd wrangler secret put AWS_REGION
npx.cmd wrangler secret put AWS_BUCKET
npx.cmd wrangler secret put AWS_ACCESS_KEY_ID
npx.cmd wrangler secret put AWS_SECRET_ACCESS_KEY
```

## Media Worker Deploy

The media Worker/R2 image pipeline deploys separately from the admin web Worker.

Set the private upload secret as a media Worker secret:

```powershell
npx.cmd wrangler secret put ADVERTISEMENT_IMAGE_WORKER_SECRET --config workers/media/wrangler.jsonc
```

Deploy the media Worker manually:

```powershell
npx.cmd wrangler deploy --config workers/media/wrangler.jsonc
```

## Advertisement Media

Supabase stores advertisement image metadata only:

- `advertisements`
- `advertisement_images`
- `image_name` keys such as `advertisements/{advertisement_id}/1.webp`

Image files are uploaded, deleted, and served through the `webook-media` Cloudflare Worker/R2 bucket. Supabase local does not replace Cloudflare R2; use adapter tests or a deployed Worker for image-file behavior.

Required server-side variables for advertisement image uploads:

```env
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
AWS_REGION=
AWS_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

The same Worker/R2 variables are reused for new managed house image uploads under the `houses/{property_id}/...` key prefix.
The AWS variables are used only server-side when deleting legacy AWS/S3 house images.

## Scripts

Runtime Next.js scripts (`dev` and `start`) run through `node --use-system-ca` so server-side Supabase fetches trust the Windows system certificate store.

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## References

- Supabase CLI: https://supabase.com/docs/reference/cli
- Supabase local development: https://supabase.com/docs/guides/local-development
- Supabase Branching: https://supabase.com/docs/guides/deployment/branching
