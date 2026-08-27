import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const table = readFileSync(
  new URL("../components/admin/user-management/user-table.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../components/admin/user-management/user-management-page.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8");

function renderedActions(): { active: string[]; banned: string[] } {
  const output = execFileSync(process.execPath, [
    "--import",
    "./tests/register-server-only.mjs",
    "--loader",
    "./tests/tsx-loader.mjs",
    "--input-type=module",
    "--eval",
    [
      "import { getWebookUserActions } from './components/admin/user-management/user-table.tsx';",
      "console.log(JSON.stringify({ active: getWebookUserActions(false), banned: getWebookUserActions(true) }));",
    ].join("\n"),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return JSON.parse(output) as { active: string[]; banned: string[] };
}

describe("Webook user management interface", () => {
  it("shows desktop columns and mobile cards for every editable field", () => {
    assert.match(table, /<TableHead[^>]*>ชื่อ<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>Username<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>อีเมล<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>เบอร์โทร<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>สถานะ<\/TableHead>/);
    assert.match(table, /<TableHead[^>]*>การจัดการ<\/TableHead>/);
    assert.match(table, /md:hidden/);
    assert.match(table, /hidden p-0 md:block/);
  });

  it("makes Ban and Unban mutually exclusive and icon-labelled", () => {
    const actions = renderedActions();

    assert.deepEqual(actions.active, ["edit", "ban"]);
    assert.deepEqual(actions.banned, ["edit", "unban"]);
    assert.match(table, /PencilIcon/);
    assert.match(table, /BanIcon/);
    assert.match(table, /ShieldCheckIcon/);
    assert.match(table, /aria-hidden/);
    assert.match(table, />\s*แก้ไข\s*</);
    assert.match(table, />\s*Ban\s*</);
    assert.match(table, />\s*ปลด Ban\s*</);
  });

  it("uses one editable dialog and distinct lifecycle confirmations", () => {
    assert.match(page, /<DialogTitle>แก้ไขผู้ใช้<\/DialogTitle>/);
    assert.match(page, /<DialogTitle>ยืนยันการ Ban ผู้ใช้<\/DialogTitle>/);
    assert.match(page, /<DialogTitle>ยืนยันการปลด Ban ผู้ใช้<\/DialogTitle>/);
    assert.match(page, /selectedUser\.name/);
    assert.match(page, /selectedUser\.email/);
    assert.doesNotMatch(page, /<Input[^>]*name="id"/);
  });

  it("submits immutable ids through transitions and refreshes only after success", () => {
    assert.match(page, /useTransition\(\)/);
    assert.match(page, /data\.set\("id", selectedUser\.id\)/);
    assert.match(page, /updateWebookUserAction/);
    assert.match(page, /banWebookUserAction/);
    assert.match(page, /unbanWebookUserAction/);
    assert.match(page, /if \(!result\.ok\)/);
    assert.match(page, /role="alert"/);
    assert.match(page, /role="status"/);
    assert.match(page, /router\.refresh\(\)/);
    assert.match(page, /disabled=\{isPending\}/);
  });

  it("replaces the route placeholder with the client management page", () => {
    assert.match(route, /<UserManagementPage initialUsers=\{users\} \/>/);
    assert.doesNotMatch(route, /ผู้ใช้ทั้งหมด \{users\.length\} คน/);
  });
});
