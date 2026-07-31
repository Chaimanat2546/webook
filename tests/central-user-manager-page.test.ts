import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) =>
  readFileSync(new URL(path, root), "utf8");

describe("Central User Manager page", () => {
  it("uses the exact page guard and safe project repository", () => {
    const page = read("app/admin/user-manager/page.tsx");
    assert.match(page, /requireCentralUserManagerAdmin/);
    assert.match(page, /listCustomerProjects/);
    assert.match(page, /createSupabaseAdminClient/);
    assert.doesNotMatch(page, /agentOrigin|projectRef|bearerToken|ciphertext/);
  });

  it("provides responsive master-detail-status regions and first-class states", () => {
    const source = [
      "components/admin/user-manager/user-manager-page.tsx",
      "components/admin/user-manager/project-list.tsx",
      "components/admin/user-manager/user-table.tsx",
      "components/admin/user-manager/status-panel.tsx",
      "components/admin/user-manager/operation-status-card.tsx",
    ].map(read).join("\n");
    assert.match(source, /xl:grid-cols-\[16rem_minmax\(0,1fr\)_18rem\]/);
    assert.match(source, /โครงการลูกค้า/);
    assert.match(source, /ผู้ดูแลระบบ/);
    assert.match(source, /สถานะและการดำเนินการ/);
    assert.match(source, /ยังไม่มีโครงการ|ไม่พบโครงการ/);
    assert.match(source, /needs_review|quarantined/);
    assert.match(source, /safeErrorCode/);
    assert.match(source, /ต้องเปิดใช้งานใหม่/);
    assert.match(source, /ตรวจสอบและเปิดใช้งานอีกครั้ง/);
    assert.match(source, /onReactivateProject/);
    assert.match(
      read("components/admin/user-manager/project-list.tsx"),
      /disabled=\{isBusy\}/,
    );
    assert.match(source, /overflow-wrap:anywhere|break-all|truncate/);
  });

  it("creates every planned lifecycle and loading component", () => {
    for (const path of [
      "app/admin/user-manager/loading.tsx",
      "components/admin/user-manager/create-user-dialog.tsx",
      "components/admin/user-manager/user-action-dialog.tsx",
      "components/admin/user-manager/temporary-password-dialog.tsx",
      "components/admin/user-manager/operation-status-card.tsx",
      "components/admin/user-manager/user-status-badge.tsx",
      "app/api/admin/user-manager/projects/reactivate/route.ts",
    ]) {
      assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
    }
  });
});
