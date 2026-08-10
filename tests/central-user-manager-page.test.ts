import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/admin/user-manager/user-manager-page.tsx", import.meta.url), "utf8");

describe("central user manager page", () => {
  it("uses a tenant list and user table without browser destinations", () => {
    assert.match(source, /grid-cols-\[16rem_minmax\(0,1fr\)_18rem\]/);
    assert.match(source, /tenantKey/);
    assert.match(source, /เลือก Tenant/);
    assert.match(source, /ผู้ใช้ทั้งหมด/);
    assert.doesNotMatch(source, /workers\.dev|CUM_BAAN_POOL_VILLA_STAGING|tenantId/);
  });

  it("shows table-shaped skeleton rows while the first user list is loading", () => {
    assert.match(source, /import \{ Skeleton \} from "\.\.\/\.\.\/ui\/skeleton"/);
    assert.match(source, /listPending && !listed/);
    assert.match(source, /aria-label="กำลังโหลดรายชื่อผู้ใช้"/);
    assert.match(source, /Array\.from\(\{ length: 5 \}\)/);
  });
  it("loads page one automatically with ten users when the selected Tenant changes", () => {
    assert.match(source, /useEffect\(\(\) => \{/);
    assert.match(source, /createCentralUserListFormData/);
    assert.match(source, /if \(selectedKey\) loadUsers\(selectedKey, 1\)/);
  });

  it("offers bounded previous and next list navigation without page-size input", () => {
    assert.match(source, /ก่อนหน้า/);
    assert.match(source, /ถัดไป/);
    assert.match(source, /disabled=\{listPending \|\| listed\.pagination\.page === 1\}/);
    assert.match(source, /disabled=\{listPending \|\| !listed\.pagination\.hasMore\}/);
    assert.doesNotMatch(source, /name="pageSize"/);
  });

  it("places create user in the page header and removes tenant-panel operation buttons", () => {
    assert.match(source, /flex flex-wrap items-start justify-between/);
    assert.match(source, /disabled=\{!selected\?\.enabled\}/);
    assert.match(source, /action: createCentralUserAction, label: "สร้างผู้ใช้"/);
    assert.doesNotMatch(source, /\[\[createCentralUserAction,"สร้างผู้ใช้"\],\[reissueCentralUserPasswordAction/);
    assert.doesNotMatch(source, /<aside className="space-y-3">/);
  });

  it("passes selected user actions into the confirmation dialog without editable email", () => {
    assert.match(source, /<UserTable/);
    assert.match(source, /setDialogAction\(\{ action, label, email: rowEmail \}\)/);
    assert.match(source, /disabled=\{Boolean\(dialogAction\?\.email\)\}/);
    assert.doesNotMatch(source, /<ul aria-busy/);
  });

  it("shows a clear message when a stale lifecycle action is rejected", () => {
    assert.match(source, /operation\.error\?\.code === "invalid_lifecycle_transition"/);
    assert.match(source, /คำสั่งนี้ใช้ไม่ได้กับสถานะผู้ใช้ปัจจุบัน/);
    assert.match(source, /operationMessage\(result\.operation\)/);
  });

  it("uses disabled fields without dialog autofocus and copies passwords only on request", () => {
    assert.match(source, /disabled=\{Boolean\(dialogAction\?\.email\)\}/);
    assert.match(source, /onOpenAutoFocus=\{\(event\) => event\.preventDefault\(\)\}/);
    assert.match(source, /aria-label="รหัสผ่านชั่วคราว" disabled/);
    assert.match(source, /navigator\.clipboard\.writeText\(password\.value\)/);
    assert.match(source, /คัดลอกแล้ว/);
  });
});
