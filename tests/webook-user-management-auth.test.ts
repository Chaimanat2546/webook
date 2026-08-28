import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as adminAuth from "../server/auth/admin.ts";

interface WebookUserAuthModule {
  canManageWebookUsers?: (user: { role_id: number | null } | null) => boolean;
}

describe("Webook user management authorization", () => {
  it("allows only role 1", () => {
    const canManageWebookUsers = (adminAuth as WebookUserAuthModule).canManageWebookUsers;

    assert.equal(typeof canManageWebookUsers, "function");
    assert.equal(canManageWebookUsers?.({ role_id: 1 }), true);
    assert.equal(canManageWebookUsers?.({ role_id: 2 }), false);
    assert.equal(canManageWebookUsers?.({ role_id: null }), false);
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
    assert.match(sidebar, />จัดการผู้ใช้ Webook</);
    assert.match(sidebar, /href="\/admin\/user-manager"/);
  });
});
