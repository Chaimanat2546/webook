import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  ADMIN_ROLE_ID,
  canAccessAdmin,
  pickAdminUser,
} from "../server/auth/admin.ts";

describe("admin authorization", () => {
  it("allows only Administrator role", () => {
    assert.equal(canAccessAdmin({ role_id: ADMIN_ROLE_ID }), true);
    assert.equal(canAccessAdmin({ role_id: 2 }), false);
    assert.equal(canAccessAdmin({ role_id: 3 }), false);
    assert.equal(canAccessAdmin(null), false);
  });

  it("prefers uid match before email fallback", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: { id: 1, role_id: 3 },
      byEmail: { id: 2, role_id: 1 },
    });

    assert.deepEqual(user, { id: 1, role_id: 3 });
  });

  it("uses email fallback when uid match is missing", () => {
    const user = pickAdminUser({
      authUser: { id: "auth-1", email: "admin@example.com" },
      byUid: null,
      byEmail: { id: 2, role_id: 1 },
    });

    assert.deepEqual(user, { id: 2, role_id: 1 });
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
});
