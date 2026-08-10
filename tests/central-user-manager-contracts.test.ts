import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCentralUserRpcRequest } from "../server/central-user-manager/contracts.ts";
import { parseTenantCentralUserRpcResult, projectBrowserCentralUserResult } from "../server/central-user-manager/tenant-result.ts";

const request = {
  protocolVersion: 1 as const,
  tenantId: "2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb",
  operationId: "123e4567-e89b-42d3-a456-426614174001",
  actorUid: "123e4567-e89b-42d3-a456-426614174002",
  action: "create_user" as const,
  payload: { email: " admin@example.com " },
};

describe("central user manager wire contract", () => {
  it("canonicalizes exact supported requests", () => {
    assert.deepEqual(parseCentralUserRpcRequest(request), { ...request, payload: { email: "admin@example.com" } });
    assert.throws(() => parseCentralUserRpcRequest({ ...request, ignored: true }));
    assert.throws(() => parseCentralUserRpcRequest({ ...request, tenantId: "wrong" }));
  });

  it("validates a real Tenant list envelope and projects private fields away", () => {
    const parsed = parseCentralUserRpcRequest(request);
    const listRequest = parseCentralUserRpcRequest({ ...parsed, action: "list_users", payload: { page: 1, pageSize: 20 } });
    const tenant = parseTenantCentralUserRpcResult({ ok: true, operation: { operationId: listRequest.operationId, status: "completed", stage: "listed", result: { users: [{ userId: "123e4567-e89b-42d3-a456-426614174003", email: "admin@example.com", status: "active", createdAt: null, lastSignInAt: null, credentialVersion: 1, authCredentialVersion: 1 }], pagination: { page: 1, pageSize: 20, hasMore: false } } } }, listRequest);
    const browser = projectBrowserCentralUserResult(tenant);
    assert.deepEqual(browser, { ok: true, operation: { operationId: listRequest.operationId, status: "completed", users: [{ email: "admin@example.com", status: "active" }], pagination: { page: 1, pageSize: 20, hasMore: false } } });
    assert.doesNotMatch(JSON.stringify(browser), /userId|credentialVersion|createdAt/);
  });

  it("rejects an unrecognized Tenant stage and never projects an error message", () => {
    const parsed = parseCentralUserRpcRequest(request);
    const result = parseTenantCentralUserRpcResult({ ok: true, operation: { operationId: parsed.operationId, status: "in_progress", stage: "unknown", error: { code: "provider_error", message: "private provider details" } } }, parsed);
    assert.deepEqual(result, { ok: false, error: { code: "agent_unavailable", message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } });
  });

  it("accepts and safely projects a rejected lifecycle transition", () => {
    const lifecycleRequest = parseCentralUserRpcRequest({
      ...request,
      action: "reissue_temporary_password",
      payload: { email: "admin@example.com" },
    });
    const error = {
      code: "invalid_lifecycle_transition",
      message: "This action is not available for the user's current status.",
    };
    const tenant = parseTenantCentralUserRpcResult({
      ok: true,
      operation: {
        operationId: lifecycleRequest.operationId,
        status: "rejected",
        stage: "rejected",
        error,
      },
    }, lifecycleRequest);

    assert.deepEqual(projectBrowserCentralUserResult(tenant), {
      ok: true,
      operation: {
        operationId: lifecycleRequest.operationId,
        status: "rejected",
        error,
      },
    });
  });

  it("rejects completed responses whose status, stage, or safe error invariant disagrees", () => {
    const parsed = parseCentralUserRpcRequest(request);
    const invalidStage = parseTenantCentralUserRpcResult({ ok: true, operation: { operationId: parsed.operationId, status: "completed", stage: "listed", result: { user: { userId: "123e4567-e89b-42d3-a456-426614174003", email: "admin@example.com", status: "password_change_required", createdAt: null, lastSignInAt: null, credentialVersion: 1, authCredentialVersion: 1 } } } }, parsed);
    const privateError = parseTenantCentralUserRpcResult({ ok: true, operation: { operationId: parsed.operationId, status: "in_progress", stage: "claimed", error: { code: "provider_failure", message: "private details" } } }, parsed);
    assert.equal(invalidStage.ok, false);
    assert.equal(privateError.ok, false);
  });

  it("keeps only Tenant's exact top-level error classification", () => {
    const invalid = parseTenantCentralUserRpcResult({ ok: false, error: { code: "invalid_request", message: "Invalid user management request." } }, parseCentralUserRpcRequest(request));
    const forged = parseTenantCentralUserRpcResult({ ok: false, error: { code: "invalid_request", message: "private details" } }, parseCentralUserRpcRequest(request));
    assert.deepEqual(invalid, { ok: false, error: { code: "invalid_request", message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } });
    assert.deepEqual(forged, { ok: false, error: { code: "agent_unavailable", message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } });
  });
});
