import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { canUseAccommodation, pickAdminUser } from "../server/auth/admin.ts";

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

  it("keeps admin layout as authentication only", () => {
    const layoutSource = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");

    assert.match(layoutSource, /await requireAdmin\(\)/);
    assert.doesNotMatch(layoutSource, /isAuthorized/);
    assert.doesNotMatch(layoutSource, /canUseAccommodation/);
  });
});
