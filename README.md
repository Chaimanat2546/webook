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
ADVERTISEMENT_IMAGE_WORKER_URL=
ADVERTISEMENT_IMAGE_WORKER_SECRET=
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

Admin-only policies should follow the existing role check:

```sql
exists (
  select 1
  from public.users
  where users.role_id = 1
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

Copy the new auth user UID, then insert the matching admin row:

```powershell
& $SUPABASE db query "insert into public.users (email, role_id, uid, name) values ('admin@example.local', 1, 'PASTE_AUTH_UID', 'Local Admin');"
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
- Supabase local development: https://supabase.com/docs/guides/local-development
- Supabase Branching: https://supabase.com/docs/guides/deployment/branching
