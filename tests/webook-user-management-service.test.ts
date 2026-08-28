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
  totalUsers,
  users = [],
  roles = [],
}: {
  roleExists?: boolean;
  totalUsers?: number;
  users?: WebookManagedUser[];
  roles?: WebookManagedRole[];
} = {}) {
  const updates: Array<{ id: string; name: string; roleId: number }> = [];
  const listCalls: Array<{
    page: number;
    pageSize: number;
    roleIds: number[];
    search: string;
    sortBy: string;
    sortDirection: string;
  }> = [];
  const resolvedTotalUsers = totalUsers ?? users.length;
  const repository: WebookUsersRepository = {
    async listRoles() {
      return roles;
    },
    async listUsers({ page, pageSize, roleIds = [], search, sortBy = "name", sortDirection = "asc" }) {
      listCalls.push({ page, pageSize, roleIds, search, sortBy, sortDirection });
      return { totalUsers: resolvedTotalUsers, users };
    },
    async getUser(id) {
      return users.find((user) => user.id === id) ?? null;
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

  return { listCalls, repository, updates };
}

describe("Webook user management service", () => {
  it("loads roles independently for the search controls", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const roles: WebookManagedRole[] = [{ id: 1, name: "ผู้ดูแลระบบ" }];
    const { repository } = createRepository({ roles });

    const result = await service.listWebookUserRoles({ repository });

    assert.deepEqual(result, roles);
  });

  it("lists the requested page of users and every role supplied by the roles table repository", async () => {
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
    const { listCalls, repository } = createRepository({ roles, totalUsers: 17, users });

    const result = await service.listWebookUserManagementData({
      page: 2,
      repository,
      search: "  somchai  ",
    });

    assert.deepEqual(listCalls, [{
      page: 2,
      pageSize: 8,
      roleIds: [],
      search: "somchai",
      sortBy: "name",
      sortDirection: "asc",
    }]);
    assert.deepEqual(result, {
      pagination: { page: 2, pageSize: 8, totalPages: 3, totalUsers: 17 },
      roles,
      users,
    });
  });

  it("uses the final available page when a requested page is out of range", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const { listCalls, repository } = createRepository({ totalUsers: 17 });

    const result = await service.listWebookUserManagementData({ page: 99, repository });

    assert.deepEqual(listCalls, [
      { page: 99, pageSize: 8, roleIds: [], search: "", sortBy: "name", sortDirection: "asc" },
      { page: 3, pageSize: 8, roleIds: [], search: "", sortBy: "name", sortDirection: "asc" },
    ]);
    assert.equal(result.pagination.page, 3);
  });

  it("forwards multiple role filters and the requested sort to the repository", async () => {
    const service = await loadService();
    assert.ok(service, "Webook user management service must exist");
    const { listCalls, repository } = createRepository();

    await service.listWebookUserManagementData({
      page: 1,
      repository,
      roleIds: [3, 1, 3, -1],
      sortBy: "email",
      sortDirection: "desc",
    });

    assert.deepEqual(listCalls, [{
      page: 1,
      pageSize: 8,
      roleIds: [1, 3],
      search: "",
      sortBy: "email",
      sortDirection: "desc",
    }]);
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

    assert.deepEqual(result, { ok: false, message: "สิทธิ์ผู้ใช้ที่เลือกไม่ถูกต้อง" });
    assert.deepEqual(updates, []);
  });
});
