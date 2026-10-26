# Production notification release

Release branch: `codex/notifications-production`, based on current `origin/main`.
Includes all notification/Push changes tested on Staging `5ff3416`, the navigation
permission prerequisite, dependency security patches, and production CI support.
Unrelated Staging Dashboard report changes are excluded.

## Exact targets and approval

- Supabase: `https://rqizfiayvcbozlzuvbok.supabase.co`
- Cloudflare account: `7c1d945e149fc6fad2124176124d8f33`
- Worker: `webook-admin`, using `wrangler.jsonc`
- Merge/push to `main` triggers `.github/workflows/deploy-production.yml`.
- Do not merge or deploy until the user confirms these exact targets, as AGENTS.md
  requires. Preparing the release branch/PR does not deploy Production.

## Pipeline

1. Audit, typecheck, lint and run every test against an isolated database, no skips.
2. Build and dry-run the Worker.
3. In the `production` environment, verify the target and prepare private Push
   runtime values in an ignored temporary file, not build-time variables.
4. Build with Production public values. Verify Production reference exists in the
   compiled bundle and the Staging reference is absent.
5. Link only the fixed Production Supabase project, dry-run migrations, then apply.
6. Populate cache and deploy to the fixed account/Worker, preserving existing vars
   and runtime secrets. Always clean up the temporary secret file.
7. Verify the live login, authentication guards, Worker revision and notification
   routes. Check signed-in navigation if a Production browser session is available.

## Schema

Five additive notification migrations from Staging: inbox/recipient and Push
tables, lifecycle events, house ID in Push, inbox filters, and cursor feed.
They install event triggers for new changes; no historical notification backfill.
Application rollback does not automatically reverse these additive migrations.

## Missing CI configuration

Metadata-only preflight on 2026-10-26 found only Cloudflare token and public
Supabase URL/anon key configured in the GitHub `production` environment.
Before merge, configure `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in that environment.
Keep keys and passwords out of chat, commits, logs and documentation. Preserve
any existing Production VAPID pair; do not replace it or copy Staging keys blindly.
