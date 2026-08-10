import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../components/admin/user-manager/user-table.tsx", import.meta.url), "utf8");

it("renders responsive houses-style table/cards", () => {
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden p-0 md:block/);
  assert.match(source, /<TableHead[^>]*>อีเมล/);
  assert.match(source, /<TableHead[^>]*>สถานะ/);
  assert.match(source, /<TableHead[^>]*>การจัดการ/);
});

it("shows only the status-appropriate lifecycle action in each row menu", () => {
  assert.match(source, /function UserActionsMenu\(\{ email, status, onAction \}/);
  assert.match(source, /ออกรหัสผ่านใหม่/);
  assert.match(source, /status === "active" \|\| status === "password_change_required"/);
  assert.match(source, /status === "active" \|\| status === "password_change_required" \? \([\s\S]*reissue_temporary_password[\s\S]*suspend_user/);
  assert.match(source, /status === "suspended"/);
  assert.match(source, /status=\{user\.status\}/);
  assert.doesNotMatch(source, /<DropdownMenuItem onSelect=\{\(\) => onAction\("suspend_user", email\)\}>[\s\S]*ระงับผู้ใช้[\s\S]*<\/DropdownMenuItem>\s*<DropdownMenuItem onSelect=\{\(\) => onAction\("reactivate_user", email\)\}>/);
});

it("renders every browser-safe Tenant status without narrowing the list result", () => {
  assert.match(source, /password_change_required/);
  assert.match(source, /abnormal/);
});
