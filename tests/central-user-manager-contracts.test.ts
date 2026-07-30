import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAgentOperationRequest,
  CentralUserManagerContractError,
  parseBrowserOperationRequest,
} from "../server/central-user-manager/contracts.ts";
import {
  hashCentralOperationBinding,
  toCentralOperationBinding,
} from "../server/central-user-manager/request-hash.ts";
import {
  normalizeSafeCentralUserError,
  SAFE_CENTRAL_USER_ERROR_CATALOG,
} from "../server/central-user-manager/safe-errors.ts";

const TENANT_ID = "123e4567-e89b-42d3-a456-426614174000";
const OPERATION_ID = "223e4567-e89b-42d3-a456-426614174001";
const OTHER_OPERATION_ID = "223e4567-e89b-42d3-a456-426614174003";
const ACTOR_UID = "323e4567-e89b-42d3-a456-426614174002";

function browserRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: TENANT_ID,
    operationId: OPERATION_ID,
    action: "list_users",
    payload: { page: 1, pageSize: 25 },
    ...overrides,
  };
}

function assertInvalid(value: unknown) {
  assert.throws(
    () => parseBrowserOperationRequest(value),
    (error: unknown) =>
      error instanceof CentralUserManagerContractError &&
      error.code === "invalid_request" &&
      error.status === 422,
  );
}

describe("Central User Manager contracts", () => {
  it("parses an exact Browser request and derives actor identity only on the server", () => {
    const browser = parseBrowserOperationRequest(browserRequest());

    assert.deepEqual(browser, {
      tenantId: TENANT_ID,
      operationId: OPERATION_ID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });
    assert.deepEqual(buildAgentOperationRequest(browser, ACTOR_UID), {
      tenantId: TENANT_ID,
      operationId: OPERATION_ID,
      actorUid: ACTOR_UID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });
  });

  it("rejects noncanonical identifiers and Browser-controlled trust fields", () => {
    for (const invalidId of [
      "",
      TENANT_ID.toUpperCase(),
      "123e4567-e89b-02d3-a456-426614174000",
      "123e4567-e89b-42d3-7456-426614174000",
      `${TENANT_ID}extra`,
    ]) {
      assertInvalid(browserRequest({ tenantId: invalidId }));
      assertInvalid(browserRequest({ operationId: invalidId }));
    }

    assertInvalid({ ...browserRequest(), actorUid: ACTOR_UID });
    assertInvalid({ ...browserRequest(), agentOrigin: "https://tenant.example" });
    assertInvalid({ ...browserRequest(), projectRef: "secret-project" });
    assertInvalid({ ...browserRequest(), temporaryPassword: "ShouldNotExist1!" });
    assert.throws(
      () =>
        buildAgentOperationRequest(
          parseBrowserOperationRequest(browserRequest()),
          "not-an-auth-uid",
        ),
      CentralUserManagerContractError,
    );
  });

  it("supports only the five approved actions with exact payload keys", () => {
    for (const action of [
      "create_user",
      "reissue_temporary_password",
      "suspend_user",
      "reactivate_user",
    ] as const) {
      assert.deepEqual(
        parseBrowserOperationRequest(
          browserRequest({
            action,
            payload: { email: "  Admin@Example.COM  " },
          }),
        ),
        {
          tenantId: TENANT_ID,
          operationId: OPERATION_ID,
          action,
          payload: { email: "admin@example.com" },
        },
      );
    }

    assertInvalid(browserRequest({ action: "delete_user", payload: {} }));
    assertInvalid(
      browserRequest({
        action: "list_users",
        payload: { page: 1, pageSize: 25, email: "admin@example.com" },
      }),
    );
    assertInvalid(
      browserRequest({
        action: "create_user",
        payload: { email: "admin@example.com", password: "ShouldNotExist1!" },
      }),
    );
  });

  it("bounds list pagination to positive integers no greater than 100", () => {
    for (const payload of [
      { page: 0, pageSize: 25 },
      { page: 101, pageSize: 25 },
      { page: 1.5, pageSize: 25 },
      { page: 1, pageSize: 0 },
      { page: 1, pageSize: 101 },
      { page: 1, pageSize: Number.NaN },
    ]) {
      assertInvalid(browserRequest({ payload }));
    }

    assert.deepEqual(
      parseBrowserOperationRequest(
        browserRequest({ payload: { page: 100, pageSize: 100 } }),
      ).payload,
      { page: 100, pageSize: 100 },
    );
  });

  it("normalizes valid email and rejects blank, malformed, whitespace, or oversized values", () => {
    for (const email of [
      "",
      "admin",
      "admin @example.com",
      "admin@example .com",
      "ad\u0000min@example.com",
      "admin@example\u200b.com",
      ".admin@example.com",
      "admin.@example.com",
      "admin..owner@example.com",
      "admin@example..com",
      "admin@-example.com",
      "admin@example-.com",
      `a@${"b".repeat(250)}.com`,
      null,
    ]) {
      assertInvalid(
        browserRequest({ action: "create_user", payload: { email } }),
      );
    }

    const localPart = "a".repeat(64);
    const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    const email = `${localPart}@${domain}`;
    assert.equal(email.length, 254);
    assert.deepEqual(
      parseBrowserOperationRequest(
        browserRequest({ action: "create_user", payload: { email } }),
      ).payload,
      { email },
    );
  });

  it("rejects symbol and non-enumerable extra keys at exported object boundaries", () => {
    const withSymbol = browserRequest();
    Object.defineProperty(withSymbol, Symbol("secret"), {
      enumerable: false,
      value: "hidden",
    });
    assertInvalid(withSymbol);

    const withHidden = browserRequest();
    Object.defineProperty(withHidden, "hidden", {
      enumerable: false,
      value: "secret",
    });
    assertInvalid(withHidden);
  });
});

describe("Central User Manager operation binding hash", () => {
  it("hashes a fixed-order normalized binding to a stable SHA-256 hex value", async () => {
    const agentRequest = buildAgentOperationRequest(
      parseBrowserOperationRequest(browserRequest()),
      ACTOR_UID,
    );

    assert.deepEqual(toCentralOperationBinding(agentRequest), {
      version: 1,
      tenantId: TENANT_ID,
      actorUid: ACTOR_UID,
      action: "list_users",
      payload: { page: 1, pageSize: 25 },
    });
    assert.equal(
      await hashCentralOperationBinding(
        toCentralOperationBinding(agentRequest),
      ),
      "ad2d3912856ce8965a43ef83e3a47b5a776847252007b98ab8b495b45165ddf3",
    );
  });

  it("changes for a changed binding but not for a different operation UUID", async () => {
    const original = buildAgentOperationRequest(
      parseBrowserOperationRequest(browserRequest()),
      ACTOR_UID,
    );
    const sameBindingNewOperation = buildAgentOperationRequest(
      parseBrowserOperationRequest(
        browserRequest({ operationId: OTHER_OPERATION_ID }),
      ),
      ACTOR_UID,
    );
    const changedBinding = buildAgentOperationRequest(
      parseBrowserOperationRequest(
        browserRequest({
          action: "create_user",
          payload: { email: " ADMIN@EXAMPLE.COM " },
        }),
      ),
      ACTOR_UID,
    );

    const originalHash = await hashCentralOperationBinding(
      toCentralOperationBinding(original),
    );
    assert.equal(
      await hashCentralOperationBinding(
        toCentralOperationBinding(sameBindingNewOperation),
      ),
      originalHash,
    );
    assert.equal(
      await hashCentralOperationBinding(
        toCentralOperationBinding(changedBinding),
      ),
      "62e0219df82798f51a5291075638768ace717f58c496aee9fac8645749bb7841",
    );
    assert.notEqual(
      await hashCentralOperationBinding(
        toCentralOperationBinding(changedBinding),
      ),
      originalHash,
    );
  });
});

describe("Central User Manager safe errors", () => {
  it("returns only an allowlisted fallback and never inspects raw secret-bearing input", () => {
    const raw = {
      get message(): string {
        throw new Error(
          "https://tenant.example Bearer token ciphertext iv KEK temporaryPassword raw body",
        );
      },
    };

    assert.deepEqual(
      normalizeSafeCentralUserError(raw, "provider_failure"),
      SAFE_CENTRAL_USER_ERROR_CATALOG.provider_failure,
    );
    assert.doesNotMatch(
      JSON.stringify(
        normalizeSafeCentralUserError(raw, "provider_failure"),
      ),
      /tenant|bearer|token|ciphertext|\biv\b|kek|password|raw body/i,
    );
  });

  it("fails closed for a runtime fallback key outside the safe catalog", () => {
    assert.throws(
      () =>
        normalizeSafeCentralUserError(
          new Error("raw provider body"),
          "__proto__" as never,
        ),
      /Invalid safe user-management error code/,
    );
  });
});
