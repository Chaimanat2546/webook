# Poolvillapattaya Tenant Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Poolvillapattaya` as a second production Central User Manager Tenant, backed only by the `baan-pool-villa02` Worker named RPC Service Binding.

**Architecture:** Webook keeps a compile-time allowlist of Tenant metadata and selects a Cloudflare Service Binding through explicit code branches. `baan-pool-villa02` is enabled in its first correctly configured deployment; Webook never sends credentials or a dynamic Worker destination from the browser.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Cloudflare Workers Service Bindings, Wrangler, OpenNext, Supabase.

## Global Constraints

- Tenant key: `poolvillapattaya`.
- Display name: `Poolvillapattaya`.
- Tenant UUID: `9fd7c645-563a-4cce-85ac-20ffb8f3bfc0`.
- Target Worker name: `baan-pool-villa02`.
- Target named entrypoint: `CentralUserManagerEntrypoint`.
- Webook and the Tenant Worker must use the same Cloudflare account.
- The browser sends only `tenantKey`; it must never send a Worker name, binding name, URL, Tenant UUID, project ref, or secret.
- Keep the public Central User Manager HTTP paths closed with empty `404`; do not add a Bearer or HTTP fallback.
- Do not add dependencies, alter Webook's staging target, run database migrations, deploy, or commit without separate explicit approval.

---

### Task 1: Add the Poolvillapattaya Tenant configuration

**Files:**
- Modify: `C:\Projects\baan-pool-villa\wrangler.jsonc:117-125`
- Modify: `C:\Projects\baan-pool-villa\worker-central-user-manager.test.ts`

**Interfaces:**
- Consumes: the existing `baan02` Wrangler environment and the local server-only `.env.baan02` configuration.
- Produces: an enabled Tenant Worker configured with the canonical UUID and its matching Home Config Supabase project ref.

- [ ] **Step 1: Write the failing config contract test**

Add a test that reads `wrangler.jsonc`, selects `env.baan02`, and asserts exactly:

```ts
expect(config.env.baan02.name).toBe("baan-pool-villa02");
expect(config.env.baan02.vars.CENTRAL_USER_MANAGER_AGENT_ENABLED).toBe("true");
expect(config.env.baan02.vars.CENTRAL_USER_MANAGER_TENANT_ID).toBe("9fd7c645-563a-4cce-85ac-20ffb8f3bfc0");
expect(config.env.baan02.vars.CENTRAL_USER_MANAGER_PROJECT_REF).toMatch(/^[a-z0-9]{20}$/);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd test -- worker-central-user-manager.test.ts`

Expected: FAIL because `baan02` has no Tenant UUID or project ref and is disabled.

- [ ] **Step 3: Add only the non-secret Tenant vars**

In `env.baan02.vars`, preserve the existing site URL and add these two exact
entries:

```json
"CENTRAL_USER_MANAGER_AGENT_ENABLED": "true",
"CENTRAL_USER_MANAGER_TENANT_ID": "9fd7c645-563a-4cce-85ac-20ffb8f3bfc0"
```

Derive the literal project ref locally from the hostname of
`NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` before editing. This command validates
the ref without emitting the URL or the ref:

```powershell
$tenantEnvLine = Get-Content .env.baan02 | Where-Object { $_ -match '^NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL=' }
$tenantHomeConfigUrl = $tenantEnvLine.Substring('NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL='.Length)
$tenantProjectRef = ([uri]$tenantHomeConfigUrl).Host.Split('.')[0]
if ($tenantProjectRef -notmatch '^[a-z0-9]{20}$') { throw 'Invalid baan02 Supabase project ref.' }
```

Add `CENTRAL_USER_MANAGER_PROJECT_REF` with the exact `$tenantProjectRef`
value. Do not print that URL or any secret.

- [ ] **Step 4: Run the focused test and type check**

Run: `npm.cmd test -- worker-central-user-manager.test.ts; npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false`

Expected: PASS.

### Task 2: Add the explicit production Webook binding and registry entry

**Files:**
- Modify: `C:\Projects\webook\server\central-user-manager\tenant-bindings.ts`
- Modify: `C:\Projects\webook\server\central-user-manager\cloudflare-bindings.ts`
- Modify: `C:\Projects\webook\cloudflare-env.d.ts`
- Modify: `C:\Projects\webook\wrangler.jsonc`
- Modify: `C:\Projects\webook\tests\central-user-manager-tenant-bindings.test.ts`
- Modify: `C:\Projects\webook\tests\cloudflare-deploy.test.ts`

**Interfaces:**
- Consumes: the immutable key `poolvillapattaya` and UUID `9fd7c645-563a-4cce-85ac-20ffb8f3bfc0`.
- Produces: a browser-safe registry item and typed `env.CUM_POOLVILLAPATTAYA` binding that invokes only `baan-pool-villa02`.

- [ ] **Step 1: Extend the registry and deployment-boundary tests first**

Update the expected public list and resolver assertions to include:

```ts
{
  key: "poolvillapattaya",
  displayName: "Poolvillapattaya",
  environment: "Production",
  enabled: true,
}
```

Assert resolving its key returns its UUID. Add source assertions for
`env.CUM_POOLVILLAPATTAYA` and retain the assertion that `env[...]` is absent.
Extend the Wrangler test so `services` equals the two exact entries:

```ts
{ binding: "CUM_BAANPARTY", service: "baan-pool-villa", entrypoint: "CentralUserManagerEntrypoint" },
{ binding: "CUM_POOLVILLAPATTAYA", service: "baan-pool-villa02", entrypoint: "CentralUserManagerEntrypoint" },
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm.cmd test -- tests/central-user-manager-tenant-bindings.test.ts tests/cloudflare-deploy.test.ts`

Expected: FAIL because the second Tenant and binding do not exist.

- [ ] **Step 3: Add the enabled registry entry and typed binding**

Append this exact registry object without exposing its `id` from
`listCentralUserTenants()`:

```ts
{
  key: "poolvillapattaya",
  id: "9fd7c645-563a-4cce-85ac-20ffb8f3bfc0",
  displayName: "Poolvillapattaya",
  environment: "Production",
  enabled: true,
}
```

Add `CUM_POOLVILLAPATTAYA` to `CloudflareEnv`, add the matching explicit
`if (tenant.key === "poolvillapattaya" && env.CUM_POOLVILLAPATTAYA)` branch,
and add the exact service entry to production `wrangler.jsonc`. Keep
`wrangler.staging.jsonc` and its guard unchanged.

- [ ] **Step 4: Run the focused tests and type check**

Run: `npm.cmd test -- tests/central-user-manager-tenant-bindings.test.ts tests/cloudflare-deploy.test.ts; npm.cmd run typecheck`

Expected: PASS. Both configured Tenants resolve only to their explicit binding.

### Task 3: Prove the multi-Tenant dispatch boundary

**Files:**
- Modify: `C:\Projects\webook\tests\central-user-manager-actions.test.ts`
- Modify: `C:\Projects\webook\tests\central-user-manager-page.test.ts`

**Interfaces:**
- Consumes: `poolvillapattaya` with `enabled: true`.
- Produces: regression coverage that the selected key reaches only its explicit binding.

- [ ] **Step 1: Add failing second-Tenant assertions**

Assert action source continues to reject `!tenant.enabled`, and render the
User Manager with both public Tenant objects. Assert selecting
`Poolvillapattaya` generates a request containing only
`tenantKey: "poolvillapattaya"`.

- [ ] **Step 2: Run the focused tests and confirm the assertion fails**

Run: `npm.cmd test -- tests/central-user-manager-actions.test.ts tests/central-user-manager-page.test.ts`

Expected: FAIL because the current test fixture contains only `baanparty`.

- [ ] **Step 3: Make the smallest UI fixture correction only if the test proves it is needed**

Preserve the existing `disabled={!selected?.enabled}` guard. Update only the
test fixture and any selection assertion necessary to prove the second
registry key is passed unchanged. Do not change paging, dialogs,
temporary-password handling, or UI layout.

- [ ] **Step 4: Run the focused tests**

Run: `npm.cmd test -- tests/central-user-manager-actions.test.ts tests/central-user-manager-page.test.ts`

Expected: PASS.

### Task 4: Deploy and verify the enabled Tenant

**Files:**
- Modify: `C:\Projects\baan-pool-villa\wrangler.jsonc:117-125`
- Modify: `C:\Projects\webook\server\central-user-manager\tenant-bindings.ts`
- Modify: `C:\Projects\webook\tests\central-user-manager-tenant-bindings.test.ts`
- Modify: `C:\Projects\baan-pool-villa\docs\central-user-manager\tenant-provisioning.md`

**Interfaces:**
- Consumes: the enabled target configuration, production Service Binding, and
  validated target secrets.
- Produces: a verified second enabled Tenant in Webook.

- [ ] **Step 1: Verify target secrets by name, without printing values**

Confirm the `baan02` Worker has `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` and
`SUPABASE_SECRET_KEY` in Cloudflare secrets, and locally confirm the first
URL resolves to the project ref configured in Task 1. Do not use an anon key
or Webook's staging database credentials for this Tenant.

- [ ] **Step 2: Deploy the enabled target Worker**

Run: `npm.cmd run build:cf; npx.cmd wrangler deploy --env baan02`

Expected: successful deployment of `baan-pool-villa02` with its named RPC
entrypoint; the public Central User Manager paths remain empty `404`.

- [ ] **Step 3: Deploy the Webook binding revision**

Run from `C:\Projects\webook`: `npm.cmd run deploy:cf`

Expected: successful deployment of `webook-admin` with the two service
bindings; do not use the `deploy:cf:staging` script.

- [ ] **Step 4: Test binding-only readiness**

Sign in as a role-1 Webook administrator, select `Poolvillapattaya`, and
invoke `list_users`. Confirm the request returns the safe normal list result
through Webook logs and that no public Central User Manager endpoint is used.

- [ ] **Step 5: Run production-safe acceptance checks**

Use a disposable user to run `create_user`, `reissue_temporary_password`,
`suspend_user`, and `reactivate_user`. Confirm every legacy/public
Central User Manager path returns empty `404`; do not log or retain the
temporary password.

### Task 5: Final regression and documentation verification

**Files:**
- Modify: `C:\Projects\webook\README.md`
- Modify: `C:\Projects\baan-pool-villa\docs\central-user-manager\tenant-provisioning.md`

**Interfaces:**
- Consumes: final enabled `poolvillapattaya` registry and deployment state.
- Produces: operator documentation that names the static-binding-only process.

- [ ] **Step 1: Update operator documentation**

Document the new Tenant key, display name, target Worker name, UUID, static
binding requirement, and rollback action: set the registry entry and target
Worker flag to disabled, then redeploy both revisions. Do not add any secret
value or Supabase URL to documentation.

- [ ] **Step 2: Run final local verification**

Run in `C:\Projects\webook`:

```powershell
npm.cmd run verify
npm.cmd run build
```

Run in `C:\Projects\baan-pool-villa`:

```powershell
npm.cmd test -- worker-central-user-manager.test.ts
npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false
npm.cmd run lint
npm.cmd run build
```

Expected: all commands pass with no errors.

- [ ] **Step 3: Review the working tree and request a commit decision**

Run `git status --short` in both repositories. Do not commit unless the user
explicitly requests it.
