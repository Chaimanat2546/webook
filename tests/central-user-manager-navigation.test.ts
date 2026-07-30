import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { canManageCentralUsers } from "../server/auth/admin.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Central User Manager navigation", () => {
  it("allows the menu only from the exact UID-matched role 1 row", () => {
    assert.equal(canManageCentralUsers({ role_id: 1 }), true);
    assert.equal(canManageCentralUsers({ role_id: 2 }), false);
    assert.equal(canManageCentralUsers({ role_id: null }), false);
    assert.equal(canManageCentralUsers(null), false);

    const auth = read("server/auth/admin.ts");
    const layout = read("app/admin/layout.tsx");
    assert.match(auth, /byUid: matches\.byUid/);
    assert.match(
      layout,
      /canManageCentralUsers=\{canManageCentralUsers\(byUid\)\}/,
    );
    assert.doesNotMatch(layout, /canManageCentralUsers\(adminUser\)/);
  });

  it("renders a complete capability-gated sidebar item", () => {
    const shell = read("components/layout/admin-shell.tsx");
    const sidebar = read("components/layout/admin-desktop-sidebar.tsx");
    assert.match(shell, /canManageCentralUsers/);
    assert.match(sidebar, /\{canManageCentralUsers \? \(/);
    assert.match(sidebar, /href="\/admin\/user-manager"/);
    assert.match(sidebar, /จัดการผู้ใช้ลูกค้า/);
    assert.match(sidebar, /tooltip="จัดการผู้ใช้ลูกค้า"/);
    assert.match(
      sidebar,
      /isActive=\{pathname\.startsWith\("\/admin\/user-manager"\)\}/,
    );
    assert.match(
      sidebar,
      /href="\/admin\/user-manager" onClick=\{closeMobileSidebar\}/,
    );
  });
});
