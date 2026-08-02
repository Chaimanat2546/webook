import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageCentralUsers } from "../server/auth/admin.ts";

describe("central user manager authorization", () => {
  it("allows only the exact role-1 administrator", () => {
    assert.equal(canManageCentralUsers({ role_id: 1 }), true);
    assert.equal(canManageCentralUsers({ role_id: 2 }), false);
    assert.equal(canManageCentralUsers(null), false);
  });
});
