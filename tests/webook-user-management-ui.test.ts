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

  it("offers only an icon-labelled edit link", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /PencilIcon/);
    assert.match(table, /แก้ไข/);
    assert.match(table, /href=\{`\/admin\/users\/\$\{encodeURIComponent\(userId\)\}`\}/);
    assert.doesNotMatch(table, /BanIcon|ShieldCheckIcon|Ban|ปลด Ban/);
  });

  it("edits only name and a role selected from the loaded roles", () => {
    const page = read("../app/admin/users/[id]/page.tsx");

    assert.match(page, /<h1[^>]*>แก้ไขผู้ใช้<\/h1>/);
    assert.match(page, /action=\{updateWebookUserFormAction\}/);
    assert.match(page, /name="name"/);
    assert.match(page, /name="roleId"/);
    assert.match(page, /roles\.map\(/);
    assert.doesNotMatch(page, /name="(?:email|username|tel)"/);
    assert.doesNotMatch(page, /Ban|ปลด Ban/);
  });

  it("shows an update error on the dedicated edit page", () => {
    const page = read("../app/admin/users/[id]/page.tsx");
    const actions = read("../app/admin/users/actions.ts");

    assert.match(page, /searchParams: Promise<\{ error\?: string \}>/);
    assert.match(page, /role="alert"/);
    assert.match(actions, /\?error=\$\{encodeURIComponent\(result\.message\)\}/);
  });

  it("shows a success toast after returning to the user list", () => {
    const page = read("../app/admin/users/page.tsx");
    const actions = read("../app/admin/users/actions.ts");
    const notification = read("../components/admin/user-management/user-save-notification.tsx");

    assert.match(actions, /redirect\("\/admin\/users\?success=1"\)/);
    assert.match(page, /<UserSaveNotification \/>/);
    assert.match(notification, /toast\.success\("บันทึกข้อมูลผู้ใช้แล้ว"\)/);
  });

  it("keeps the heading and search available while the user list loads", () => {
    const page = read("../app/admin/users/page.tsx");
    const shell = read("../components/admin/user-management/user-management-page.tsx");
    const skeleton = read("../components/admin/user-management/user-list-skeleton.tsx");

    assert.match(page, /<Suspense fallback=\{<UserListSkeleton \/>\}>/);
    assert.match(shell, /placeholder="ค้นหาชื่อ, Username หรืออีเมล\.\.\."/);
    assert.match(skeleton, /Array\.from\(\{ length: 8 \}\)/);
    assert.match(skeleton, /md:hidden/);
    assert.match(skeleton, /md:block/);
  });

  it("depends on shared DTOs instead of the server repository layer", () => {
    const files = [
      read("../components/admin/user-management/user-table.tsx"),
      read("../app/admin/users/[id]/page.tsx"),
    ].join("\n");

    assert.match(files, /lib\/webook-users/);
    assert.doesNotMatch(files, /server\/repositories\/webook-users/);
  });
});
