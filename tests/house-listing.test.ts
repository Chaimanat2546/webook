import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOUSE_PAGE_SIZE,
  formatHouseActiveStatus,
  formatHouseZone,
  getPaginationItems,
  getPageRange,
  normalizeHouseSearch,
  sortActiveFirst,
  toListingPropertyIdSearchValue,
  toListingSearchFilter,
  toListingSearchPattern,
} from "../server/services/houses.ts";

describe("house listing rules", () => {
  it("uses 8 records per page", () => {
    assert.equal(HOUSE_PAGE_SIZE, 8);
    assert.deepEqual(getPageRange(1), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(3), { from: 16, to: 23 });
  });

  it("normalizes invalid pages to page 1", () => {
    assert.deepEqual(getPageRange(0), { from: 0, to: 7 });
    assert.deepEqual(getPageRange(Number.NaN), { from: 0, to: 7 });
  });

  it("trims search text", () => {
    assert.equal(normalizeHouseSearch("  pool villa  "), "pool villa");
    assert.equal(normalizeHouseSearch("   "), "");
  });

  it("escapes wildcard search input for PostgREST ilike", () => {
    assert.equal(toListingSearchPattern("A_100%"), "A\\_100\\%");
    assert.equal(toListingSearchPattern("A),id.eq.1"), "A id.eq.1");
  });

  it("extracts property ids from DV-prefixed search text case-insensitively", () => {
    assert.equal(toListingPropertyIdSearchValue("DV-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("dv-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("dV-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("Dv-181"), "181");
    assert.equal(toListingPropertyIdSearchValue("181"), "181");
    assert.equal(toListingPropertyIdSearchValue("DV-pool"), null);
  });

  it("builds listing search filters without applying ilike to property_id", () => {
    const filter = toListingSearchFilter("DV-181");

    assert.match(filter, /title\.ilike\.%DV-181%/);
    assert.match(filter, /location_zone\.ilike\.%DV-181%/);
    assert.match(filter, /property_id\.eq\.181/);
    assert.doesNotMatch(filter, /property_id\.ilike/);
  });

  it("sorts active houses first without losing inactive houses", () => {
    const houses = [
      { is_active: false, property_id: "B" },
      { is_active: true, property_id: "A" },
      { is_active: false, property_id: "C" },
    ];

    assert.deepEqual(sortActiveFirst(houses).map((house) => house.property_id), [
      "A",
      "B",
      "C",
    ]);
  });

  it("formats house zones with Thai labels and keeps unknown zones readable", () => {
    const zoneLabels = {
      bang_saen: "บางแสน",
      bang_saray: "บางเสร่",
      bangkok: "กรุงเทพ",
      bangsaray: "บางเสร่",
      bangsean: "บางแสน",
      hua_hin: "หัวหิน",
      huahin: "หัวหิน",
      jomtien: "จอมเทียน",
      khaoyai: "เขาใหญ่",
      pattaya: "พัทยา",
      rayong: "ระยอง",
      sattahip: "สัตหีบ",
    };

    for (const [zone, label] of Object.entries(zoneLabels)) {
      assert.equal(formatHouseZone(zone), label);
    }

    assert.equal(formatHouseZone("BANGSEAN"), "บางแสน");
    assert.equal(formatHouseZone("unknown-zone"), "unknown-zone");
    assert.equal(formatHouseZone(null), "-");
  });

  it("formats active status in Thai", () => {
    assert.equal(formatHouseActiveStatus(true), "ใช้งานอยู่");
    assert.equal(formatHouseActiveStatus(false), "ปิดใช้งาน");
    assert.equal(formatHouseActiveStatus(null), "ปิดใช้งาน");
  });

  it("collapses long pagination with ellipsis around the current page", () => {
    assert.deepEqual(getPaginationItems(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(getPaginationItems(8, 20), [1, "ellipsis", 7, 8, 9, "ellipsis", 20]);
    assert.deepEqual(getPaginationItems(2, 20), [1, 2, 3, 4, 5, "ellipsis", 20]);
    assert.deepEqual(getPaginationItems(19, 20), [1, "ellipsis", 16, 17, 18, 19, 20]);
  });
});
