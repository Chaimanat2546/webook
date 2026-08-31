import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../components/admin/user-manager/user-table.tsx", import.meta.url), "utf8");

it("renders responsive houses-style table/cards", () => {
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden p-0 md:block/);
  assert.match(source, /function UserMobileActionsMenu/);
  assert.match(source, /<SheetContent side="bottom" className="rounded-t-xl p-0">/);
  assert.match(source, /<SheetTitle>จัดการผู้ใช้<\/SheetTitle>/);
  assert.match(source, /<PencilLineIcon aria-hidden \/>\s*จัดการ/);
  assert.match(source, /<UserMobileActionsMenu/);
  assert.match(source, /<TableHead[^>]*>อีเมล/);
  assert.match(source, /<TableHead[^>]*>สถานะ/);
  assert.match(source, /<TableHead[^>]*>การจัดการ/);
});

it("shows only the status-appropriate lifecycle action in each row menu", () => {
  const output = execFileSync(process.execPath, [
    "--import", "./tests/register-server-only.mjs",
    "--loader", "./tests/tsx-loader.mjs",
    "./tests/fixtures/central-user-manager-ui.mjs",
  ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const { actions } = JSON.parse(output) as { actions: Record<string, string[]> };
  const allowedActions = ["reissue_temporary_password", "suspend_user"];
  assert.deepEqual(actions.active, allowedActions);
  assert.deepEqual(actions.passwordChangeRequired, allowedActions);
  assert.deepEqual(actions.suspended, ["reactivate_user"]);
  assert.deepEqual(actions.abnormal, []);
});

it("renders every browser-safe Tenant status without narrowing the list result", () => {
  assert.match(source, /password_change_required/);
  assert.match(source, /abnormal/);
});
