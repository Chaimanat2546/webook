import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampUserManagerPage,
  createTenantSelectionGuard,
  isHealthForSelectedTenant,
  readTemporaryCredential,
  getProjectLifecycle,
  getUserStatusPresentation,
  sanitizeClientOperation,
} from "../components/admin/user-manager/view-model.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

describe("Central User Manager view model", () => {
  it("maps all managed user statuses to stable Thai labels", () => {
    assert.deepEqual(
      [
        "active",
        "password_change_required",
        "suspended",
        "abnormal",
      ].map((status) =>
        getUserStatusPresentation(
          status as Parameters<typeof getUserStatusPresentation>[0],
        ).label,
      ),
      ["ใช้งาน", "รอเปลี่ยนรหัส", "ระงับ", "ข้อมูลผิดปกติ"],
    );
  });

  it("distinguishes provisioning, deactivated, healthy and unhealthy projects", () => {
    assert.equal(
      getProjectLifecycle({
        isActive: false,
        lastVerifiedTokenVersion: null,
        lastHealthStatus: "unknown",
      }),
      "provisioning",
    );
    assert.equal(
      getProjectLifecycle({
        isActive: false,
        lastVerifiedTokenVersion: 1,
        lastHealthStatus: "healthy",
      }),
      "deactivated",
    );
    assert.equal(
      getProjectLifecycle({
        isActive: true,
        lastVerifiedTokenVersion: 1,
        lastHealthStatus: "healthy",
      }),
      "healthy",
    );
    assert.equal(
      getProjectLifecycle({
        isActive: true,
        lastVerifiedTokenVersion: 1,
        lastHealthStatus: "unhealthy",
      }),
      "unhealthy",
    );
  });

  it("bounds list pages and removes one-time passwords from durable operation state", () => {
    assert.equal(clampUserManagerPage(-1), 1);
    assert.equal(clampUserManagerPage(101), 100);
    const sanitized = sanitizeClientOperation({
      operationId: "22222222-2222-4222-8222-222222222222",
      status: "completed",
      agentStage: "completed",
      safeResult: null,
      safeErrorCode: null,
      temporaryPassword: "A1!bcdefghijklmnopqr",
    });
    assert.equal("temporaryPassword" in sanitized, false);
  });

  it("rejects stale Tenant results and health after selection changes", () => {
    const selection = createTenantSelectionGuard();
    const first = selection.select(TENANT_ID);
    const second = selection.select("33333333-3333-4333-8333-333333333333");

    assert.equal(selection.isCurrent(first), false);
    assert.equal(selection.isCurrent(second), true);
    assert.equal(
      isHealthForSelectedTenant(
        { tenantId: TENANT_ID, status: "healthy" },
        "33333333-3333-4333-8333-333333333333",
      ),
      false,
    );
  });

  it("retains a successful one-time credential with its Tenant identity", () => {
    assert.deepEqual(
      readTemporaryCredential(
        {
          operationId: "22222222-2222-4222-8222-222222222222",
          status: "completed",
          agentStage: "completed",
          safeResult: null,
          safeErrorCode: null,
          temporaryPassword: "one-time-secret",
        },
        {
          tenantId: TENANT_ID,
          payload: { email: "admin@example.com" },
        },
      ),
      {
        tenantId: TENANT_ID,
        email: "admin@example.com",
        password: "one-time-secret",
      },
    );
  });
});
