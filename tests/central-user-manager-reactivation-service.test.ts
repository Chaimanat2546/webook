import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  reactivateCentralUserManagerTenant,
  type CentralUserManagerReactivationDependencies,
} from "../server/services/central-user-manager-reactivation.ts";
import type { ActiveCustomerProject } from "../server/repositories/customer-projects.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_UID = "33333333-3333-4333-8333-333333333333";
const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_IDS = [
  ATTEMPT_ID,
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
];

const project: ActiveCustomerProject = {
  tenantId: TENANT_ID,
  targetSupabaseProjectRef: "abc123def456ghi789jk",
  agentOrigin: "https://tenant.example.com",
  wranglerEnvironment: "staging",
  bearerTokenCiphertext: "A".repeat(64),
  bearerTokenIv: "B".repeat(16),
  bearerTokenVersion: 9,
  bearerTokenKekVersion: 1,
  bearerTokenFingerprint: "c".repeat(64),
  expectedAgentVersion: "1.0.0",
  expectedSchemaVersion: "20260729",
  authAttestationVersion: "v1",
  authAttestationDigest: "a".repeat(64),
  authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
};

const healthProof = {
  protocolVersion: 1 as const,
  tenantId: TENANT_ID,
  projectRef: project.targetSupabaseProjectRef,
  agentVersion: project.expectedAgentVersion,
  schemaVersion: project.expectedSchemaVersion,
  authAttestationVersion: project.authAttestationVersion,
  authAttestationDigest: project.authAttestationDigest,
  authAttestationCheckedAt: project.authAttestationCheckedAt,
};

function createDependencies(
  overrides: Partial<CentralUserManagerReactivationDependencies> = {},
) {
  const calls: string[] = [];
  let uuidIndex = 0;
  const dependencies: CentralUserManagerReactivationDependencies = {
    async findProject() {
      calls.push("lookup");
      return project;
    },
    async begin(input) {
      calls.push("begin");
      assert.equal(input.attemptId, ATTEMPT_ID);
      return {
        outcome: "received",
        attemptId: ATTEMPT_ID,
        tokenVersion: project.bearerTokenVersion,
      };
    },
    async getHealth() {
      calls.push("health");
      return { kind: "success", data: healthProof };
    },
    async recordVerification(input: { check: string; succeeded: boolean }) {
      calls.push(`record:${input.check}:${input.succeeded}`);
      return true;
    },
    async sendOperation() {
      calls.push("list");
      return {
        kind: "response",
        operationId: EVENT_IDS[2],
        status: "completed",
        stage: "listed",
        safeResult: {
          users: [],
          pagination: { page: 1, pageSize: 1, hasMore: false },
        },
      };
    },
    async activate() {
      calls.push("activate");
      return true;
    },
    randomUuid() {
      const value = EVENT_IDS[uuidIndex];
      uuidIndex += 1;
      if (!value) throw new Error("missing test UUID");
      return value;
    },
    ...overrides,
  };
  return { calls, dependencies };
}

describe("Central User Manager Tenant reactivation service", () => {
  it("uses one attempt and activates only after fresh health and list proofs", async () => {
    const reactivate = reactivateCentralUserManagerTenant;
    const { calls, dependencies } = createDependencies();

    const result = await reactivate(
      { tenantId: TENANT_ID, actorUid: ACTOR_UID },
      dependencies,
    );

    assert.deepEqual(calls, [
      "lookup",
      "begin",
      "health",
      "record:health:true",
      "list",
      "record:list_users:true",
      "activate",
    ]);
    assert.deepEqual(result, {
      ok: true,
      health: {
        tenantId: TENANT_ID,
        status: "healthy",
        agentVersion: "1.0.0",
        schemaVersion: "20260729",
        authAttestationVersion: "v1",
        authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
      },
    });
    assert.equal(JSON.stringify(result).includes("Digest"), false);
    assert.equal(JSON.stringify(result).includes("projectRef"), false);
  });

  it("records failed health and never lists or activates", async () => {
    const reactivate = reactivateCentralUserManagerTenant;
    const { calls, dependencies } = createDependencies({
      async getHealth() {
        calls.push("health");
        return {
          kind: "failure",
          error: {
            code: "provider_failure",
            message: "Unable to complete request.",
          },
        };
      },
    });

    const result = await reactivate(
      { tenantId: TENANT_ID, actorUid: ACTOR_UID },
      dependencies,
    );

    assert.deepEqual(calls, [
      "lookup",
      "begin",
      "health",
      "record:health:false",
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "provider_failure");
  });

  it("returns an explicit conflict without contacting the Tenant when another attempt owns the gate", async () => {
    const { calls, dependencies } = createDependencies({
      async begin() {
        calls.push("begin");
        return { outcome: "conflict" };
      },
    });

    const result = await reactivateCentralUserManagerTenant(
      { tenantId: TENANT_ID, actorUid: ACTOR_UID },
      dependencies,
    );

    assert.deepEqual(calls, ["lookup", "begin"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "operation_conflict");
    }
  });

  it("records a failed list proof and never activates", async () => {
    const reactivate = reactivateCentralUserManagerTenant;
    const { calls, dependencies } = createDependencies({
      async sendOperation() {
        calls.push("list");
        return {
          kind: "failure",
          error: {
            code: "provider_failure",
            message: "Unable to complete request.",
          },
        };
      },
    });

    const result = await reactivate(
      { tenantId: TENANT_ID, actorUid: ACTOR_UID },
      dependencies,
    );

    assert.deepEqual(calls, [
      "lookup",
      "begin",
      "health",
      "record:health:true",
      "list",
      "record:list_users:false",
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "provider_failure");
  });
});
