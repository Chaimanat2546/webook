import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCentralUserHealthHandler,
  createCentralUserManagerMethodNotAllowedHandler,
  createCentralUserOperationsHandler,
  createCentralUserReconcileHandler,
  centralUserManagerMethodNotAllowed,
} from "../server/central-user-manager/api-response.ts";
import { CentralUserManagerAuthorizationError } from "../server/auth/central-user-manager-admin.ts";
import { createSafeCentralUserError } from "../server/central-user-manager/safe-errors.ts";
import {
  checkCentralUserManagerHealth,
  type CentralUserManagerServiceResult,
} from "../server/services/central-user-manager.ts";
import type { ActiveCustomerProject } from "../server/repositories/customer-projects.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_UID = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "A1!bcdefghijklmnopqr";
const SAFE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  expires: "0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
const operationBody = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  action: "create_user",
  payload: { email: "admin@example.com" },
};
const safeUser = {
  userId: "44444444-4444-4444-8444-444444444444",
  email: "admin@example.com",
  status: "password_change_required" as const,
  createdAt: null,
  lastSignInAt: null,
  credentialVersion: 1,
  authCredentialVersion: 1,
};
const activeProject: ActiveCustomerProject = {
  tenantId: TENANT_ID,
  targetSupabaseProjectRef: "abc123def456ghi789jk",
  agentOrigin: "https://tenant.example.com",
  wranglerEnvironment: "production",
  bearerTokenCiphertext: "A".repeat(64),
  bearerTokenIv: "B".repeat(16),
  bearerTokenVersion: 1,
  bearerTokenKekVersion: 1,
  bearerTokenFingerprint: "c".repeat(64),
  expectedAgentVersion: "1.0.0",
  expectedSchemaVersion: "20260729",
  authAttestationVersion: "v1",
  authAttestationDigest: "a".repeat(64),
  authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
};

function jsonRequest(
  url: string,
  body: unknown = operationBody,
  headers: HeadersInit = { "content-type": "application/json" },
): Request {
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function completed(
  includePassword = false,
): CentralUserManagerServiceResult {
  return {
    ok: true,
    operation: {
      operationId: OPERATION_ID,
      status: "completed",
      agentStage: "completed",
      safeResult: { user: safeUser },
      safeErrorCode: null,
      ...(includePassword ? { temporaryPassword: PASSWORD } : {}),
    },
  };
}

function assertSafeHeaders(response: Response): void {
  for (const [name, value] of Object.entries(SAFE_HEADERS)) {
    assert.equal(response.headers.get(name), value, `missing ${name}`);
  }
  assert.equal(response.headers.get("location"), null);
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

describe("Central User Manager API response boundary", () => {
  it("authenticates before parsing and maps authorization failures safely", async () => {
    for (const scenario of [
      { code: "unauthorized" as const, status: 401 },
      { code: "forbidden" as const, status: 403 },
      { code: "service_unavailable" as const, status: 503 },
    ]) {
      let executions = 0;
      const handler = createCentralUserOperationsHandler({
        async authorize() {
          throw new CentralUserManagerAuthorizationError(scenario.code);
        },
        async execute() {
          executions += 1;
          return completed();
        },
      });

      const response = await handler(
        new Request("https://webook.test/api/admin/user-manager/operations", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "not-json",
        }),
      );

      assert.equal(response.status, scenario.status);
      assert.equal(executions, 0);
      assertSafeHeaders(response);
      const text = await response.text();
      assert.equal(text.includes("Central User Manager authorization failed"), false);
    }
  });

  it("rejects non-exact content type and oversized or malformed bodies", async () => {
    let executions = 0;
    const handler = createCentralUserOperationsHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async execute() {
        executions += 1;
        return completed();
      },
    });

    for (const contentType of [
      null,
      "application/json; charset=utf-8",
      "Application/JSON",
      "text/json",
    ]) {
      const headers: HeadersInit = contentType
        ? { "content-type": contentType }
        : {};
      const response = await handler(
        jsonRequest(
          "https://webook.test/api/admin/user-manager/operations",
          operationBody,
          headers,
        ),
      );
      assert.equal(response.status, 415);
      assertSafeHeaders(response);
    }

    const advertisedOversize = await handler(
      jsonRequest(
        "https://webook.test/api/admin/user-manager/operations",
        operationBody,
        {
          "content-type": "application/json",
          "content-length": "16385",
        },
      ),
    );
    assert.equal(advertisedOversize.status, 413);

    const streamedOversize = await handler(
      new Request("https://webook.test/api/admin/user-manager/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `"${"x".repeat(16_384)}"`,
      }),
    );
    assert.equal(streamedOversize.status, 413);

    for (const request of [
      new Request("https://webook.test/api/admin/user-manager/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      jsonRequest(
        "https://webook.test/api/admin/user-manager/operations",
        { ...operationBody, actorUid: ACTOR_UID },
      ),
      jsonRequest(
        "https://webook.test/api/admin/user-manager/operations",
        { ...operationBody, unexpected: true },
      ),
    ]) {
      const response = await handler(request);
      assert.equal(response.status, 422);
      assertSafeHeaders(response);
    }
    assert.equal(executions, 0);
  });

  it("cancels rejected request streams without changing the intended status", async () => {
    const handler = createCentralUserOperationsHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async execute() {
        throw new Error("must not execute");
      },
    });

    for (const scenario of [
      {
        headers: { "content-type": "text/plain" },
        expectedStatus: 415,
      },
      {
        headers: {
          "content-type": "application/json",
          "content-length": "16385",
        },
        expectedStatus: 413,
      },
    ]) {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      const request = new Request(
        "https://webook.test/api/admin/user-manager/operations",
        {
          method: "POST",
          headers: scenario.headers,
          body: stream,
          duplex: "half",
        } as RequestInit & { duplex: "half" },
      );
      const response = await handler(request);
      assert.equal(response.status, scenario.expectedStatus);
      assert.equal(cancelled, true);
    }

    const rejectingCancel = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16_385));
      },
      cancel() {
        throw new Error("cancel failed");
      },
    });
    const overCap = await handler(
      new Request(
        "https://webook.test/api/admin/user-manager/operations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: rejectingCancel,
          duplex: "half",
        } as RequestInit & { duplex: "half" },
      ),
    );
    assert.equal(overCap.status, 413);
  });

  it("binds the verified actor and returns a password only on first completed response", async () => {
    let receivedActorUid: string | null = null;
    const handler = createCentralUserOperationsHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async execute(request) {
        receivedActorUid = request.actorUid;
        const result = completed(true);
        if (result.ok && result.operation.safeResult && "user" in result.operation.safeResult) {
          Object.assign(result.operation.safeResult.user, {
            providerRaw: "raw provider error",
          });
        }
        return {
          ...result,
          agentOrigin: "https://tenant.example.com",
          bearerTokenCiphertext: "secret",
        } as unknown as CentralUserManagerServiceResult;
      },
    });

    const response = await handler(
      jsonRequest("https://webook.test/api/admin/user-manager/operations"),
    );
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(receivedActorUid, ACTOR_UID);
    assert.equal(text.includes(PASSWORD), true);
    assert.equal(text.includes("tenant.example.com"), false);
    assert.equal(text.includes("bearerTokenCiphertext"), false);
    assert.equal(text.includes("raw provider error"), false);
    assertSafeHeaders(response);

    const retryHandler = createCentralUserOperationsHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async execute() {
        return completed(false);
      },
    });
    const retry = await retryHandler(
      jsonRequest("https://webook.test/api/admin/user-manager/operations"),
    );
    assert.equal((await retry.text()).includes("temporaryPassword"), false);
  });

  it("maps conflicts, ambiguity, provider failure, and nonterminal states", async () => {
    for (const scenario of [
      {
        result: {
          ok: false,
          error: createSafeCentralUserError("operation_conflict"),
        } as CentralUserManagerServiceResult,
        status: 409,
      },
      {
        result: {
          ok: false,
          error: createSafeCentralUserError("project_unavailable"),
        } as CentralUserManagerServiceResult,
        status: 503,
      },
      {
        result: {
          ok: true,
          operation: {
            operationId: OPERATION_ID,
            status: "needs_review",
            agentStage: null,
            safeResult: null,
            safeErrorCode: "operation_ambiguous",
          },
        } as CentralUserManagerServiceResult,
        status: 409,
      },
    ]) {
      const handler = createCentralUserOperationsHandler({
        async authorize() {
          return { actorUid: ACTOR_UID };
        },
        async execute() {
          return scenario.result;
        },
      });
      const response = await handler(
        jsonRequest("https://webook.test/api/admin/user-manager/operations"),
      );
      assert.equal(response.status, scenario.status);
      assertSafeHeaders(response);
    }
  });

  it("rebuilds operation and health errors from the safe catalog", async () => {
    const rawMessage = "Bearer secret and raw provider response";
    const operationHandler = createCentralUserOperationsHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async execute() {
        return {
          ok: false,
          error: { code: "provider_failure", message: rawMessage },
        };
      },
    });
    const operationResponse = await operationHandler(
      jsonRequest("https://webook.test/api/admin/user-manager/operations"),
    );
    const operationText = await operationResponse.text();
    assert.equal(operationResponse.status, 503);
    assert.equal(operationText.includes(rawMessage), false);
    assert.equal(operationText.includes("Unable to complete request."), true);

    const healthHandler = createCentralUserHealthHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async checkHealth() {
        return {
          ok: false,
          error: { code: "provider_failure", message: rawMessage },
        };
      },
    });
    const healthResponse = await healthHandler(
      new Request(
        `https://webook.test/api/admin/user-manager/health?tenantId=${TENANT_ID}`,
      ),
    );
    const healthText = await healthResponse.text();
    assert.equal(healthResponse.status, 503);
    assert.equal(healthText.includes(rawMessage), false);
    assert.equal(healthText.includes("Unable to complete request."), true);
  });

  it("requires reconcile path and body operation IDs to match and never returns a password", async () => {
    let executions = 0;
    const handler = createCentralUserReconcileHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async reconcile() {
        executions += 1;
        return completed(true);
      },
    });

    const mismatch = await handler(
      jsonRequest(
        `https://webook.test/api/admin/user-manager/operations/99999999-9999-4999-8999-999999999999/reconcile`,
      ),
      Promise.resolve({
        operationId: "99999999-9999-4999-8999-999999999999",
      }),
    );
    assert.equal(mismatch.status, 422);
    assert.equal(executions, 0);

    const response = await handler(
      jsonRequest(
        `https://webook.test/api/admin/user-manager/operations/${OPERATION_ID}/reconcile`,
      ),
      Promise.resolve({ operationId: OPERATION_ID }),
    );
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.equal(executions, 1);
    assert.equal(text.includes(PASSWORD), false);
    assert.equal(text.includes("temporaryPassword"), false);
    assertSafeHeaders(response);
  });

  it("accepts one canonical health tenant query and projects only safe fields", async () => {
    let checks = 0;
    const handler = createCentralUserHealthHandler({
      async authorize() {
        return { actorUid: ACTOR_UID };
      },
      async checkHealth(tenantId) {
        checks += 1;
        assert.equal(tenantId, TENANT_ID);
        return {
          ok: true,
          health: {
            tenantId,
            status: "healthy",
            agentVersion: "1.0.0",
            schemaVersion: "20260729",
            authAttestationVersion: "v1",
            authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
          },
          projectRef: "abc123def456ghi789jk",
          authAttestationDigest: "a".repeat(64),
        };
      },
    });

    for (const query of [
      "",
      `?tenantId=${TENANT_ID}&tenantId=${TENANT_ID}`,
      `?tenantId=${TENANT_ID}&extra=1`,
      "?tenantId=not-a-uuid",
    ]) {
      const response = await handler(
        new Request(
          `https://webook.test/api/admin/user-manager/health${query}`,
        ),
      );
      assert.equal(response.status, 422);
      assertSafeHeaders(response);
    }

    const response = await handler(
      new Request(
        `https://webook.test/api/admin/user-manager/health?tenantId=${TENANT_ID}`,
      ),
    );
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.equal(checks, 1);
    assert.equal(text.includes("abc123def456ghi789jk"), false);
    assert.equal(text.includes("authAttestationDigest"), false);
    assertSafeHeaders(response);
  });

  it("checks and records active Tenant health without returning trust-sensitive proof", async () => {
    const calls: string[] = [];
    const result = await checkCentralUserManagerHealth(TENANT_ID, {
      async findActiveProject() {
        calls.push("lookup");
        return activeProject;
      },
      async getHealth() {
        calls.push("health");
        return {
          kind: "success",
          data: {
            protocolVersion: 1,
            tenantId: TENANT_ID,
            projectRef: activeProject.targetSupabaseProjectRef,
            agentVersion: "1.0.0",
            schemaVersion: "20260729",
            authAttestationVersion: "v1",
            authAttestationDigest: activeProject.authAttestationDigest,
            authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
          },
        };
      },
      async recordVerification(input) {
        calls.push("record");
        assert.equal(input.tokenVersion, 1);
        assert.equal(input.succeeded, true);
        return true;
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["lookup", "health", "record"]);
    assert.equal(JSON.stringify(result).includes("projectRef"), false);
    assert.equal(JSON.stringify(result).includes("Digest"), false);
  });

  it("fails closed for inactive Tenant and health-record persistence failure", async () => {
    let healthCalls = 0;
    const inactive = await checkCentralUserManagerHealth(TENANT_ID, {
      async findActiveProject() {
        return null;
      },
      async getHealth() {
        healthCalls += 1;
        throw new Error("must not run");
      },
      async recordVerification() {
        throw new Error("must not run");
      },
    });
    assert.equal(inactive.ok, false);
    if (!inactive.ok) {
      assert.equal(inactive.error.code, "project_unavailable");
    }
    assert.equal(healthCalls, 0);

    const notRecorded = await checkCentralUserManagerHealth(TENANT_ID, {
      async findActiveProject() {
        return activeProject;
      },
      async getHealth() {
        return {
          kind: "failure",
          error: createSafeCentralUserError("project_unavailable"),
        };
      },
      async recordVerification(input) {
        assert.equal(input.succeeded, false);
        assert.equal(input.health, null);
        return false;
      },
    });
    assert.equal(notRecorded.ok, false);
    if (!notRecorded.ok) {
      assert.equal(notRecorded.error.code, "provider_failure");
    }
  });

  it("returns hardened custom method-not-allowed responses", async () => {
    const response = centralUserManagerMethodNotAllowed("POST");
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    assertSafeHeaders(response);
    assert.deepEqual(await responseJson(response), {
      ok: false,
      error: {
        code: "method_not_allowed",
        message: "Method not allowed.",
      },
    });

    let authCalls = 0;
    const reject = createCentralUserManagerMethodNotAllowedHandler(
      {
        async authorize() {
          authCalls += 1;
          throw new CentralUserManagerAuthorizationError("unauthorized");
        },
      },
      "POST",
    );
    const denied = await reject(
      new Request("https://webook.test/api/admin/user-manager/operations"),
    );
    assert.equal(authCalls, 1);
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get("allow"), null);
    assertSafeHeaders(denied);

    const allowedReject = createCentralUserManagerMethodNotAllowedHandler(
      {
        async authorize() {
          authCalls += 1;
          return { actorUid: ACTOR_UID };
        },
      },
      "POST",
    );
    const rejected = await allowedReject(
      new Request("https://webook.test/api/admin/user-manager/operations"),
    );
    assert.equal(authCalls, 2);
    assert.equal(rejected.status, 405);
    assert.equal(rejected.headers.get("allow"), "POST");
    assertSafeHeaders(rejected);
  });
});
