import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentOperationRequest } from "../server/central-user-manager/contracts.ts";
import {
  executeCentralUserOperation,
  reconcileCentralUserOperation,
  type CentralUserManagerServiceDependencies,
} from "../server/services/central-user-manager.ts";
import {
  CentralUserOperationConflictError,
  type CentralUserOperationClaim,
  type CentralUserFinalizationInput,
} from "../server/repositories/user-management-operations.ts";
import type { ActiveCustomerProject } from "../server/repositories/customer-projects.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_UID = "33333333-3333-4333-8333-333333333333";
const REQUEST_HASH = "d".repeat(64);
const EVENT_IDS = [
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
];

const request: AgentOperationRequest = {
  tenantId: TENANT_ID,
  operationId: OPERATION_ID,
  actorUid: ACTOR_UID,
  action: "create_user",
  payload: { email: "admin@example.com" },
};

const project: ActiveCustomerProject = {
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

const user = {
  userId: "44444444-4444-4444-8444-444444444444",
  email: "admin@example.com",
  status: "password_change_required" as const,
  createdAt: null,
  lastSignInAt: null,
  credentialVersion: 1,
  authCredentialVersion: 1,
};

interface FakeState {
  calls: string[];
  claims: CentralUserOperationClaim[];
  finalizations: CentralUserFinalizationInput[];
  finalizeResults: Array<boolean | Error>;
  eventIndex: number;
}

function createDependencies(
  overrides: Partial<CentralUserManagerServiceDependencies> = {},
): { dependencies: CentralUserManagerServiceDependencies; state: FakeState } {
  const state: FakeState = {
    calls: [],
    claims: [{ outcome: "claimed", status: "received" }],
    finalizations: [],
    finalizeResults: [true],
    eventIndex: 0,
  };
  const dependencies: CentralUserManagerServiceDependencies = {
    async findActiveProject() {
      state.calls.push("lookup");
      return project;
    },
    async hashBinding() {
      state.calls.push("hash");
      return REQUEST_HASH;
    },
    async claimOperation() {
      state.calls.push("claim");
      const claim = state.claims.shift();
      if (!claim) {
        throw new Error("missing fake claim");
      }
      return claim;
    },
    async beginDispatch() {
      state.calls.push("begin");
      return true;
    },
    async sendOperation() {
      state.calls.push("dispatch");
      return {
        kind: "response",
        operationId: OPERATION_ID,
        status: "completed",
        stage: "completed",
        safeResult: { user },
        temporaryPassword: "A1!bcdefghijklmnopqr",
      };
    },
    async finalizeOperation(input) {
      state.calls.push("finalize");
      state.finalizations.push(input);
      const result = state.finalizeResults.shift() ?? true;
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
    randomUuid() {
      const value = EVENT_IDS[state.eventIndex];
      state.eventIndex += 1;
      if (!value) {
        throw new Error("missing fake UUID");
      }
      return value;
    },
    ...overrides,
  };
  return { dependencies, state };
}

describe("Central User Manager service", () => {
  it("rejects inactive or missing Tenant before claim or dispatch", async () => {
    const { dependencies, state } = createDependencies({
      async findActiveProject() {
        state.calls.push("lookup");
        return null;
      },
    });

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "project_unavailable");
    }
    assert.deepEqual(state.calls, ["lookup"]);
  });

  it("persists and audits the safe result before returning the first password", async () => {
    const { dependencies, state } = createDependencies();

    const result = await executeCentralUserOperation(request, dependencies);

    assert.deepEqual(state.calls, [
      "lookup",
      "hash",
      "claim",
      "begin",
      "dispatch",
      "finalize",
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.temporaryPassword, "A1!bcdefghijklmnopqr");
    }
    assert.equal(
      JSON.stringify(state.finalizations).includes("temporaryPassword"),
      false,
    );
    assert.deepEqual(state.finalizations[0], {
      operationId: OPERATION_ID,
      requestHash: REQUEST_HASH,
      eventId: EVENT_IDS[0],
      expectedStatus: "dispatching",
      nextStatus: "completed",
      agentStage: "completed",
      safeResult: { user },
      safeErrorCode: null,
      metadata: { disposition: "first" },
    });
  });

  it("returns a completed exact retry without dispatching or recreating password", async () => {
    const { dependencies, state } = createDependencies();
    state.claims = [{
      outcome: "retry",
      status: "completed",
      agentStage: "completed",
      safeResult: { user },
      safeErrorCode: null,
    }];

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "completed");
      assert.equal(result.operation.temporaryPassword, undefined);
    }
    assert.deepEqual(state.calls, ["lookup", "hash", "claim"]);
  });

  it("allows only the received CAS winner to dispatch on a double click", async () => {
    const { dependencies, state } = createDependencies({
      async beginDispatch() {
        state.calls.push("begin");
        return false;
      },
    });
    state.claims = [
      {
        outcome: "retry",
        status: "received",
        agentStage: null,
        safeResult: null,
        safeErrorCode: null,
      },
      {
        outcome: "retry",
        status: "dispatching",
        agentStage: null,
        safeResult: null,
        safeErrorCode: null,
      },
    ];

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "dispatching");
    }
    assert.deepEqual(state.calls, [
      "lookup",
      "hash",
      "claim",
      "begin",
      "claim",
    ]);
  });

  it("maps changed operation binding to a stable conflict", async () => {
    const { dependencies } = createDependencies({
      async claimOperation() {
        throw new CentralUserOperationConflictError();
      },
    });

    const result = await executeCentralUserOperation(request, dependencies);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "operation_conflict");
    }
  });

  it("persists exact Agent nonterminal stage without replay", async () => {
    const { dependencies, state } = createDependencies({
      async sendOperation() {
        state.calls.push("dispatch");
        return {
          kind: "response",
          operationId: OPERATION_ID,
          status: "needs_review",
          stage: "provider_outcome",
          safeResult: null,
          agentErrorCode: "provider_ambiguous",
        };
      },
    });

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    assert.equal(state.finalizations[0]?.nextStatus, "needs_review");
    assert.equal(state.finalizations[0]?.agentStage, "provider_outcome");
    assert.equal(state.finalizations[0]?.safeErrorCode, "operation_ambiguous");
  });

  it("persists transport ambiguity as needs review with no invented stage", async () => {
    const { dependencies, state } = createDependencies({
      async sendOperation() {
        state.calls.push("dispatch");
        return {
          kind: "ambiguous",
          error: {
            code: "operation_ambiguous",
            message: "Operation outcome requires review.",
          },
        };
      },
    });

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    assert.equal(state.finalizations[0]?.nextStatus, "needs_review");
    assert.equal(state.finalizations[0]?.agentStage, null);
  });

  it("discards the password and marks needs review when finalization fails", async () => {
    const { dependencies, state } = createDependencies();
    state.finalizeResults = [false, true];

    const result = await executeCentralUserOperation(request, dependencies);

    assert.equal(state.finalizations.length, 2);
    assert.equal(state.finalizations[1]?.nextStatus, "needs_review");
    assert.equal(state.finalizations[1]?.safeResult, null);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "needs_review");
      assert.equal(result.operation.temporaryPassword, undefined);
    }
  });

  it("persists duplicate create and compensated create as explicit terminal states", async () => {
    for (const scenario of [
      {
        response: {
          kind: "response" as const,
          operationId: OPERATION_ID,
          status: "completed" as const,
          stage: "completed" as const,
          safeResult: { user },
          agentErrorCode: "user_exists" as const,
        },
        nextStatus: "completed",
        safeErrorCode: "operation_conflict",
      },
      {
        response: {
          kind: "response" as const,
          operationId: OPERATION_ID,
          status: "completed" as const,
          stage: "completed" as const,
          safeResult: null,
          agentErrorCode: "create_compensated" as const,
        },
        nextStatus: "failed_safe",
        safeErrorCode: "provider_failure",
      },
    ]) {
      const { dependencies, state } = createDependencies({
        async sendOperation() {
          state.calls.push("dispatch");
          return scenario.response;
        },
      });
      await executeCentralUserOperation(request, dependencies);
      assert.equal(state.finalizations[0]?.nextStatus, scenario.nextStatus);
      assert.equal(
        state.finalizations[0]?.safeErrorCode,
        scenario.safeErrorCode,
      );
    }
  });

  it("reconciles the original binding without beginning a new dispatch or returning a password", async () => {
    const { dependencies, state } = createDependencies();
    state.claims = [{
      outcome: "retry",
      status: "needs_review",
      agentStage: null,
      safeResult: null,
      safeErrorCode: "operation_ambiguous",
    }];

    const result = await reconcileCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "completed");
      assert.equal(result.operation.temporaryPassword, undefined);
    }
    assert.equal(state.calls.includes("begin"), false);
    assert.equal(state.finalizations[0]?.expectedStatus, "needs_review");
    assert.equal(
      state.finalizations[0]?.metadata?.disposition,
      "reconciled",
    );
  });

  it("explicitly reconciles a stranded dispatch without beginning a new dispatch", async () => {
    const { dependencies, state } = createDependencies();
    state.claims = [{
      outcome: "retry",
      status: "dispatching",
      agentStage: null,
      safeResult: null,
      safeErrorCode: null,
    }];

    const result = await reconcileCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "completed");
      assert.equal(result.operation.temporaryPassword, undefined);
    }
    assert.deepEqual(state.calls, [
      "lookup",
      "hash",
      "claim",
      "dispatch",
      "finalize",
    ]);
    assert.equal(state.finalizations[0]?.expectedStatus, "dispatching");
    assert.equal(
      state.finalizations[0]?.metadata?.disposition,
      "reconciled",
    );
  });

  it("persists an authoritative review state while reconciling a stranded dispatch", async () => {
    const { dependencies, state } = createDependencies({
      async sendOperation() {
        state.calls.push("dispatch");
        return {
          kind: "response",
          operationId: OPERATION_ID,
          status: "needs_review",
          stage: "provider_outcome",
          safeResult: null,
          agentErrorCode: "provider_ambiguous",
        };
      },
    });
    state.claims = [{
      outcome: "retry",
      status: "dispatching",
      agentStage: null,
      safeResult: null,
      safeErrorCode: null,
    }];

    const result = await reconcileCentralUserOperation(request, dependencies);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.operation.status, "needs_review");
      assert.equal(result.operation.agentStage, "provider_outcome");
      assert.equal(result.operation.temporaryPassword, undefined);
    }
    assert.equal(state.calls.includes("begin"), false);
    assert.equal(state.finalizations[0]?.expectedStatus, "dispatching");
    assert.equal(state.finalizations[0]?.nextStatus, "needs_review");
  });
});
