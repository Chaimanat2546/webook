# Central User Manager Tenant Reactivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely reactivate an inactive, previously completed Tenant with its existing stored Bearer only after fresh health and list proofs.

**Architecture:** Add a proof-bound database reactivation gate, a focused server service and authenticated POST route, then expose the recovery state/action in the existing User Manager UI. Reuse the encrypted-token repository and Agent client; keep the token server-only and fail closed at every boundary.

**Tech Stack:** PostgreSQL/Supabase migrations and RPCs, Next.js 16 App Router, TypeScript, React, Vitest, Testing Library.

## Global Constraints

- Do not rotate or expose the retained Tenant Bearer token.
- Do not deploy the Tenant Agent as part of reactivation.
- Only a role-1 Central User Manager administrator may start the flow.
- Activation requires fresh successful health and `list_users` proofs for the exact stored token version and reactivation attempt UUID.
- Any failure leaves the Tenant inactive and returns only a safe error.
- Preserve existing user changes and do not commit without explicit user approval.

---

### Task 1: Proof-bound database reactivation

**Files:**
- Create: `supabase/migrations/<timestamp>_central_user_manager_tenant_reactivation.sql`
- Modify: `server/repositories/customer-projects.ts`
- Test: `server/repositories/customer-projects.test.ts`
- Test: `scripts/central-user-manager/provision-tenant.test.ts`

**Interfaces:**
- Produces `beginCustomerProjectReactivation(client, input)`.
- Produces `activateCustomerProjectAfterReverification(client, input)`.
- Extends `ProvisioningCustomerProject.provisioningState` with `reactivation_verifying`.

- [ ] Write failing repository/migration contract tests for exact inactive-completed eligibility, no pending operations, stale-proof clearing, attempt UUID binding, idempotent retry, verification-state acceptance, fresh dual-proof activation, audit, and privileges.
- [ ] Run the focused tests and confirm failure because the RPCs/state do not exist.
- [ ] Add the minimal migration and repository adapters.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Server reactivation service and route

**Files:**
- Create: `server/services/central-user-manager-reactivation.ts`
- Create: `server/services/central-user-manager-reactivation.test.ts`
- Create: `app/api/admin/user-manager/projects/reactivate/route.ts`
- Create: `app/api/admin/user-manager/projects/reactivate/route.test.ts`
- Modify: `server/repositories/customer-projects.ts`

**Interfaces:**
- Produces `reactivateCustomerProject(input, dependencies)`.
- Route consumes exact JSON `{ tenantId: string }`.
- Route returns `{ ok: true, health }` or the existing safe error envelope.

- [ ] Write failing service tests proving begin → decrypt → health → record → list → record → activate ordering and short-circuit behavior.
- [ ] Run the service test and confirm the missing service failure.
- [ ] Implement the minimal service using existing Agent and token-vault owners.
- [ ] Run the service test and confirm it passes.
- [ ] Write failing route tests for origin/auth/body order, success, and safe failures.
- [ ] Run the route test and confirm the route is missing.
- [ ] Implement the route using established User Manager route helpers.
- [ ] Run service and route tests and confirm they pass.

### Task 3: Recovery state and action in the UI

**Files:**
- Modify: `components/admin/user-manager/types.ts`
- Modify: `components/admin/user-manager/view-model.ts`
- Modify: `components/admin/user-manager/project-list.tsx`
- Modify: `components/admin/user-manager/status-panel.tsx`
- Modify: `components/admin/user-manager/use-user-manager.ts`
- Modify: `components/admin/user-manager/user-manager-page.tsx`
- Test: existing tests under `components/admin/user-manager/`

**Interfaces:**
- Adds lifecycle `reactivation_required`.
- Adds hook action `reactivateProject()`.
- Successful action updates local project/health state and loads page 1.

- [ ] Write failing view-model/component/hook tests for the label, selection, explicit button, safe failure, and success transition.
- [ ] Run focused UI tests and confirm they fail for the missing lifecycle/action.
- [ ] Implement the minimal state, UI, and POST integration.
- [ ] Run focused UI tests and confirm they pass.

### Task 4: Documentation, review, and verification

**Files:**
- Modify: `docs/ai/structure.html`
- Modify: `docs/central-user-manager.md`

**Interfaces:**
- Documents the operational recovery boundary and targeted verification commands.

- [ ] Update architecture/runbook documentation without exposing project credentials.
- [ ] Run all focused database, repository, service, route, and UI tests.
- [ ] Run targeted ESLint, TypeScript, and `npm.cmd run build`.
- [ ] Request read-only security/state-machine review and address findings test-first.

### Task 5: Staging rollout and E2E

**Files:**
- No additional source files expected.

**Interfaces:**
- Central staging database and `webook-admin-staging` Worker.

- [ ] Apply only the new migration to the linked Central staging project and record migration history.
- [ ] Deploy the verified `webook` build to staging.
- [ ] Invoke the explicit reactivation flow for the affected Tenant.
- [ ] Confirm active/healthy state, fresh verification timestamps, successful user listing, and no leaked token.
