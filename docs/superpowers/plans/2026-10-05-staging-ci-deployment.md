# Staging CI Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically apply approved database migrations and deploy the Staging Worker after protected GitHub Environment approval for pushes to `staging`.

**Architecture:** A new GitHub Actions workflow validates every `staging` push without credentials, then uses the protected `staging` Environment to link its fresh runner to the fixed Staging project and apply database migrations before calling the existing Staging Worker deploy script. A focused project-reference guard prevents any migration command from using Production or another project. The existing local Staging deploy path remains usable but CI supplies public build values through environment variables.

**Tech Stack:** GitHub Actions, Node.js ESM scripts, Supabase CLI, Cloudflare Wrangler/OpenNext, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-10-05-staging-ci-deployment-design.md`

## Global Constraints

- The only Supabase target is `https://sxvkhzhqtrpxgzumsswl.supabase.co` / project `sxvkhzhqtrpxgzumsswl`.
- The only Cloudflare target is account `0df55f166fa309dcc904e992c43f86db`, Worker `webook-staging`.
- Never print, pass as a command-line argument, commit, or write `SUPABASE_DB_PASSWORD` or other secrets.
- The CI workflow may use `supabase link --project-ref sxvkhzhqtrpxgzumsswl` and `supabase db push` only in a fresh GitHub runner; local commands must not use `--linked` for Staging migrations.
- Migration dry-run and application must complete before `npm run deploy:cf:staging`.
- Keep local `.env.staging` support, but CI environment values take precedence.
- Do not add dependencies or change Production deployment behavior.

## Review Focus

- A Production or arbitrary Supabase project reference must be rejected before the CLI runs; Task 1 owns this test.
- A missing project reference must fail without revealing secrets; Task 1 owns this test.
- CI public build variables must override `.env.staging`, but local deployment must still fall back correctly; Task 2 owns this test.
- A Staging push cannot receive deployment credentials until the `staging` Environment gate; Task 3 owns this test.
- Migration failure must block the Worker deploy and the migration command must precede it; Task 3 owns this test.

---

### Task 1: Staging Supabase link guard and migration command

**Files:**
- Create: `scripts/assert-staging-supabase-target.mjs`
- Create: `scripts/run-staging-supabase-migrations.mjs`
- Modify: `tests/cloudflare-staging-boundary.test.ts`
- Create: `tests/staging-supabase-target.test.ts`

**Interfaces:**
- Consumes: `process.env.SUPABASE_ACCESS_TOKEN`, `process.env.SUPABASE_DB_PASSWORD`, and the fixed Staging project reference.
- Produces: `assertStagingProjectRef(value: string | undefined): void` and a migration runner that links and executes `supabase db push` only after validation.

- [ ] **Step 1: Write failing target-guard tests**

Test `assertStagingProjectRef` with `sxvkhzhqtrpxgzumsswl`, the Production ref, an arbitrary ref, and blank input. Assert only the fixed Staging ref returns normally; every rejected input throws the same non-secret-safe message.

- [ ] **Step 2: Run the focused target-guard test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/staging-supabase-target.test.ts`

Expected: FAIL because the guard module does not exist.

- [ ] **Step 3: Implement `assertStagingProjectRef(value: string | undefined): void`**

Compare the supplied value to the fixed Staging project reference. Reject all other values without including the supplied value in any error.

- [ ] **Step 4: Add the migration runner after guard tests pass**

Implement `scripts/run-staging-supabase-migrations.mjs` to require `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, run `npx supabase link --project-ref sxvkhzhqtrpxgzumsswl`, read `supabase/.temp/project-ref`, validate it with the guard, then run `npx supabase db push --dry-run` and `npx supabase db push` in that order. Credentials stay in the child-process environment and never appear in command arguments.

- [ ] **Step 5: Extend the boundary test**

Assert the runner imports the target guard, accepts the two Supabase CI secrets, links only the exact Staging ref, and invokes dry-run before the apply command.

- [ ] **Step 6: Run focused tests to verify they pass**

Run: `node --import ./tests/register-server-only.mjs --test tests/staging-supabase-target.test.ts tests/cloudflare-staging-boundary.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add scripts/assert-staging-supabase-target.mjs scripts/run-staging-supabase-migrations.mjs tests/staging-supabase-target.test.ts tests/cloudflare-staging-boundary.test.ts
git commit -m "feat: guard staging database migrations"
```

### Task 2: CI-aware Staging Worker environment

**Files:**
- Modify: `scripts/run-staging-cloudflare.mjs`
- Create: `tests/run-staging-cloudflare.test.ts`
- Modify: `tests/cloudflare-staging-boundary.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env` or `.env.staging`.
- Produces: `stagingPublicEnvironment(environment: NodeJS.ProcessEnv): Record<string, string>` with CI values preferred and local-file fallback preserved.

- [ ] **Step 1: Write failing environment-resolution tests**

Cover both CI variables supplied, one missing CI variable with valid `.env.staging`, and a missing value in both sources. Assert CI values win as a pair, fallback returns file values only when CI is incomplete, and errors do not disclose secret values.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/run-staging-cloudflare.test.ts`

Expected: FAIL because the resolver is not exported and cannot accept injected input.

- [ ] **Step 3: Implement `stagingPublicEnvironment` and preserve local behavior**

Export the resolver from `scripts/run-staging-cloudflare.mjs`. Use both process values only when both required keys are present; otherwise reuse the existing `.env.staging` parser. Keep the production-environment exclusion and `wrangler.staging.jsonc --keep-vars` invocation unchanged.

- [ ] **Step 4: Update Staging boundary assertions**

Assert the runner retains the Staging Wrangler config and supports CI environment values before the local-file fallback.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `node --import ./tests/register-server-only.mjs --test tests/run-staging-cloudflare.test.ts tests/staging-build-environment.test.ts tests/cloudflare-staging-boundary.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/run-staging-cloudflare.mjs tests/run-staging-cloudflare.test.ts tests/cloudflare-staging-boundary.test.ts
git commit -m "feat: support staging CI build variables"
```

### Task 3: Protected Staging workflow and operating documentation

**Files:**
- Create: `.github/workflows/deploy-staging.yml`
- Modify: `tests/cloudflare-deploy.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the target guard/runner from Task 1 and `npm run deploy:cf:staging` from Task 2.
- Produces: a two-job GitHub Actions workflow triggered by `staging` pushes, with a protected deployment job named `staging`.

- [ ] **Step 1: Write failing workflow policy assertions**

Assert the workflow triggers only on `staging`; validation has placeholder public values and no Cloudflare/database credentials; deployment `needs: validate`, targets Environment `staging`, receives only Environment secrets, runs the migration runner before `npm run deploy:cf:staging`, and uses the pinned checkout/setup-node action SHAs already used by Production.

- [ ] **Step 2: Run the focused policy test to verify it fails**

Run: `node --import ./tests/register-server-only.mjs --test tests/cloudflare-deploy.test.ts`

Expected: FAIL because `deploy-staging.yml` does not exist.

- [ ] **Step 3: Add `.github/workflows/deploy-staging.yml`**

Mirror the existing Production validation structure with Staging config/script names. Add `concurrency.group: staging-deploy`, `cancel-in-progress: false`, a validate job with no secrets, and a protected deploy job using `environment.name: staging`. The protected job runs `node scripts/run-staging-supabase-migrations.mjs`, then `npm run deploy:cf:staging`, then validates generated build references contain Staging and do not contain Production.

- [ ] **Step 4: Document one-time setup and rollback**

Update the CI/CD README section with branch protection expectations, `staging` Environment branch restriction and required reviewers, the five exact secret names, the migration-before-deploy behavior, the CI-only `--linked` rule, and forward-only database rollback policy.

- [ ] **Step 5: Run workflow/documentation policy tests to verify they pass**

Run: `node --import ./tests/register-server-only.mjs --test tests/cloudflare-deploy.test.ts tests/cloudflare-staging-boundary.test.ts`

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run: `npm run verify && npm run build`

Expected: Both commands exit 0; record any pre-existing lint warnings separately from errors.

- [ ] **Step 7: Commit Task 3**

```bash
git add .github/workflows/deploy-staging.yml tests/cloudflare-deploy.test.ts tests/cloudflare-staging-boundary.test.ts README.md
git commit -m "ci: deploy staging after approval"
```
