# Multi-tenant User Manager UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the three-column User Manager UI while safely supporting multiple pre-approved Tenant Service Bindings.

**Architecture:** A server-only tenant registry maps a browser-safe tenant key to display metadata, an immutable Tenant UUID, and an explicit named binding. Server actions resolve and validate the key before running the existing RPC service. The UI has no Worker URL, binding name, Project ref, or dynamic destination logic.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, shadcn/ui, Cloudflare Workers Service Bindings, Node test runner.

## Global Constraints

- Only `role_id = 1` can use `/admin/user-manager`.
- Preserve exactly five operations: list, create, reissue password, suspend, reactivate.
- Tenant additions require explicit registry, Cloudflare type/config binding, and a redeploy in account `0df55f166fa309dcc904e992c43f86db`.
- The browser may submit only a registry key; never a Tenant UUID, Worker URL, Service Binding name, project ref, or Bearer credential.
- Keep public Tenant HTTP endpoints closed and do not restore health/reconcile/activation endpoints.
- Do not add dependencies or commit without explicit user approval.

---

### Task 1: Compile-time tenant registry and explicit RPC resolution

**Files:**
- Modify: `server/central-user-manager/tenant-bindings.ts`
- Modify: `server/central-user-manager/cloudflare-bindings.ts`
- Modify: `cloudflare-env.d.ts`
- Modify: `wrangler.staging.jsonc`
- Modify: `scripts/assert-staging-cloudflare-target.mjs`
- Modify: `tests/central-user-manager-tenant-bindings.test.ts`
- Modify: `tests/cloudflare-staging-boundary.test.ts`

**Interfaces:**
- Produces `CENTRAL_USER_TENANTS`, a server-owned readonly list of `{ key, id, displayName, environment, enabled }`.
- Produces `resolveCentralUserTenant(key: unknown)` and `callTenantAgent(tenant, request)` where both reject unknown or disabled tenants.
- Consumes one explicit `CUM_<TENANT>` Cloudflare binding per registry entry.

- [ ] **Step 1: Write failing registry/binding tests**

```ts
assert.deepEqual(listCentralUserTenants(), [{ key: "baan-pool-villa-staging", displayName: "Baan Pool Villa", environment: "Staging", enabled: true }]);
assert.equal(resolveCentralUserTenant("unknown"), null);
assert.equal(resolveCentralUserTenant("baan-pool-villa-staging")?.id, "2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb");
assert.doesNotMatch(readFileSync("server/central-user-manager/cloudflare-bindings.ts", "utf8"), /env\[[^\]]+\]/);
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm.cmd run test -- tests/central-user-manager-tenant-bindings.test.ts tests/cloudflare-staging-boundary.test.ts`

Expected: FAIL because the list API and registry key resolver do not exist.

- [ ] **Step 3: Implement the immutable registry and explicit binding switch**

```ts
export const CENTRAL_USER_TENANTS = [{
  key: "baan-pool-villa-staging",
  id: "2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb",
  displayName: "Baan Pool Villa",
  environment: "Staging",
  enabled: true,
}] as const;

export function resolveCentralUserTenant(key: unknown) {
  return typeof key === "string"
    ? CENTRAL_USER_TENANTS.find((tenant) => tenant.key === key) ?? null
    : null;
}
```

Keep the binding module as explicit branches such as `if (tenant.key === "baan-pool-villa-staging") return env.CUM_BAAN_POOL_VILLA_STAGING.executeOperation(request);`.

- [ ] **Step 4: Extend type/config guard for every current registry entry**

Add the typed binding and exact Service Binding configuration for the Staging registry entry. Make the guard assert a one-to-one registry/config relationship and preserve account/Worker/R2 pins.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm.cmd run test -- tests/central-user-manager-tenant-bindings.test.ts tests/cloudflare-staging-boundary.test.ts; npm.cmd run typecheck`

Expected: PASS.

### Task 2: Server actions accept only a tenant key

**Files:**
- Modify: `app/admin/user-manager/actions.ts`
- Modify: `server/services/central-user-manager.ts`
- Create: `tests/central-user-manager-actions.test.ts`

**Interfaces:**
- Consumes `tenantKey` from `FormData`, `resolveCentralUserTenant`, and the existing five-action parser.
- Produces action functions that accept a valid registry key and return the existing browser-safe result.

- [ ] **Step 1: Write failing server-action boundary tests**

```ts
assert.equal(readFileSync("app/admin/user-manager/actions.ts", "utf8").includes("tenantId = STAGING_TENANT_ID"), false);
assert.match(readFileSync("app/admin/user-manager/actions.ts", "utf8"), /resolveCentralUserTenant\(readString\(formData, "tenantKey"\)\)/);
assert.match(readFileSync("app/admin/user-manager/actions.ts", "utf8"), /tenantKey/);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd run test -- tests/central-user-manager-actions.test.ts`

Expected: FAIL because actions still hard-code the Staging Tenant ID.

- [ ] **Step 3: Resolve tenant key on the server before RPC dispatch**

```ts
const tenant = resolveCentralUserTenant(readString(formData, "tenantKey"));
if (!tenant || !tenant.enabled) throw new Error("Invalid request");
const result = await runCentralUserOperation({ tenantId: tenant.id, operationId, action, payload });
```

Pass `tenant` to the explicit binding client when it must choose the Service Binding; do not pass a raw key to `env`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm.cmd run test -- tests/central-user-manager-actions.test.ts; npm.cmd run typecheck`

Expected: PASS.

### Task 3: Restore the three-column, dialog-based UI

**Files:**
- Modify: `app/admin/user-manager/page.tsx`
- Modify: `components/admin/user-manager/user-manager-page.tsx`
- Create: `components/admin/user-manager/project-list.tsx`
- Create: `components/admin/user-manager/user-table.tsx`
- Create: `components/admin/user-manager/status-panel.tsx`
- Create: `components/admin/user-manager/create-user-dialog.tsx`
- Create: `components/admin/user-manager/user-action-dialog.tsx`
- Create: `components/admin/user-manager/temporary-password-dialog.tsx`
- Create: `components/admin/user-manager/use-user-manager.ts`
- Create: `app/admin/user-manager/loading.tsx`
- Create: `components/admin/user-manager/user-table-skeleton.tsx`
- Modify: `tests/central-user-manager-page.test.ts`

**Interfaces:**
- Page supplies browser-safe tenant metadata from the registry, not binding details.
- Hook owns selected tenant key, list pagination, pending state, transient error/status, selected user, and temporary password acknowledgement.
- Project list emits only a registry key. Status panel emits one of the five fixed action names plus an email.

- [ ] **Step 1: Write failing UI structure tests**

```ts
const source = readFileSync("components/admin/user-manager/user-manager-page.tsx", "utf8");
assert.match(source, /ProjectList/);
assert.match(source, /UserTable/);
assert.match(source, /StatusPanel/);
assert.match(source, /CreateUserDialog/);
assert.match(source, /TemporaryPasswordDialog/);
assert.doesNotMatch(source, /workers\.dev|CUM_BAAN_POOL_VILLA_STAGING|tenantId/);
```

- [ ] **Step 2: Run the focused UI test and confirm it fails**

Run: `npm.cmd run test -- tests/central-user-manager-page.test.ts`

Expected: FAIL because the current page is a sequence of inline forms without the three-column composition.

- [ ] **Step 3: Build the UI from the approved `25822d7` composition**

Use the reference's responsive `xl:grid-cols-[16rem_minmax(0,1fr)_18rem]` layout. Replace project health/reconcile/activation controls with tenant metadata, current safe operation status, and the five approved user actions. Keep Thai copy and use existing shadcn `Alert`, `Button`, and `Dialog` primitives.

- [ ] **Step 4: Enforce disabled states and temporary-password lifecycle**

Disable mutations for a disabled Tenant, while a disabled Tenant may still be visible. Do not display a password inside the table or persistent state; the acknowledgement dialog clears it on close. Give `completed`, `in_progress`, `needs_review`, and `quarantined` distinct safe Thai feedback.

- [ ] **Step 5: Run UI tests, render responsive states, and run typecheck**

Run: `npm.cmd run test -- tests/central-user-manager-page.test.ts; npm.cmd run typecheck`

Render `/admin/user-manager` with an authenticated role-1 staging user; inspect desktop three-column, narrow stacked layout, empty list, loading skeleton, disabled Tenant, error, and temporary-password states.

### Task 4: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example` only if runtime variables change (none are expected)
- Modify: `docs/superpowers/specs/2026-08-02-multi-tenant-user-manager-ui-design.md` only if implementation changes an approved decision

- [ ] **Step 1: Update the Central User Manager section**

Document the server-only registry, the browser-safe tenant key, the explicit binding-per-tenant deployment requirement, and that only configured tenants are visible.

- [ ] **Step 2: Run full verification**

Run: `npm.cmd run test; npm.cmd run typecheck; npm.cmd run lint`

Expected: all tests pass with no typecheck or lint errors.

- [ ] **Step 3: Build and deploy only after explicit deployment approval**

Run with non-secret environment values supplied securely: `npm.cmd run build`, then the staging target guard, OpenNext build, Wrangler dry-run, and deploy with `CLOUDFLARE_ACCOUNT_ID=0df55f166fa309dcc904e992c43f86db` and `OPEN_NEXT_DEPLOY=true`.

- [ ] **Step 4: Verify remote boundaries**

Confirm `/login` returns 200, anonymous `/admin/user-manager` redirects, `wrangler secret list` shows only names, and the three retired Tenant HTTP paths return 404.

### Task 5: Immediate Tenant loading and fixed pagination

**Files:**
- Modify: `components/admin/user-manager/user-manager-page.tsx`
- Create: `components/admin/user-manager/user-list-request.ts`
- Modify: `tests/central-user-manager-page.test.ts`
- Create: `tests/central-user-manager-list-request.test.ts`

**Interfaces:**
- Consumes: `listCentralUsersAction(FormData)` and a browser-safe Tenant key.
- Produces: a selected-Tenant list request with `{ tenantKey, operationId, page, pageSize: 10 }`, automatic loading on initial/changed Tenant selection, and bounded adjacent-page controls.

- [x] **Step 1: Write the failing UI test**

```ts
import { createCentralUserListFormData } from "../components/admin/user-manager/user-list-request.ts";

it("builds a ten-user request for the selected Tenant and requested page", () => {
  const formData = createCentralUserListFormData({
    tenantKey: "baan-pool-villa-staging",
    page: 2,
    operationId: "123e4567-e89b-42d3-a456-426614174000",
  });
  assert.deepEqual(Object.fromEntries(formData), {
    tenantKey: "baan-pool-villa-staging",
    page: "2",
    pageSize: "10",
    operationId: "123e4567-e89b-42d3-a456-426614174000",
  });
});

it("renders automatic selection loading and bounded previous/next controls", () => {
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /ก่อนหน้า/);
  assert.match(source, /ถัดไป/);
  assert.match(source, /disabled=\{listPending \|\| listed\.pagination\.page === 1\}/);
  assert.match(source, /disabled=\{listPending \|\| !listed\.pagination\.hasMore\}/);
  assert.doesNotMatch(source, /name="pageSize"/);
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd test -- tests/central-user-manager-page.test.ts`

Expected: FAIL because the current UI has manual page/page-size inputs and no automatic request or paging controls.

- [x] **Step 3: Implement the smallest client-side list loader**

```ts
const LIST_PAGE_SIZE = 10;

function loadUsers(tenantKey: string, page: number) {
  const formData = createCentralUserListFormData({
    tenantKey,
    page,
    operationId: crypto.randomUUID(),
  });
  startTransition(async () => {
    const result = await listCentralUsersAction(formData);
    if (result.ok) setListed(result.operation);
    else setListError(result.error.message);
  });
}

useEffect(() => {
  if (selectedKey) loadUsers(selectedKey, 1);
}, [selectedKey]);
```

`createCentralUserListFormData` must put the literal string values
`tenantKey`, `page`, `pageSize: "10"`, and `operationId` into a new
`FormData`. Remove `OperationForm`; selecting a Tenant only updates
`selectedKey`. Render a loading status while the list request is pending,
retain a completed list until the replacement arrives, and place Previous/Next
below the list. Each page button calls `loadUsers(selectedKey,
listed.pagination.page ± 1)` with guards matching its disabled state.

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `npm.cmd test -- tests/central-user-manager-page.test.ts tests/central-user-manager-list-request.test.ts`

Expected: PASS with automatic Tenant load, fixed ten-user payload, and bounded navigation assertions.

- [x] **Step 5: Run the relevant regression suite**

Run: `npm.cmd test -- tests/central-user-manager-page.test.ts tests/central-user-manager-list-request.test.ts tests/central-user-manager-actions.test.ts tests/central-user-manager-contracts.test.ts`

Expected: PASS; the page retains its browser-safe Tenant-key boundary and the server continues to validate pagination.
