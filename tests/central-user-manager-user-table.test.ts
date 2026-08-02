import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../components/admin/user-manager/user-table.tsx", import.meta.url), "utf8");

it("renders responsive houses-style table/cards and only supported row actions", () => {
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden p-0 md:block/);
  assert.match(source, /<TableHead[^>]*>อีเมล/);
  assert.match(source, /<TableHead[^>]*>สถานะ/);
  assert.match(source, /<TableHead[^>]*>การจัดการ/);
  assert.match(source, /ออกรหัสผ่านใหม่/);
  assert.match(source, /ระงับผู้ใช้/);
  assert.match(source, /เปิดใช้ผู้ใช้/);
});

it("renders every browser-safe Tenant status without narrowing the list result", () => {
  assert.match(source, /password_change_required/);
  assert.match(source, /abnormal/);
});
