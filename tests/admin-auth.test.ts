import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canUseAccommodation, pickAdminUser } from "../server/auth/admin.ts";
import { findSignInEmailByUsername } from "../server/repositories/admin-users.ts";

interface FakeQueryResult {
  data: Array<{ email: string | null }> | null;
  error: { message: string } | null;
}

class FakeUsersQuery {
  private readonly result: FakeQueryResult;

  constructor(result: FakeQueryResult) {
    this.result = result;
  }

  select(columns: string) {
    assert.equal(columns, "email");
    return this;
  }

  eq(column: string, value: string) {
    assert.equal(column, "username");
    assert.equal(value, "admin");
    return this;
  }

  async limit(count: number) {
    assert.equal(count, 2);
    return this.result;
  }
}

function fakeUsersClient(result: FakeQueryResult) {
  return {
    from(table: string) {
      assert.equal(table, "users");
      return new FakeUsersQuery(result);
    },
  } as unknown as SupabaseClient;
}

describe("admin authorization", () => {
  it("allows house access from allow_accommodation only", () => {
    assert.equal(canUseAccommodation({ allow_tools: { allow_accommodation: true } }), true);
    assert.equal(canUseAccommodation({ allow_tools: { allow_accommodation: false } }), false);
    assert.equal(canUseAccommodation({ allow_tools: {} }), false);
    assert.equal(canUseAccommodation({ allow_tools: null }), false);
    assert.equal(canUseAccommodation(null), false);
  });

  it("prefers uid match before email fallback", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: { allow_tools: { allow_accommodation: false }, mid: 1, role_id: 3 },
      byEmail: { allow_tools: { allow_accommodation: true }, mid: 2, role_id: 1 },
    });

    assert.deepEqual(user, { allow_tools: { allow_accommodation: false }, mid: 1, role_id: 3 });
  });

  it("uses email fallback when uid match is missing", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: null,
      byEmail: { allow_tools: { allow_accommodation: true }, mid: 2, role_id: 1 },
    });

    assert.deepEqual(user, { allow_tools: { allow_accommodation: true }, mid: 2, role_id: 1 });
  });

  it("does not include a local auth override", () => {
    const adminAuthSource = readFileSync(new URL("../server/auth/admin.ts", import.meta.url), "utf8");
    const envFlag = ["ADMIN_AUTH", ["BY", "PASS"].join("")].join("_");
    const fixtureId = ["dev", ["by", "pass"].join("")].join("-");
    const helperName = ["isAdminAuth", "By", "passEnabled"].join("");

    assert.doesNotMatch(adminAuthSource, new RegExp(envFlag));
    assert.doesNotMatch(adminAuthSource, new RegExp(fixtureId));
    assert.doesNotMatch(adminAuthSource, new RegExp(helperName));
  });

  it("loads public users mid and allow_tools for feature permissions", () => {
    const repositorySource = readFileSync(new URL("../server/repositories/admin-users.ts", import.meta.url), "utf8");

    assert.match(repositorySource, /\.select\("mid, role_id, allow_tools"\)/);
    assert.doesNotMatch(repositorySource, /\.select\("id, role_id"\)/);
    assert.doesNotMatch(repositorySource, /\.select\("id:dv_id, role_id"\)/);
  });

  it("resolves a unique username to a sign-in email", async () => {
    const email = await findSignInEmailByUsername(
      fakeUsersClient({ data: [{ email: " admin@example.com " }], error: null }),
      " admin ",
    );

    assert.equal(email, "admin@example.com");
  });

  it("does not resolve missing, duplicate, or email-less usernames", async () => {
    assert.equal(await findSignInEmailByUsername(fakeUsersClient({ data: [], error: null }), "admin"), null);
    assert.equal(
      await findSignInEmailByUsername(
        fakeUsersClient({ data: [{ email: "a@example.com" }, { email: "b@example.com" }], error: null }),
        "admin",
      ),
      null,
    );
    assert.equal(await findSignInEmailByUsername(fakeUsersClient({ data: [{ email: null }], error: null }), "admin"), null);
  });

  it("keeps admin layout as authentication only", () => {
    const layoutSource = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");

    assert.match(layoutSource, /await requireAdmin\(\)/);
    assert.match(layoutSource, /export const dynamic = "force-dynamic"/);
    assert.doesNotMatch(layoutSource, /isAuthorized/);
    assert.doesNotMatch(layoutSource, /canUseAccommodation/);
  });
});
