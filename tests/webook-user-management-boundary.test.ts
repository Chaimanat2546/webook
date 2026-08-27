import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("Webook user management server boundary", () => {
  it("guards the route before loading users and roles through the server-only service", () => {
    const page = read("../app/admin/users/page.tsx");

    const guardAt = page.indexOf("await requireWebookUserManagerAdmin()");
    const loadAt = page.indexOf("await listWebookUserManagementData()");
    assert.ok(guardAt >= 0);
    assert.ok(loadAt > guardAt);
    assert.doesNotMatch(page, /createSupabaseAdminClient/);
  });

  it("authorizes the update action and accepts only id, name, and roleId", () => {
    const actions = read("../app/admin/users/actions.ts");

    const guardAt = actions.indexOf("await requireWebookUserManagerAdmin()");
    const updateAt = actions.indexOf("await updateWebookUser(");
    assert.ok(guardAt >= 0);
    assert.ok(updateAt > guardAt);
    assert.match(actions, /readString\(formData, "id"\)/);
    assert.match(actions, /readString\(formData, "name"\)/);
    assert.match(actions, /readString\(formData, "roleId"\)/);
    assert.match(actions, /revalidatePath\("\/admin\/users"\)/);
    assert.doesNotMatch(actions, /banWebookUser|unbanWebookUser|auth\.admin/i);
    assert.doesNotMatch(actions, /readString\(formData, "(?:email|username|tel)"\)/);
    assert.doesNotMatch(actions, /createSupabaseAdminClient/);
  });

  it("keeps privileged Supabase access inside server-only service code", () => {
    const repository = read("../server/repositories/webook-users.ts");
    const service = read("../server/services/webook-users.ts");

    assert.match(repository, /import "server-only"/);
    assert.match(service, /import "server-only"/);
    assert.match(repository, /\.from\("roles"\)/);
    assert.match(repository, /\.from\("users"\)/);
    assert.match(repository, /\.update\(\{ name: fields\.name, role_id: fields\.roleId \}\)/);
    assert.match(service, /createSupabaseAdminClient/);
    assert.doesNotMatch(service, /auth\.admin|ban|unban/i);
  });
});
