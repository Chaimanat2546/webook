import assert from "node:assert/strict";
import { test } from "node:test";
import { createMobileNavigationMemory, mobileDestinations, mobileNavigationLayout, mobileSection, isMobileWorkspace, mobileTitle } from "../lib/mobile-navigation.ts";

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

const noTools = { canUseDashboard: false, canAccessHouses: false, canUseBooking: false, canUseQuotation: false, canUseAccommodation: false, canManageCentralUsers: false, canManageWebookUsers: false };
test("mobile destinations follow permissions without duplicate quotation/customer active states", () => {
  assert.deepEqual(mobileDestinations({ ...noTools, canAccessHouses: true, canUseBooking: true, canUseAccommodation: true, canUseQuotation: true }).map(x => x.id), ["bookings", "houses", "advertisements", "quotations"]);
  assert.deepEqual(mobileDestinations({ ...noTools, canAccessHouses: false, canUseQuotation: false }), []);
  assert.deepEqual(mobileDestinations({ ...noTools, canAccessHouses: true, canUseQuotation: false }).map(x => x.id), ["houses"]);
  assert.deepEqual(mobileDestinations({ ...noTools, canUseBooking: true }).map(x => x.id), ["bookings"]);
  assert.equal(mobileSection("/admin/bookings"), "bookings");
  assert.equal(mobileSection("/admin/dashboard/bookings"), "overview");
  assert.equal(mobileSection("/admin/dashboard/bookings/9"), "overview");
  assert.equal(mobileSection("/admin/dashboard/bookings-old"), "overview");
  assert.equal(mobileSection("/admin/bookings-old"), "more");
  assert.equal(isMobileWorkspace("/admin/bookings"), false);
  assert.equal(mobileTitle("/admin/bookings"), "การจอง");
  assert.equal(mobileTitle("/admin/dashboard"), "แดชบอร์ด");
  assert.equal(mobileSection("/admin/houses/abc/bookings"), "houses");
  assert.deepEqual(mobileDestinations({ ...noTools, canAccessHouses: false, canUseQuotation: true }).map(x => x.id), ["quotations"]);
  assert.equal(mobileSection("/admin/quotations/customers"), "quotations");
  assert.equal(mobileSection("/admin/quotations/abc"), "quotations");
  assert.equal(mobileSection("/admin/quotations-old"), "more");
  assert.equal(mobileSection("/admin/users"), "webookUsers");
  assert.deepEqual(mobileDestinations({ ...noTools, canUseAccommodation: true, canManageCentralUsers: true }).map(x => x.id), ["advertisements", "centralUsers"]);
  assert.deepEqual(mobileDestinations({ ...noTools, canManageWebookUsers: true }).map(x => x.id), ["webookUsers"]);
  assert.equal(mobileSection("/admin/user-manager"), "centralUsers");
  assert.equal(mobileSection("/admin/advertisements"), "advertisements");
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

test("all permission combinations keep the fixed module order and put only the first three in the dock", () => {
  const flags = ["canUseDashboard", "canUseBooking", "canAccessHouses", "canUseAccommodation", "canUseQuotation", "canManageCentralUsers", "canManageWebookUsers"] as const;
  const ids = ["overview", "bookings", "houses", "advertisements", "quotations", "centralUsers", "webookUsers"];
  for (let mask = 0; mask < 128; mask++) {
    const permissions = { ...noTools };
    flags.forEach((flag, index) => { permissions[flag] = Boolean(mask & (1 << index)); });
    const expected = ids.filter((_, index) => Boolean(mask & (1 << index)));
    const layout = mobileNavigationLayout(permissions);
    assert.deepEqual(layout.modules.map(item => item.id), expected);
    assert.deepEqual(layout.dock.map(item => item.id), expected.length > 1 ? expected.slice(0, 3) : []);
    assert.deepEqual(layout.overflow.map(item => item.id), expected.slice(3));
  }
});
