import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createWebookUsersRepository } from "../server/repositories/webook-users.ts";

describe("Webook users repository", () => {
  it("maps JSON and string role names with a readable fallback", async () => {
    const client = {
      from(table: string) {
        assert.equal(table, "roles");
        return {
          select(columns: string) {
            assert.equal(columns, "id, name");
            return {
              async order(column: string, options: { ascending: boolean }) {
                assert.equal(column, "id");
                assert.deepEqual(options, { ascending: true });
                return {
                  data: [
                    { id: 1, name: { th: "ผู้ดูแลระบบ" } },
                    { id: 2, name: "Staff" },
                    { id: 3, name: { label: "Agent" } },
                    { id: 4, name: {} },
                  ],
                  error: null,
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const roles = await createWebookUsersRepository(client).listRoles();

    assert.deepEqual(roles, [
      { id: 1, name: "ผู้ดูแลระบบ" },
      { id: 2, name: "Staff" },
      { id: 3, name: "Agent" },
      { id: 4, name: "Role 4" },
    ]);
  });

  it("updates exactly the selected user's name and role ID", async () => {
    let updatePayload: unknown;
    const client = {
      from(table: string) {
        assert.equal(table, "users");
        return {
          update(payload: unknown) {
            updatePayload = payload;
            return {
              eq(column: string, value: string) {
                assert.equal(column, "id");
                assert.equal(value, "7a67c89b-3dd8-466c-86a1-e95fc39729b3");
                return {
                  select(columns: string) {
                    assert.equal(columns, "id, name, username, email, role_id");
                    return {
                      async maybeSingle() {
                        return {
                          data: {
                            id: value,
                            name: "สมชาย",
                            username: "user",
                            email: "user@example.com",
                            role_id: 2,
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const user = await createWebookUsersRepository(client).updateUser(
      "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
      { name: "สมชาย", roleId: 2 },
    );

    assert.deepEqual(updatePayload, { name: "สมชาย", role_id: 2 });
    assert.deepEqual(user, {
      email: "user@example.com",
      id: "7a67c89b-3dd8-466c-86a1-e95fc39729b3",
      name: "สมชาย",
      roleId: 2,
      username: "user",
    });
  });
});
