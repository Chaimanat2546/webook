import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  WebookManagedRole,
  WebookManagedUser,
} from "../lib/webook-users.ts";
import type { WebookUsersRepository } from "../server/repositories/webook-users.ts";

async function loadService() {
  try {
    return await import("../server/services/webook-users.ts");
  } catch {
    return null;
  }
}

function createRepository({
  roleExists = true,
  users = [],
  roles = [],
}: {
  roleExists?: boolean;
  users?: WebookManagedUser[];
  roles?: WebookManagedRole[];
} = {}) {
  const updates: Array<{ id: string; name: string; roleId: number }> = [];
  const repository: WebookUsersRepository = {
    async listRoles() {
      return roles;
    },
    async listUsers() {
      return users;
    },
    async roleExists() {
      return roleExists;
    },
    async updateUser(id, fields) {
      updates.push({ id, ...fields });
      return {
        id,
        email: "user@example.com",
        name: fields.name,
        roleId: fields.roleId,
        username: "user",
      };
    },
  };

  return { repository, updates };
}

describe("Webook user management service", () => {
  it("lists users and every role supplied by the roles table repository", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");

    const users: WebookManagedUser[] = [{
      id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
      email: "user@example.com",
      name: "ผู้ใช้",
      roleId: 2,
      username: "user",
    }];
    const roles: WebookManagedRole[] = [
      { id: 1, name: "ผู้ดูแลระบบ" },
      { id: 2, name: "พนักงาน" },
    ];
    const { repository } = createRepository({ users, roles });

    const result = await service.listWebookUserManagementData({ repository });

    assert.deepEqual(result, { roles, users });
  });

  it("trims the name and updates only name and role ID when the selected role exists", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const { repository, updates } = createRepository();

    const result = await service.updateWebookUser(
      {
        id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
        name: "  สมชาย  ",
        roleId: "2",
      },
      { repository },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(updates, [{
      id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
      name: "สมชาย",
      roleId: 2,
    }]);
  });

  it("rejects invalid IDs, blank or oversized names, and invalid role IDs before updating", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const { repository, updates } = createRepository();

    const cases = [
      { id: "not-a-uuid", name: "สมชาย", roleId: "2" },
      { id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3", name: "   ", roleId: "2" },
      { id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3", name: "x".repeat(151), roleId: "2" },
      { id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3", name: "สมชาย", roleId: "0" },
      { id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3", name: "สมชาย", roleId: "2.5" },
    ];

    for (const input of cases) {
      const result = await service.updateWebookUser(input, { repository });
      assert.equal(result.ok, false);
    }
    assert.deepEqual(updates, []);
  });

  it("rejects a role ID that is absent from the roles table", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const { repository, updates } = createRepository({ roleExists: false });

    const result = await service.updateWebookUser(
      {
        id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
        name: "สมชาย",
        roleId: "99",
      },
      { repository },
    );

    assert.deepEqual(result, { ok: false, message: "Role ที่เลือกไม่ถูกต้อง" });
    assert.deepEqual(updates, []);
  });
});
