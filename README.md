# VillaAdmin

Admin-only web app for managing pool villa images and advertisement images.

Current focus:

- House image management
- Advertisement management MVP

Access is limited to Administrator users (`public.users.role_id = 1`).

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Cloudflare Workers / R2 for advertisement image files

## Local Supabase To Production Workflow

Use Supabase local for schema, migrations, RLS, PostgREST behavior, and admin UI testing before touching production.

All commands below are for Windows PowerShell from the repo root.

```powershell
$env:USERPROFILE="C:\tmp"
$SUPABASE=".\node_modules\.bin\supabase.cmd"
```

Set `USERPROFILE` to `C:\tmp` when the CLI cannot write telemetry under `C:\Users\Poolvilla\.supabase`.

## First-Time Local Setup

1. Start Docker Desktop.
2. Copy `.env.example` to `.env.local`.
3. Initialize Supabase config if missing:

```powershell
Test-Path supabase\config.toml
& $SUPABASE init
```

4. Link this repo to the hosted Supabase project:

```powershell
& $SUPABASE link --project-ref YOUR_PROJECT_REF
```

The command may ask for the remote database password.

## Bring Production Schema Local

Prefer normal migrations. If production already has schema but no matching local baseline migration, create a baseline first.

```powershell
& $SUPABASE db dump --schema public -f C:\tmp\remote_public_schema.sql
& $SUPABASE migration new remote_public_schema
```

Copy `C:\tmp\remote_public_schema.sql` into the generated migration file.

Important for this project: the baseline migration must sort before feature migrations. Example:

```text
20260626050000_remote_public_schema.sql
20260626055459_advertisement_management.sql
```

If local reset fails on `EXCLUDE USING gist` with UUID, add this near the top of the baseline migration:

```sql
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";
```

Do not use `migration repair` unless the migration was already applied on the remote database and only the migration history table is wrong.

## Run Local Supabase

Start the local stack:

```powershell
& $SUPABASE start
```

Reset local database from local migrations:

```powershell
& $SUPABASE db reset --local
```

This resets local only. Never add `--linked` or `--db-url` unless you intentionally want to target a remote database.

Check local URLs and keys:

```powershell
& $SUPABASE status
```

Put the local values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_LOCAL_ANON_KEY
ADMIN_AUTH_BYPASS=true
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
```

Restart the Next.js dev server after changing `.env.local`.

```powershell
npm.cmd run dev
```

## Local Admin Login

For quick UI testing, keep:

```env
ADMIN_AUTH_BYPASS=true
```

No password is needed for `/admin/*` routes when bypass is enabled.

To test real login:

1. Open local Studio from `supabase status` (usually `http://127.0.0.1:54323`).
2. Go to Authentication -> Users -> Add user.
3. Create:

```text
Email: admin@example.local
Password: Admin123456!
Auto Confirm User: true
```

4. Copy the new auth user UID.
5. Insert the matching admin row:

```powershell
& $SUPABASE db query "insert into public.users (email, role_id, uid, name) values ('admin@example.local', 1, 'PASTE_AUTH_UID', 'Local Admin');"
```

6. Set:

```env
ADMIN_AUTH_BYPASS=false
```

7. Restart the dev server and log in with the local admin email/password.

If you see `Invalid Refresh Token`, clear cookies for `localhost:3000` or use an incognito window.

## Local Data

Do not clone production data by default. Prefer a small `supabase/seed.sql` with fake rows needed for testing.

If you must pull public data from production:

```powershell
& $SUPABASE db dump --data-only --schema public --exclude public.users --exclude public.profiles -f supabase\seed.sql
& $SUPABASE db reset --local
```

The Supabase CLI excludes managed schemas such as `auth` and `storage` from dumps, so cloning `public.users` or `profiles` can fail on foreign keys to `auth.users`.

## Development Loop

Create migrations with the CLI:

```powershell
& $SUPABASE migration new descriptive_name
```

Apply and test locally:

```powershell
& $SUPABASE db reset --local
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

Check migration history:

```powershell
& $SUPABASE migration list
```

## Production Release

Production gets schema changes from reviewed migrations only.

Before pushing:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
& $SUPABASE db push --dry-run
```

If the dry run is correct:

```powershell
& $SUPABASE db push
```

Do not run these against production:

```powershell
& $SUPABASE db reset --linked
& $SUPABASE db reset --db-url "..."
```

Use `migration repair` only to fix migration history after confirming the schema already exists remotely.

## Supabase Branches

Use Supabase Branching only when a PR or QA flow needs a cloud preview environment. For normal local development, Supabase local is cheaper and simpler.

Branches are separate Supabase environments with their own API credentials and do not start with production data by default.

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
```

## Scripts

Runtime Next.js scripts (`dev` and `start`) run through `node --use-system-ca` so server-side Supabase fetches trust the Windows system certificate store.

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## References

- Supabase CLI: https://supabase.com/docs/reference/cli
- Supabase Branching: https://supabase.com/docs/guides/deployment/branching
