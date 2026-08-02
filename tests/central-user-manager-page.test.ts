import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/admin/user-manager/user-manager-page.tsx", import.meta.url), "utf8");

describe("central user manager page", () => {
  it("uses a tenant list, user table, and action panel without browser destinations", () => {
    assert.match(source, /grid-cols-\[16rem_minmax\(0,1fr\)_18rem\]/);
    assert.match(source, /tenantKey/);
    assert.match(source, /เลือก Tenant/);
    assert.match(source, /ผู้ใช้ของ Tenant/);
    assert.doesNotMatch(source, /workers\.dev|CUM_BAAN_POOL_VILLA_STAGING|tenantId/);
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
});
