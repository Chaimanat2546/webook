import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  authorizeCentralUserManagerAdmin,
  CentralUserManagerAuthorizationError,
  requireCentralUserManagerAdminWithLoader,
} from "../server/auth/central-user-manager-admin.ts";

interface FakeAuthResult {
  data: {
    user: { id: string; email?: string | null } | null;
  };
  error: { message: string } | null;
}

interface FakeUsersResult {
  data: Array<{ role_id: number | null; uid: string | null }> | null;
  error: { message: string } | null;
}

function fakeSessionClient(result: FakeAuthResult) {
  return {
    auth: {
      async getUser() {
        return result;
      },
    },
  };
}

class FakeUsersQuery {
  private readonly result: FakeUsersResult;

  constructor(result: FakeUsersResult) {
    this.result = result;
  }

  select(columns: string) {
    assert.equal(columns, "uid, role_id");
    return this;
  }

  eq(column: string, value: string | number) {
    if (column === "uid") {
      assert.equal(value, "11111111-1111-4111-8111-111111111111");
    } else {
      assert.equal(column, "role_id");
      assert.equal(value, 1);
    }
    return this;
  }

  async limit(count: number) {
    assert.equal(count, 2);
    return this.result;
  }
}

function fakeServiceClient(
  result: FakeUsersResult,
  onQuery: () => void = () => undefined,
) {
  return {
    from(table: string) {
      onQuery();
      assert.equal(table, "users");
      return new FakeUsersQuery(result);
    },
  };
}

const authenticatedSession = fakeSessionClient({
  data: {
    user: {
      email: "legacy@example.com",
      id: "11111111-1111-4111-8111-111111111111",
    },
  },
  error: null,
});

async function expectAuthorizationError(
  operation: () => Promise<unknown>,
  expected: {
    code: string;
    status: number;
  },
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof CentralUserManagerAuthorizationError);
    assert.equal(error.code, expected.code);
    assert.equal(error.status, expected.status);
    assert.equal(error.message, "Central User Manager authorization failed");
    return true;
  });
}

describe("Central User Manager authorization", () => {
  it("returns only the exact Auth UID for one role 1 row", async () => {
    const result = await authorizeCentralUserManagerAdmin(
      authenticatedSession,
      fakeServiceClient({
        data: [
          {
            role_id: 1,
            uid: "11111111-1111-4111-8111-111111111111",
          },
        ],
        error: null,
      }),
    );

    assert.deepEqual(result, {
      actorUid: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects a missing or failed session before a privileged query", async () => {
    for (const result of [
      { data: { user: null }, error: null },
      {
        data: { user: null },
        error: { message: "raw auth provider detail" },
      },
    ]) {
      let queryCount = 0;
      await expectAuthorizationError(
        () =>
          authorizeCentralUserManagerAdmin(
            fakeSessionClient(result),
            fakeServiceClient(
              { data: [], error: null },
              () => {
                queryCount += 1;
              },
            ),
          ),
        { code: "unauthorized", status: 401 },
      );
      assert.equal(queryCount, 0);
    }
  });

  it("rejects email-only legacy access, missing rows, duplicates, and role mismatch", async () => {
    for (const rows of [
      [],
      [
        {
          role_id: 1,
          uid: "22222222-2222-4222-8222-222222222222",
        },
      ],
      [
        {
          role_id: 2,
          uid: "11111111-1111-4111-8111-111111111111",
        },
      ],
      [
        {
          role_id: 1,
          uid: "11111111-1111-4111-8111-111111111111",
        },
        {
          role_id: 1,
          uid: "11111111-1111-4111-8111-111111111111",
        },
      ],
    ]) {
      await expectAuthorizationError(
        () =>
          authorizeCentralUserManagerAdmin(
            authenticatedSession,
            fakeServiceClient({ data: rows, error: null }),
          ),
        { code: "forbidden", status: 403 },
      );
    }
  });

  it("maps missing service configuration and database failures to safe 503", async () => {
    await expectAuthorizationError(
      () => authorizeCentralUserManagerAdmin(authenticatedSession, null),
      { code: "service_unavailable", status: 503 },
    );

    await expectAuthorizationError(
      () =>
        authorizeCentralUserManagerAdmin(
          authenticatedSession,
          fakeServiceClient({
            data: null,
            error: { message: "raw database policy detail" },
          }),
        ),
      { code: "service_unavailable", status: 503 },
    );

    await expectAuthorizationError(
      () =>
        authorizeCentralUserManagerAdmin(
          authenticatedSession,
          fakeServiceClient(null as unknown as FakeUsersResult),
        ),
      { code: "service_unavailable", status: 503 },
    );
  });

  it("maps client loading and malformed provider results to safe 503", async () => {
    await expectAuthorizationError(
      () =>
        requireCentralUserManagerAdminWithLoader(async () => {
          throw new Error("raw environment configuration detail");
        }),
      { code: "service_unavailable", status: 503 },
    );

    await expectAuthorizationError(
      () =>
        authorizeCentralUserManagerAdmin(
          fakeSessionClient(null as unknown as FakeAuthResult),
          fakeServiceClient({ data: [], error: null }),
        ),
      { code: "service_unavailable", status: 503 },
    );

    await expectAuthorizationError(
      () =>
        authorizeCentralUserManagerAdmin(
          authenticatedSession,
          fakeServiceClient({
            data: {} as unknown as FakeUsersResult["data"],
            error: null,
          }),
        ),
      { code: "service_unavailable", status: 503 },
    );
  });

  it("freezes the exact UID-only query and rejects legacy authorization paths", () => {
    const source = readFileSync(
      new URL(
        "../server/auth/central-user-manager-admin.ts",
        import.meta.url,
      ),
      "utf8",
    );

    assert.match(source, /\.select\("uid, role_id"\)/);
    assert.match(source, /\.eq\("uid", actorUid\)/);
    assert.match(source, /\.eq\("role_id", 1\)/);
    assert.match(source, /\.limit\(2\)/);
    assert.doesNotMatch(
      source,
      /findAdminUserByAuthIdentity|pickAdminUser|maybeSingle|allow_tools|username|\.eq\("email"/,
    );
  });
});
