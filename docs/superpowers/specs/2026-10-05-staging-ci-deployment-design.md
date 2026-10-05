# Staging CI deployment design

## Goal

Deploy the `staging` branch to the separate Staging database and Cloudflare
Worker only after GitHub Environment approval. The workflow must apply pending
database migrations before deploying application code, and it must never use a
Production target or secrets stored in the repository.

## Scope

- Add a Staging GitHub Actions workflow triggered by pushes to `staging`.
- Validate the source before the protected deployment job.
- Apply pending migrations to Staging with a Staging-only database credential.
- Deploy only the existing `webook-staging` Worker through
  `npm run deploy:cf:staging`.
- Make the existing Staging deploy script read public build variables from the
  CI environment, while retaining `.env.staging` support for local use.
- Add target guards, tests, and operational documentation.

Production deployment behavior, Production secrets, and database schema changes
are outside this work.

## Deployment flow

1. A push to `staging` starts the validation job.
2. Validation runs dependency installation, the security audit, `npm run
   verify`, the Next.js build, OpenNext build, and the Staging Wrangler dry-run.
   It uses non-secret placeholder public Supabase values and has no deployment
   credentials.
3. When validation passes, a protected job enters the GitHub Environment named
   `staging`. GitHub required reviewers approve that job.
4. The protected job validates the Staging database target, dry-runs pending
   migrations, applies them using the Staging database URL, then deploys the
   Staging Worker.
5. After deploy, the workflow checks the compiled output for the exact Staging
   Supabase project reference and rejects any Production project reference.

If migration validation or migration application fails, the Worker deployment
does not run. GitHub concurrency serializes deployments for the `staging`
environment without canceling an in-progress deployment.

## Targets and secret boundaries

The allowed targets are fixed:

| Resource | Staging value |
| --- | --- |
| Supabase project | `sxvkhzhqtrpxgzumsswl` |
| Supabase URL | `https://sxvkhzhqtrpxgzumsswl.supabase.co` |
| Cloudflare account | `0df55f166fa309dcc904e992c43f86db` |
| Cloudflare Worker | `webook-staging` |

The GitHub Environment `staging`, restricted to the `staging` branch and
protected by required reviewers, holds these secrets:

- `STAGING_DB_URL`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`STAGING_DB_URL` is used only as an environment value for the Supabase CLI. It
is never supplied as a command-line argument, written to files, or printed.
The workflow does not use `supabase --linked`, because the local repository
link may point to Production.

## Implementation boundaries

`scripts/assert-staging-supabase-target.mjs` validates a supplied database URL
without printing it. It accepts only the Staging project host/user forms used
by Supabase poolers and rejects Production or unrecognized hosts.

`scripts/run-staging-cloudflare.mjs` first accepts the two required public
Supabase build values from its process environment. If either is missing, it
falls back to `.env.staging` for local developer workflows. It continues to
exclude `.env.production` and uses `wrangler.staging.jsonc` with `--keep-vars`.

The Staging workflow invokes the existing `npm run deploy:cf:staging` command;
it does not duplicate the Worker deploy command.

## Tests and documentation

Tests must assert that the new workflow pins the Staging branch, uses the
protected `staging` Environment, validates before deployment, applies the
migration before the deploy script, and receives credentials only from
Environment secrets. Target-guard tests cover accepted Staging URLs and reject
Production, arbitrary hosts, and missing inputs. Existing Staging deploy tests
cover environment-file restoration; new tests cover CI environment precedence.

The README documents one-time GitHub Environment setup, required reviewers,
required secrets, the promotion flow, and the rule that local commands must
not use a linked Supabase project for Staging migrations.

## Rollback

Cloudflare code rollback uses the Worker version workflow. Database migrations
are forward-only: a failed migration prevents deployment, and a successfully
applied migration is corrected with a later migration rather than a history
rewrite or destructive rollback.
