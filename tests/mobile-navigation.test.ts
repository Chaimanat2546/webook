import assert from "node:assert/strict";
import { test } from "node:test";
import { createMobileNavigationMemory, mobileDestinations, mobileSection, isMobileWorkspace, mobileTitle } from "../lib/mobile-navigation.ts";

test("list memory preserves queries across external navigation and ignores detail routes", () => {
  const memory = createMobileNavigationMemory();
  let notifications = 0;
  const unsubscribe = memory.subscribe(() => { notifications++; });
  memory.remember("/admin/quotations", "q=test&page=2");
  memory.remember("/admin/quotations/customers", "q=customer");
  memory.remember("/admin/quotations/new", "private=value");
  assert.equal(memory.getSnapshot()["/admin/quotations"], "/admin/quotations?q=test&page=2");
  assert.equal(memory.getSnapshot()["/admin/quotations/new"], undefined);
  const snapshot = memory.getSnapshot();
  memory.remember("/admin/quotations/customers", "q=customer");
  assert.equal(memory.getSnapshot(), snapshot);
  assert.equal(notifications, 2);
  assert.deepEqual(createMobileNavigationMemory().getSnapshot(), {});
  unsubscribe();
  memory.remember("/admin/quotations", "");
  assert.equal(notifications, 2);
});

test("mobile destinations follow permissions without duplicate quotation/customer active states", () => {
  assert.deepEqual(mobileDestinations({ canAccessHouses: false, canUseQuotation: false }), []);
  assert.deepEqual(mobileDestinations({ canAccessHouses: true, canUseQuotation: false }).map(x => x.id), ["houses"]);
  assert.deepEqual(mobileDestinations({ canAccessHouses: false, canUseQuotation: true }).map(x => x.id), ["quotations", "customers"]);
  assert.equal(mobileSection("/admin/quotations/customers"), "customers");
  assert.equal(mobileSection("/admin/quotations/abc"), "quotations");
  assert.equal(mobileSection("/admin/quotations-old"), "more");
  assert.equal(mobileSection("/admin/users"), "more");
});

test("editing workspaces keep their own back/save controls without a competing bottom bar", () => {
  for (const path of ["/admin/houses/abc", "/admin/houses/abc/images", "/admin/quotations/new", "/admin/quotations/abc", "/admin/quotations/settings/company", "/admin/advertisements/new", "/admin/users/abc"]) {
    assert.equal(isMobileWorkspace(path), true, path);
  }
  for (const path of ["/admin/houses", "/admin/quotations", "/admin/quotations/customers", "/admin/advertisements", "/admin/users", "/admin/user-manager"]) {
    assert.equal(isMobileWorkspace(path), false, path);
  }
  assert.equal(mobileTitle("/admin/quotations/customers"), "ลูกค้า");
  assert.equal(mobileTitle("/admin/advertisements"), "โฆษณา");
});
