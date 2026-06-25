import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOUSE_PAGE_SIZE,
  getPageRange,
  normalizeHouseSearch,
  sortActiveFirst,
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
});
