import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("Webook user management UI", () => {
  it("shows a responsive list with identity and role details", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /<TableHead[^>]*>ชื่อ<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>Username<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>อีเมล<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>Role<\/TableHead>/);
    assert.match(table, /md:hidden/);
    assert.match(table, /hidden[^\"]*md:block/);
  });

  it("offers only an icon-labelled edit action", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /PencilIcon/);
    assert.match(table, /แก้ไข/);
    assert.doesNotMatch(table, /BanIcon|ShieldCheckIcon|Ban|ปลด Ban/);
  });

  it("edits only name and a role selected from the loaded roles", () => {
    const page = read("../components/admin/user-management/user-management-page.tsx");

    assert.match(page, /<DialogTitle>แก้ไขผู้ใช้<\/DialogTitle>/);
    assert.match(page, /name="name"/);
    assert.match(page, /name="roleId"/);
    assert.match(page, /roles\.map\(/);
    assert.doesNotMatch(page, /name="(?:email|username|tel)"/);
    assert.doesNotMatch(page, /Ban|ปลด Ban/);
  });

  it("depends on shared DTOs instead of the server repository layer", () => {
    const files = [
      read("../components/admin/user-management/user-table.tsx"),
      read("../components/admin/user-management/user-management-page.tsx"),
    ].join("\n");

    assert.match(files, /lib\/webook-users/);
    assert.doesNotMatch(files, /server\/repositories\/webook-users/);
  });
});
