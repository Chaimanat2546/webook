import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as adminAuth from "../server/auth/admin.ts";

interface UserManagementAuthModule {
  canManageCentralUsers?: (user: { allow_tools: { allow_members?: boolean } | null } | null) => boolean;
  canManageWebookUsers?: (user: { allow_tools: { allow_members?: boolean } | null } | null) => boolean;
}

describe("Webook user management authorization", () => {
  it("allows both user management areas only when allow_members is enabled", () => {
    const { canManageCentralUsers, canManageWebookUsers } = adminAuth as UserManagementAuthModule;

    assert.equal(typeof canManageWebookUsers, "function");
    assert.equal(typeof canManageCentralUsers, "function");
    assert.equal(canManageWebookUsers?.({ allow_tools: { allow_members: true } }), true);
    assert.equal(canManageCentralUsers?.({ allow_tools: { allow_members: true } }), true);
    assert.equal(canManageWebookUsers?.({ allow_tools: { allow_members: false } }), false);
    assert.equal(canManageCentralUsers?.({ allow_tools: null }), false);
    assert.equal(canManageWebookUsers?.(null), false);
  });

  it("wires the dedicated permission into a separate Webook users menu", () => {
    const layout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/layout/admin-shell.tsx", import.meta.url), "utf8");
    const sidebar = readFileSync(new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url), "utf8");

    assert.match(layout, /canManageWebookUsers=\{canManageWebookUsers\(adminUser\)\}/);
    assert.match(shell, /canManageWebookUsers: boolean/);
    assert.match(sidebar, /\{canManageWebookUsers \? \(/);
    assert.match(sidebar, /href="\/admin\/users"/);
    assert.match(sidebar, />ผู้ใช้ WeBook</);
    assert.match(sidebar, /href="\/admin\/user-manager"/);
  });
});
