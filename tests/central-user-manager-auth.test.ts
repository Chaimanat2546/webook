import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageCentralUsers } from "../server/auth/admin.ts";

describe("central user manager authorization", () => {
  it("allows only users with allow_members enabled", () => {
    assert.equal(canManageCentralUsers({ allow_tools: { allow_members: true } }), true);
    assert.equal(canManageCentralUsers({ allow_tools: { allow_members: false } }), false);
    assert.equal(canManageCentralUsers({ allow_tools: null }), false);
    assert.equal(canManageCentralUsers(null), false);
  });
});
