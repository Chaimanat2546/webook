import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createUserManagerRequestCoordinator,
  reactivateUserManagerProject,
  type BrowserOperationInput,
} from "../components/admin/user-manager/use-user-manager.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

describe("Central User Manager client actions", () => {
  it("reuses the exact UUID, body, and promise for a concurrent double click", async () => {
    const bodies: unknown[] = [];
    const deferred = Promise.withResolvers<unknown>();
    const coordinator = createUserManagerRequestCoordinator({
      randomUuid: () => OPERATION_ID,
      async send(_path, body) {
        bodies.push(body);
        return deferred.promise;
      },
    });
    const input: BrowserOperationInput = {
      tenantId: TENANT_ID,
      action: "create_user",
      payload: { email: "admin@example.com" },
    };

    const first = coordinator.execute("create:admin@example.com", input);
    const second = coordinator.execute("create:admin@example.com", input);
    assert.equal(first, second);
    assert.equal(bodies.length, 1);
    assert.equal(
      (bodies[0] as { operationId: string }).operationId,
      OPERATION_ID,
    );
    deferred.resolve({ ok: true });
    await first;
  });

  it("does not deduplicate different requests or Tenants", async () => {
    const bodies: unknown[] = [];
    let uuidCalls = 0;
    const coordinator = createUserManagerRequestCoordinator({
      randomUuid: () => `operation-${++uuidCalls}`,
      async send(_path, body) {
        bodies.push(body);
        return { ok: true };
      },
    });

    const first = coordinator.execute("list:first", {
      tenantId: TENANT_ID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });
    const second = coordinator.execute("list:second", {
      tenantId: OTHER_TENANT_ID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });

    assert.notEqual(first, second);
    await Promise.all([first, second]);
    assert.equal(bodies.length, 2);
    assert.deepEqual(
      bodies.map((body) => (body as { tenantId: string }).tenantId),
      [TENANT_ID, OTHER_TENANT_ID],
    );
  });

  it("reconciles the stored exact request without generating a new operation", async () => {
    const paths: string[] = [];
    let uuidCalls = 0;
    const coordinator = createUserManagerRequestCoordinator({
      randomUuid() {
        uuidCalls += 1;
        return OPERATION_ID;
      },
      async send(path) {
        paths.push(path);
        return { ok: true };
      },
    });
    const mutation = coordinator.execute("suspend:admin@example.com", {
      tenantId: TENANT_ID,
      action: "suspend_user",
      payload: { email: "admin@example.com" },
    });
    await mutation;
    coordinator.markForReview(mutation);
    await coordinator.reconcile();

    assert.equal(uuidCalls, 1);
    assert.deepEqual(paths, [
      "/api/admin/user-manager/operations",
      `/api/admin/user-manager/operations/${OPERATION_ID}/reconcile`,
    ]);
  });

  it("keeps the mutation selected for reconciliation across later list requests", async () => {
    const paths: string[] = [];
    let uuidCalls = 0;
    const coordinator = createUserManagerRequestCoordinator({
      randomUuid() {
        uuidCalls += 1;
        return uuidCalls === 1 ? OPERATION_ID : `list-${uuidCalls}`;
      },
      async send(path) {
        paths.push(path);
        return { ok: true };
      },
    });
    const mutation = coordinator.execute("suspend:admin@example.com", {
      tenantId: TENANT_ID,
      action: "suspend_user",
      payload: { email: "admin@example.com" },
    });
    await mutation;
    coordinator.markForReview(mutation);
    await coordinator.execute("list:page:2", {
      tenantId: TENANT_ID,
      action: "list_users",
      payload: { page: 2, pageSize: 25 },
    });
    await coordinator.reconcile();

    assert.equal(
      paths.at(-1),
      `/api/admin/user-manager/operations/${OPERATION_ID}/reconcile`,
    );
  });

  it("requests Tenant reactivation once and accepts only matching healthy proof", async () => {
    const requests: Array<{ path: string; init: RequestInit }> = [];
    const result = await reactivateUserManagerProject(
      TENANT_ID,
      async (path, init) => {
        requests.push({ path, init });
        return new Response(
          JSON.stringify({
            ok: true,
            health: {
              tenantId: TENANT_ID,
              status: "healthy",
              agentVersion: "1.0.0",
              schemaVersion: "20260729",
              authAttestationVersion: "v1",
              authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
            },
          }),
          { status: 200 },
        );
      },
    );

    assert.equal(result.ok, true);
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.path,
      "/api/admin/user-manager/projects/reactivate",
    );
    assert.equal(requests[0]?.init.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
      tenantId: TENANT_ID,
    });

    const mismatched = await reactivateUserManagerProject(
      TENANT_ID,
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            health: {
              tenantId: OTHER_TENANT_ID,
              status: "healthy",
              agentVersion: "1.0.0",
              schemaVersion: "20260729",
              authAttestationVersion: "v1",
              authAttestationCheckedAt: "2026-07-29T00:00:00.000Z",
            },
          }),
          { status: 200 },
        ),
    );
    assert.equal(mismatched.ok, false);
  });

  it("deduplicates concurrent Tenant reactivation requests", async () => {
    const deferred = Promise.withResolvers<Response>();
    let sends = 0;
    const send = async () => {
      sends += 1;
      return deferred.promise;
    };

    const first = reactivateUserManagerProject(TENANT_ID, send);
    const second = reactivateUserManagerProject(TENANT_ID, send);
    assert.equal(sends, 1);

    deferred.resolve(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "operation_conflict",
            message: "Operation conflicts with an existing request.",
          },
        }),
        { status: 409 },
      ),
    );
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, secondResult);
  });
});
