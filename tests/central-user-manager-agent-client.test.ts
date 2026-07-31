import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAgentHealth,
  logAgentOutboundDiagnostic,
  sendAgentOperation,
} from "../server/central-user-manager/agent-client.ts";
import type { AgentOperationRequest } from "../server/central-user-manager/contracts.ts";
import type { ActiveCustomerProject } from "../server/repositories/customer-projects.ts";

const TOKEN = "A".repeat(43);
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_UID = "33333333-3333-4333-8333-333333333333";

const project: ActiveCustomerProject = {
  tenantId: TENANT_ID,
  targetSupabaseProjectRef: "abc123def456ghi789jk",
  agentOrigin: "https://tenant.example.com",
  wranglerEnvironment: "production",
  bearerTokenCiphertext: "B".repeat(64),
  bearerTokenIv: "C".repeat(16),
  bearerTokenVersion: 2,
  bearerTokenKekVersion: 1,
  bearerTokenFingerprint: "d".repeat(64),
  expectedAgentVersion: "1.0.0",
  expectedSchemaVersion: "20260729",
  authAttestationVersion: "v1",
  authAttestationDigest: "a".repeat(64),
  authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
};

const listRequest: AgentOperationRequest = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "list_users",
  payload: { page: 1, pageSize: 25 },
};

const createRequest: AgentOperationRequest = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "create_user",
  payload: { email: "admin@example.com" },
};

const safeUser = {
  userId: "44444444-4444-4444-8444-444444444444",
  email: "admin@example.com",
  status: "password_change_required",
  createdAt: "2026-07-30T00:00:00.000Z",
  lastSignInAt: null,
  credentialVersion: 1,
  authCredentialVersion: 1,
};

function healthBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    protocolVersion: 1,
    tokenVersion: 2,
    projectRef: "abc123def456ghi789jk",
    agentVersion: "1.0.0",
    schemaVersion: "20260729",
    checks: {
      database: "ok",
      adminUsersTable: "ok",
      operationTables: "ok",
    },
    authAttestation: {
      version: "v1",
      digest: "a".repeat(64),
      checkedAt: "2026-07-29T00:00:00.000Z",
    },
    ...overrides,
  };
}

function operationBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    protocolVersion: 1,
    operationId: OPERATION_ID,
    status: "completed",
    stage: "completed",
    result: { user: safeUser },
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = { status: 200 },
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(new Headers(init.headers)),
    },
  });
}

function dependencies(fetchImpl: typeof fetch) {
  return {
    fetch: fetchImpl,
    decryptToken: async (record: ActiveCustomerProject) => {
      assert.equal(record.tenantId, TENANT_ID);
      return TOKEN;
    },
  };
}

describe("Central User Manager Agent client", () => {
  it("calls exact health URL and returns only a matched health proof", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return jsonResponse(healthBody());
    };

    const result = await getAgentHealth(project, dependencies(fetchImpl));

    assert.equal(result.kind, "success");
    assert.equal(requestUrl, "https://tenant.example.com/api/internal/central-user-manager/v1/health");
    assert.equal(requestInit?.method, "GET");
    assert.equal(requestInit?.redirect, "manual");
    assert.equal(requestInit?.cache, "no-store");
    const headers = new Headers(requestInit?.headers);
    assert.equal(headers.get("Authorization"), `Bearer ${TOKEN}`);
    assert.equal(headers.get("X-CUM-Version"), "1");
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(JSON.stringify(result).includes(TOKEN), false);
  });

  it("rejects every mismatched health identity field", async () => {
    const mismatches = [
      { tenantId: "55555555-5555-4555-8555-555555555555" },
      { protocolVersion: 2 },
      { tokenVersion: 3 },
      { projectRef: "zzz123def456ghi789jk" },
      { agentVersion: "2.0.0" },
      { schemaVersion: "wrong" },
      { checks: { database: "bad", adminUsersTable: "ok", operationTables: "ok" } },
      { authAttestation: { ...healthBody().authAttestation, digest: "b".repeat(64) } },
    ];

    for (const mismatch of mismatches) {
      const fetchImpl: typeof fetch = async () =>
        jsonResponse(healthBody(mismatch));
      const result = await getAgentHealth(project, dependencies(fetchImpl));
      assert.equal(result.kind, "failure");
      assert.equal(result.error.code, "provider_failure");
    }
  });

  it("sends an exact mutation and separates the one-time password from safe result", async () => {
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestInit = init;
      return jsonResponse(
        operationBody({
          result: {
            user: safeUser,
            temporaryPassword: "A1!bcdefghijklmnopqr",
          },
        }),
      );
    };

    const result = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );

    assert.equal(result.kind, "response");
    assert.equal(requestInit?.method, "POST");
    assert.equal(
      requestInit?.body,
      JSON.stringify(createRequest),
    );
    assert.equal(
      new Headers(requestInit?.headers).get("Content-Type"),
      "application/json",
    );
    if (result.kind === "response") {
      assert.equal(result.temporaryPassword, "A1!bcdefghijklmnopqr");
      assert.deepEqual(result.safeResult, { user: safeUser });
      assert.equal(
        JSON.stringify(result.safeResult).includes("temporaryPassword"),
        false,
      );
    }
  });

  it("accepts a bounded list result tied to the requested page", async () => {
    const listedUser = { ...safeUser, status: "active" };
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        operationBody({
          stage: "listed",
          result: {
            users: [listedUser],
            pagination: { page: 1, pageSize: 25, hasMore: false },
          },
        }),
      );

    const result = await sendAgentOperation(
      project,
      listRequest,
      dependencies(fetchImpl),
    );

    assert.equal(result.kind, "response");
    if (result.kind === "response") {
      assert.deepEqual(result.safeResult, {
        users: [listedUser],
        pagination: { page: 1, pageSize: 25, hasMore: false },
      });
      assert.equal(result.temporaryPassword, undefined);
    }
  });

  it("classifies transport failure as ambiguous only after mutation dispatch", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("network detail containing secret");
    };

    const mutation = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );
    const list = await sendAgentOperation(
      project,
      listRequest,
      dependencies(fetchImpl),
    );
    const health = await getAgentHealth(project, dependencies(fetchImpl));

    assert.equal(mutation.kind, "ambiguous");
    assert.equal(mutation.error.code, "operation_ambiguous");
    assert.equal(list.kind, "failure");
    assert.equal(health.kind, "failure");
    assert.doesNotMatch(JSON.stringify([mutation, list, health]), /secret/);
  });

  it("diagnoses token decryption rejection without exposing project or error details", async () => {
    const diagnostics: unknown[] = [];
    const sentinel = "sensitive-vault-detail";
    const result = await getAgentHealth(project, {
      fetch: async () => {
        throw new Error("fetch must not run");
      },
      decryptToken: async () => {
        throw new Error(sentinel);
      },
      diagnostic: (event: unknown) => diagnostics.push(event),
    });

    assert.equal(result.kind, "failure");
    assert.deepEqual(diagnostics, [
      { kind: "health", stage: "decrypt_rejected" },
    ]);
    assert.doesNotMatch(
      JSON.stringify(diagnostics),
      new RegExp(`${sentinel}|${TENANT_ID}|tenant\\.example\\.com|${TOKEN}`),
    );
  });

  it("diagnoses a fetch rejection using only fixed outbound stages", async () => {
    const diagnostics: unknown[] = [];
    const sentinel = "sensitive-network-detail";
    const result = await getAgentHealth(project, {
      ...dependencies(async () => {
        throw new TypeError(sentinel);
      }),
      diagnostic: (event: unknown) => diagnostics.push(event),
    });

    assert.equal(result.kind, "failure");
    assert.deepEqual(diagnostics, [
      { kind: "health", stage: "fetch_invoked" },
      { kind: "health", stage: "fetch_rejected_type" },
    ]);
    assert.doesNotMatch(
      JSON.stringify(diagnostics),
      new RegExp(`${sentinel}|${TENANT_ID}|tenant\\.example\\.com|${TOKEN}`),
    );
  });

  it("classifies Cloudflare fetch policy failures without logging their message", async () => {
    const diagnostics: unknown[] = [];
    const sentinel = "sensitive-policy-detail";
    const result = await getAgentHealth(project, {
      ...dependencies(async () => {
        throw new TypeError(`1042 ${sentinel}`);
      }),
      diagnostic: (event: unknown) => diagnostics.push(event),
    });

    assert.equal(result.kind, "failure");
    assert.deepEqual(diagnostics, [
      { kind: "health", stage: "fetch_invoked" },
      { kind: "health", stage: "fetch_rejected_cloudflare_1042" },
    ]);
    assert.doesNotMatch(JSON.stringify(diagnostics), new RegExp(sentinel));
  });

  it("keeps mutation ambiguity when fetch rejection details throw on access", async () => {
    const diagnostics: unknown[] = [];
    const hostileError = new TypeError("hidden");
    Object.defineProperty(hostileError, "message", {
      get() {
        throw new Error("message getter failed");
      },
    });
    Object.defineProperty(hostileError, "cause", {
      get() {
        throw new Error("cause getter failed");
      },
    });

    const result = await sendAgentOperation(project, createRequest, {
      ...dependencies(async () => {
        throw hostileError;
      }),
      diagnostic: (event: unknown) => diagnostics.push(event),
    });

    assert.equal(result.kind, "ambiguous");
    assert.deepEqual(diagnostics, [
      { kind: "operation", stage: "fetch_invoked" },
      { kind: "operation", stage: "fetch_rejected_other" },
    ]);
  });

  it("keeps successful health behavior when diagnostics throw", async () => {
    const result = await getAgentHealth(project, {
      ...dependencies(async () => jsonResponse(healthBody())),
      diagnostic: () => {
        throw new Error("diagnostic sink failed");
      },
    });

    assert.equal(result.kind, "success");
  });

  it("strips poisoned extra fields at the production diagnostic sink", () => {
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...values: unknown[]) => {
      warnings.push(values);
    };
    try {
      logAgentOutboundDiagnostic({
        kind: "health",
        stage: "fetch_rejected_type",
        token: TOKEN,
        error: new Error("sensitive-network-detail"),
        project: project.targetSupabaseProjectRef,
      } as Parameters<typeof logAgentOutboundDiagnostic>[0] & {
        token: string;
        error: Error;
        project: string;
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.deepEqual(warnings, [
      [
        "cum_agent_outbound",
        { kind: "health", stage: "fetch_rejected_type" },
      ],
    ]);
  });

  it("uses the abort signal for the bounded timeout", async () => {
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("timed out", "AbortError")),
          { once: true },
        );
      });

    const result = await sendAgentOperation(project, createRequest, {
      ...dependencies(fetchImpl),
      timeoutMs: 5,
    });
    assert.equal(result.kind, "ambiguous");
  });

  it("bounds and cancels a response body that stalls after headers", async () => {
    async function stalledResult(
      operation: "mutation" | "health",
    ): Promise<{ kind: string; cancelled: boolean }> {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"tenantId":'));
        },
        cancel() {
          cancelled = true;
        },
      });
      const fetchImpl: typeof fetch = async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      const deps = { ...dependencies(fetchImpl), timeoutMs: 5 };
      const result =
        operation === "mutation"
          ? await sendAgentOperation(project, createRequest, deps)
          : await getAgentHealth(project, deps);
      return { kind: result.kind, cancelled };
    }

    assert.deepEqual(await stalledResult("mutation"), {
      kind: "ambiguous",
      cancelled: true,
    });
    assert.deepEqual(await stalledResult("health"), {
      kind: "failure",
      cancelled: true,
    });
  });

  it("fails definitely when token decryption fails before fetch starts", async () => {
    let fetchCalled = false;
    const result = await sendAgentOperation(project, createRequest, {
      fetch: async () => {
        fetchCalled = true;
        return jsonResponse(operationBody());
      },
      decryptToken: async () => {
        throw new Error("vault detail");
      },
    });

    assert.equal(result.kind, "failure");
    assert.equal(result.error.code, "project_unavailable");
    assert.equal(fetchCalled, false);
  });

  it("keeps redirects manual, classifies them safely, and treats them as untrusted", async () => {
    let redirect: RequestRedirect | undefined;
    const diagnostics: unknown[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      redirect = init?.redirect;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify(
                operationBody({
                  result: {
                    user: safeUser,
                    temporaryPassword: "Abcdefghijklmnop1234",
                  },
                }),
              ),
            ),
          );
          controller.close();
        },
      });
      return new Response(body, {
        status: 302,
        headers: {
          "Content-Type": "application/json",
          Location: "https://attacker.example",
        },
      });
    };

    const result = await sendAgentOperation(
      project,
      createRequest,
      {
        ...dependencies(fetchImpl),
        diagnostic: (event: unknown) => diagnostics.push(event),
      },
    );
    assert.equal(redirect, "manual");
    assert.equal(result.kind, "ambiguous");
    assert.deepEqual(diagnostics, [
      { kind: "operation", stage: "fetch_invoked" },
      { kind: "operation", stage: "response_redirect_cross_origin" },
    ]);
  });

  it("cancels a manual redirect body before reading it", async () => {
    let bodyCanceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{}"));
      },
      cancel() {
        bodyCanceled = true;
      },
    });
    const result = await sendAgentOperation(project, createRequest, {
      ...dependencies(async () =>
        new Response(body, {
          status: 307,
          headers: {
            "Content-Type": "application/json",
            Location: "/other",
          },
        })),
      timeoutMs: 1_000,
    });

    assert.equal(result.kind, "ambiguous");
    assert.equal(bodyCanceled, true);
  });

  it("rejects non-JSON and oversized responses without exposing raw content", async () => {
    const secretBody = `raw-secret-${"x".repeat(70_000)}`;
    const responses = [
      new Response("raw-secret", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
      new Response(secretBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "70000",
        },
      }),
    ];

    for (const response of responses) {
      const fetchImpl: typeof fetch = async () => response;
      const result = await sendAgentOperation(
        project,
        createRequest,
        dependencies(fetchImpl),
      );
      assert.equal(result.kind, "ambiguous");
      assert.doesNotMatch(JSON.stringify(result), /raw-secret/);
    }
  });

  it("cancels a chunked response that crosses the response cap", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40_000));
        controller.enqueue(new Uint8Array(40_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl: typeof fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );
    assert.equal(result.kind, "ambiguous");
    assert.equal(cancelled, true);
  });

  it("cancels streaming bodies rejected by MIME or advertised length", async () => {
    const rejectedHeaders: HeadersInit[] = [
      [["Content-Type", "text/plain"]],
      [
        ["Content-Type", "application/json"],
        ["Content-Length", "70000"],
      ],
    ];
    for (const headers of rejectedHeaders) {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([123]));
        },
        cancel() {
          cancelled = true;
        },
      });
      const fetchImpl: typeof fetch = async () =>
        new Response(stream, { status: 200, headers });

      const result = await sendAgentOperation(
        project,
        createRequest,
        dependencies(fetchImpl),
      );
      assert.equal(result.kind, "ambiguous");
      assert.equal(cancelled, true);
    }
  });

  it("rejects wrong operation identity, protocol, and extra response keys", async () => {
    for (const body of [
      operationBody({ tenantId: "55555555-5555-4555-8555-555555555555" }),
      operationBody({ operationId: "55555555-5555-4555-8555-555555555555" }),
      operationBody({ protocolVersion: 2 }),
      operationBody({ unexpected: true }),
    ]) {
      const fetchImpl: typeof fetch = async () => jsonResponse(body);
      const result = await sendAgentOperation(
        project,
        createRequest,
        dependencies(fetchImpl),
      );
      assert.equal(result.kind, "ambiguous");
    }
  });

  it("rejects a password on an action that cannot return one", async () => {
    const suspendRequest: AgentOperationRequest = {
      ...createRequest,
      action: "suspend_user",
    };
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        operationBody({
          result: {
            user: { ...safeUser, status: "suspended" },
            temporaryPassword: "A1!bcdefghijklmnopqr",
          },
        }),
      );

    const result = await sendAgentOperation(
      project,
      suspendRequest,
      dependencies(fetchImpl),
    );
    assert.equal(result.kind, "ambiguous");
  });

  it("keeps valid 409 envelopes authoritative and generic POST 503 ambiguous", async () => {
    const valid409: typeof fetch = async () =>
      jsonResponse(
        operationBody({
          status: "needs_review",
          stage: "needs_review",
          result: undefined,
          error: {
            code: "provider_ambiguous",
            message: "Provider outcome is ambiguous.",
          },
        }),
        { status: 409 },
      );
    const generic503: typeof fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "agent_unavailable",
            message: "Central User Manager Agent is unavailable.",
          },
        },
        { status: 503 },
      );

    const authoritative = await sendAgentOperation(
      project,
      createRequest,
      dependencies(valid409),
    );
    const ambiguous = await sendAgentOperation(
      project,
      createRequest,
      dependencies(generic503),
    );

    assert.equal(authoritative.kind, "response");
    if (authoritative.kind === "response") {
      assert.equal(authoritative.status, "needs_review");
      assert.equal(authoritative.agentErrorCode, "provider_ambiguous");
    }
    assert.equal(ambiguous.kind, "ambiguous");
  });

  it("keeps a valid matched 503 operation envelope authoritative", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        operationBody({
          status: "needs_review",
          stage: "needs_review",
          result: undefined,
          error: {
            code: "provider_failure",
            message: "Unable to complete request.",
          },
        }),
        { status: 503 },
      );

    const result = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );
    assert.equal(result.kind, "response");
    if (result.kind === "response") {
      assert.equal(result.status, "needs_review");
      assert.equal(result.agentErrorCode, "provider_failure");
    }
  });

  it("treats exact generic pre-operation 4xx as definite safe failure", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "tenant_mismatch",
            message: "Tenant identity does not match.",
          },
        },
        { status: 403 },
      );

    const result = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );
    assert.equal(result.kind, "failure");
    assert.equal(result.error.code, "project_unavailable");
  });

  it("treats the Worker rate-limit response as a definite safe failure", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "rate_limited",
            message: "Too many requests.",
          },
        },
        { status: 429, headers: { "Retry-After": "60" } },
      );

    const result = await sendAgentOperation(
      project,
      createRequest,
      dependencies(fetchImpl),
    );
    assert.equal(result.kind, "failure");
    assert.equal(result.error.code, "provider_failure");
  });
});
