# Central User Manager Tenant Reactivation Design

## Problem

An active Tenant is deactivated fail-closed when an authenticated health check
fails. The database deliberately keeps its stored Bearer token and
`provisioning_state = 'completed'`, but the current UI derives every inactive
Tenant with no verified token as `provisioning`. Selecting it cannot run health
or list operations because normal dispatch requires an active Tenant. There is
no safe path to verify the retained credential and activate the Tenant again.

## Outcome

A central administrator can explicitly select an inactive, previously completed
Tenant, run a recovery verification with its existing encrypted Bearer token,
and reactivate it only after fresh authenticated health and `list_users` proofs
both succeed. The flow does not rotate the token or deploy the Tenant Agent.

## State and Database Contract

Add the provisioning state `reactivation_verifying` plus nullable
`reactivation_attempt_id` and `reactivation_started_at` fields. Both fields are
present only while that state is active.

`begin_customer_project_reactivation` is a service-role-only, audited RPC. It
accepts only an inactive Tenant with `provisioning_state = 'completed'`, a
stored positive token version, and no dispatchable Central User Manager
operations. It clears prior health/list verification fields, creates one
cryptographic attempt UUID, moves the Tenant to `reactivation_verifying`, and
records an audit event. Calling it again for the same inactive Tenant and token
version returns the existing attempt as an idempotent retry and does not
activate the Tenant.

A dedicated verification recorder accepts only an inactive
`reactivation_verifying` row with the exact attempt UUID and token version.
Health identity must match the exact Tenant, target project, Agent/schema
versions, and Auth attestation. A failed check leaves the Tenant inactive.

`activate_customer_project_after_reverification` is a separate
service-role-only, audited RPC. It accepts only an inactive
`reactivation_verifying` Tenant whose attempt UUID and stored token version
equal the verification generation and whose fresh health and list timestamps
are both newer than the reactivation start/token timestamps. It sets
`is_active = true`, restores `provisioning_state = 'completed'`, and records
the activation audit atomically. Completing or replacing one attempt makes
every stale concurrent attempt fail closed.

Private implementations remain inaccessible to API roles. Public wrappers are
executable only by `service_role`.

## Server Flow

Add a focused reactivation service with injected repository and Agent
dependencies:

1. Authorize a Central User Manager administrator.
2. Begin or resume the reactivation gate.
3. Read and decrypt the existing stored token server-side.
4. Call authenticated Agent health and record its exact result.
5. Call bounded `list_users` (`page=1`, `pageSize=1`) and record its result.
6. Activate through the proof-bound RPC.
7. Return only safe Tenant health/status data.

The Bearer token stays request-local and is never returned, logged, audited, or
placed in a browser request. Transport, provider, malformed response, proof
mismatch, and persistence failures return a safe `project_unavailable` or
`provider_failure` response while the Tenant remains inactive.

Expose the flow as authenticated `POST
/api/admin/user-manager/projects/reactivate` with exact JSON
`{ "tenantId": "<uuid>" }`. Mutation-origin validation and central-admin
authorization run before persistence or Agent access.

## UI

Expose the safe `provisioningState` field in the project list contract.
Inactive `completed` or `reactivation_verifying` Tenants display
`ต้องเปิดใช้งานใหม่`, not `กำลังตั้งค่า`.

Selecting such a Tenant remains possible and shows a
`ตรวจสอบและเปิดใช้งานอีกครั้ง` button in the status panel. While the request is
running, Tenant selection and mutation controls are disabled consistently.
On success, the selected Tenant becomes active/healthy in local state and the
first user page loads. On failure, it stays selected and inactive with a safe
Thai error message.

## Verification

- Migration behavior tests cover the new state, exact eligibility, clearing
  stale proofs, service-role privileges, idempotent retry, failed checks, fresh
  dual-proof activation, and rejection of pending operations or mismatched
  token versions.
- Repository/service tests cover decrypt-in-process, exact health/list order,
  fail-closed short-circuiting, safe outputs, and no activation after either
  failed proof.
- Route tests cover origin/auth/body validation order and safe errors.
- Component/hook tests cover the corrected label, selectable inactive Tenant,
  explicit button, busy/error state, and success transition.
- Run focused tests, ESLint on touched files, TypeScript, and production build.
- On staging, apply the migration, deploy `webook`, invoke the recovery button,
  and confirm the Tenant becomes healthy and its user list loads.
