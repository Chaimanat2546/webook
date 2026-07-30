import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendCentralUserAuditEvent,
  CentralUserAuditInputError,
  CentralUserAuditRepositoryError,
} from "../server/repositories/central-user-audit-events.ts";
import {
  CentralUserManagerProjectRepositoryError,
  findActiveCustomerProject,
  listCustomerProjects,
  listCustomerProjectsForKekRotation,
  rewrapCustomerProjectBearerKek,
} from "../server/repositories/customer-projects.ts";
import {
  beginCentralUserDispatch,
  claimCentralUserOperation,
  CentralUserOperationConflictError,
  CentralUserOperationRepositoryError,
  finalizeCentralUserOperation,
} from "../server/repositories/user-management-operations.ts";

interface QueryResponse {
  data: unknown;
  error: unknown;
}

interface RecordedQuery {
  table: string;
  select?: string;
  filters: Array<[string, unknown]>;
  orders: string[];
}

class FakeQuery implements PromiseLike<QueryResponse> {
  readonly record: RecordedQuery;
  private readonly response: QueryResponse;

  constructor(response: QueryResponse, table: string) {
    this.response = response;
    this.record = { table, filters: [], orders: [] };
  }

  select(columns: string) {
    this.record.select = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.record.filters.push([column, value]);
    return this;
  }

  order(column: string) {
    this.record.orders.push(column);
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

class FakeClient {
  readonly queries: RecordedQuery[] = [];
  readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly queryResponses: QueryResponse[] = [];
  readonly rpcResponses: QueryResponse[] = [];
  queryFailure: Error | null = null;
  rpcFailure: Error | null = null;

  from(table: string) {
    if (this.queryFailure) {
      throw this.queryFailure;
    }
    const query = new FakeQuery(
      this.queryResponses.shift() ?? { data: [], error: null },
      table,
    );
    this.queries.push(query.record);
    return query;
  }

  async rpc(name: string, args: Record<string, unknown>) {
    if (this.rpcFailure) {
      throw this.rpcFailure;
    }
    this.rpcCalls.push({ name, args });
    return this.rpcResponses.shift() ?? { data: null, error: null };
  }
}

function asClient(client: FakeClient) {
  return client as never;
}

const safeProjectRow = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Tenant One",
  is_active: true,
  last_verified_token_version: 2,
  last_health_checked_at: "2026-07-30T00:00:00.000Z",
  last_list_users_checked_at: "2026-07-30T00:01:00.000Z",
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-30T00:01:00.000Z",
  expected_agent_version: "1.0.0",
  expected_schema_version: "20260729",
  auth_attestation_version: "v1",
  auth_attestation_checked_at: "2026-07-29T00:00:00.000Z",
  last_health_status: "healthy",
  last_health_safe_error: null,
  last_health_agent_version: "1.0.0",
  last_health_schema_version: "20260729",
  last_health_auth_attestation_version: "v1",
  last_health_auth_attestation_checked_at: "2026-07-29T00:00:00.000Z",
};

const activeProjectRow = {
  id: safeProjectRow.id,
  target_supabase_project_ref: "abc123def456ghi789jk",
  agent_origin: "https://tenant.example.com",
  wrangler_environment: "production",
  bearer_token_ciphertext: "A".repeat(64),
  bearer_token_iv: "B".repeat(16),
  bearer_token_version: 2,
  bearer_token_kek_version: 1,
  bearer_token_fingerprint: "c".repeat(64),
  expected_agent_version: "1.0.0",
  expected_schema_version: "20260729",
  auth_attestation_version: "v1",
  auth_attestation_digest: "a".repeat(64),
  auth_attestation_checked_at: "2026-07-29T00:00:00.000Z",
};

describe("customer project repository", () => {
  it("lists only the safe view projection", async () => {
    const client = new FakeClient();
    client.queryResponses.push({ data: [safeProjectRow], error: null });

    const projects = await listCustomerProjects(asClient(client));

    assert.equal(projects[0]?.displayName, "Tenant One");
    assert.equal(client.queries[0]?.table, "central_user_manager_projects");
    assert.doesNotMatch(
      client.queries[0]?.select ?? "",
      /agent_origin|project_ref|digest|ciphertext|bearer_token|fingerprint/,
    );
  });

  it("resolves one active encrypted dispatch record from the base table", async () => {
    const client = new FakeClient();
    client.queryResponses.push({ data: [activeProjectRow], error: null });

    const project = await findActiveCustomerProject(
      asClient(client),
      safeProjectRow.id,
    );

    assert.equal(project?.agentOrigin, "https://tenant.example.com");
    assert.equal(project?.bearerTokenVersion, 2);
    assert.deepEqual(client.queries[0]?.filters, [
      ["id", safeProjectRow.id],
      ["is_active", true],
    ]);
  });

  it("returns the same result for inactive and missing Tenants", async () => {
    for (const data of [[], null]) {
      const client = new FakeClient();
      client.queryResponses.push({ data, error: null });
      assert.equal(
        await findActiveCustomerProject(asClient(client), safeProjectRow.id),
        null,
      );
    }
  });

  it("maps thrown query failures to a stable project repository error", async () => {
    const client = new FakeClient();
    client.queryFailure = new Error("provider network secret detail");

    await assert.rejects(
      listCustomerProjects(asClient(client)),
      CentralUserManagerProjectRepositoryError,
    );
  });

  it("lists only one old-KEK batch and persists through the atomic CAS RPC", async () => {
    const client = new FakeClient();
    client.queryResponses.push({ data: [activeProjectRow], error: null });
    client.rpcResponses.push({ data: true, error: null });

    const [expected] = await listCustomerProjectsForKekRotation(
      asClient(client),
      { kekVersion: 1, limit: 25 },
    );
    assert.ok(expected);
    assert.deepEqual(client.queries[0]?.filters, [
      ["bearer_token_kek_version", 1],
    ]);
    assert.doesNotMatch(
      client.queries[0]?.select ?? "",
      /agent_origin|project_ref|display_name/,
    );

    assert.equal(
      await rewrapCustomerProjectBearerKek(asClient(client), {
        expected,
        rewrapped: {
          ...expected,
          bearerTokenCiphertext: "D".repeat(64),
          bearerTokenIv: "E".repeat(16),
          bearerTokenKekVersion: 2,
        },
        actorUid: "33333333-3333-4333-8333-333333333333",
        eventId: "44444444-4444-4444-8444-444444444444",
      }),
      true,
    );
    assert.equal(
      client.rpcCalls[0]?.name,
      "rewrap_customer_project_bearer_kek",
    );
    assert.equal(client.rpcCalls[0]?.args.p_expected_kek_version, 1);
    assert.equal(client.rpcCalls[0]?.args.p_next_kek_version, 2);
  });
});

describe("operation repository", () => {
  const binding = {
    operationId: "22222222-2222-4222-8222-222222222222",
    tenantId: safeProjectRow.id,
    actorUid: "33333333-3333-4333-8333-333333333333",
    action: "create_user" as const,
    targetEmailNormalized: "admin@example.com",
    requestHash: "d".repeat(64),
  };

  it("maps first claim and exact retry from the transactional RPC", async () => {
    const client = new FakeClient();
    client.rpcResponses.push(
      {
        data: { outcome: "claimed", status: "received" },
        error: null,
      },
      {
        data: {
          outcome: "retry",
          status: "completed",
          agentStage: "completed",
          safeResult: { user: {
            userId: "44444444-4444-4444-8444-444444444444",
            email: "admin@example.com",
            status: "active",
            createdAt: null,
            lastSignInAt: null,
            credentialVersion: 1,
            authCredentialVersion: 1,
          } },
          safeErrorCode: null,
        },
        error: null,
      },
    );

    assert.equal(
      (await claimCentralUserOperation(asClient(client), binding)).outcome,
      "claimed",
    );
    assert.equal(
      (await claimCentralUserOperation(asClient(client), binding)).outcome,
      "retry",
    );
    assert.equal(client.rpcCalls[0]?.name, "claim_central_user_operation");
  });

  it("maps conflicting UUID reuse without exposing database details", async () => {
    const client = new FakeClient();
    client.rpcResponses.push({
      data: null,
      error: {
        code: "23505",
        message: "central_user_operation_id_conflict secret detail",
        details: "do not expose",
      },
    });

    await assert.rejects(
      claimCentralUserOperation(asClient(client), binding),
      CentralUserOperationConflictError,
    );
  });

  it("uses exact CAS RPCs for dispatch and atomic finalization", async () => {
    const client = new FakeClient();
    client.rpcResponses.push(
      { data: true, error: null },
      { data: true, error: null },
    );
    const safeResult = {
      user: {
        userId: "44444444-4444-4444-8444-444444444444",
        email: "admin@example.com",
        status: "active" as const,
        createdAt: null,
        lastSignInAt: null,
        credentialVersion: 1,
        authCredentialVersion: 1,
      },
    };

    assert.equal(
      await beginCentralUserDispatch(
        asClient(client),
        binding.operationId,
        binding.requestHash,
      ),
      true,
    );
    assert.equal(
      await finalizeCentralUserOperation(asClient(client), {
        operationId: binding.operationId,
        requestHash: binding.requestHash,
        eventId: "55555555-5555-4555-8555-555555555555",
        expectedStatus: "dispatching",
        nextStatus: "completed",
        agentStage: "completed",
        safeResult,
        safeErrorCode: null,
        metadata: { disposition: "first" },
      }),
      true,
    );

    assert.deepEqual(
      client.rpcCalls.map(({ name }) => name),
      [
        "begin_central_user_dispatch",
        "finalize_central_user_operation",
      ],
    );
  });

  it("rejects password-bearing or raw safe results before persistence", async () => {
    const client = new FakeClient();

    assert.throws(() =>
      finalizeCentralUserOperation(asClient(client), {
        operationId: binding.operationId,
        requestHash: binding.requestHash,
        eventId: "55555555-5555-4555-8555-555555555555",
        expectedStatus: "dispatching",
        nextStatus: "completed",
        agentStage: "completed",
        safeResult: { temporaryPassword: "MustNotPersist1!" } as never,
        safeErrorCode: null,
        metadata: { disposition: "first" },
      }),
    );
    assert.equal(client.rpcCalls.length, 0);
  });

  it("rejects null completion and contradictory reconciliation before persistence", () => {
    const client = new FakeClient();
    assert.throws(() =>
      finalizeCentralUserOperation(asClient(client), {
        operationId: binding.operationId,
        requestHash: binding.requestHash,
        eventId: "55555555-5555-4555-8555-555555555555",
        expectedStatus: "dispatching",
        nextStatus: "completed",
        agentStage: "completed",
        safeResult: null,
        safeErrorCode: null,
        metadata: { disposition: "first" },
      } as never),
    );
    assert.throws(() =>
      finalizeCentralUserOperation(asClient(client), {
        operationId: binding.operationId,
        requestHash: binding.requestHash,
        eventId: "55555555-5555-4555-8555-555555555555",
        expectedStatus: "needs_review",
        nextStatus: "completed",
        agentStage: "completed",
        safeResult: null,
        safeErrorCode: "provider_failure",
        metadata: { disposition: "reconciled" },
      } as never),
    );
    assert.equal(client.rpcCalls.length, 0);
  });

  it("maps rejected RPCs to a stable operation repository error", async () => {
    const client = new FakeClient();
    client.rpcFailure = new Error("provider network secret detail");
    await assert.rejects(
      claimCentralUserOperation(asClient(client), binding),
      CentralUserOperationRepositoryError,
    );
  });
});

describe("audit repository", () => {
  it("calls the append-only RPC with allowlisted metadata", async () => {
    const client = new FakeClient();
    const eventId = "55555555-5555-4555-8555-555555555555";
    client.rpcResponses.push({ data: eventId, error: null });

    assert.equal(
      await appendCentralUserAuditEvent(asClient(client), {
        eventId,
        operationId: "22222222-2222-4222-8222-222222222222",
        tenantId: safeProjectRow.id,
        actorUid: "33333333-3333-4333-8333-333333333333",
        action: "create_user",
        outcome: "dispatching",
        safeErrorCode: null,
        requestHash: "d".repeat(64),
        metadata: { stage: "agent_dispatch", tokenVersion: 2 },
      }),
      eventId,
    );
    assert.equal(
      client.rpcCalls[0]?.name,
      "append_central_user_audit_event",
    );
    assert.equal(Object.keys(client.rpcCalls[0]?.args ?? {}).length, 9);
  });

  it("rejects arbitrary metadata and secret-like keys", async () => {
    const client = new FakeClient();
    await assert.rejects(
      appendCentralUserAuditEvent(asClient(client), {
        eventId: "55555555-5555-4555-8555-555555555555",
        operationId: null,
        tenantId: safeProjectRow.id,
        actorUid: "33333333-3333-4333-8333-333333333333",
        action: "verify_project",
        outcome: "failed",
        safeErrorCode: "provider_failure",
        requestHash: null,
        metadata: { authorization: "Bearer secret" } as never,
      }),
      CentralUserAuditInputError,
    );
    assert.equal(client.rpcCalls.length, 0);
  });

  it("maps rejected audit RPCs to a stable repository error", async () => {
    const client = new FakeClient();
    client.rpcFailure = new Error("provider network secret detail");
    await assert.rejects(
      appendCentralUserAuditEvent(asClient(client), {
        eventId: "55555555-5555-4555-8555-555555555555",
        operationId: null,
        tenantId: safeProjectRow.id,
        actorUid: "33333333-3333-4333-8333-333333333333",
        action: "verify_project",
        outcome: "failed",
        safeErrorCode: "provider_failure",
        requestHash: null,
        metadata: null,
      }),
      CentralUserAuditRepositoryError,
    );
  });
});
