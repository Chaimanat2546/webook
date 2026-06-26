import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/houses/house-list.tsx", import.meta.url),
  "utf8",
);

describe("house list table UI", () => {
  it("uses separate bedroom, bathroom, and zone columns instead of a details column", () => {
    assert.match(source, /<TableHead>ห้องนอน<\/TableHead>/);
    assert.match(source, /<TableHead>ห้องน้ำ<\/TableHead>/);
    assert.match(source, /<TableHead>ทำเล\(zone\)<\/TableHead>/);
    assert.doesNotMatch(source, /<TableHead>รายละเอียด<\/TableHead>/);
  });
  it("passes the current list URL to image management links", () => {
    assert.match(source, /function imageHref\(propertyId: string, returnTo: string\)/);
    assert.match(source, /params\.set\("returnTo", returnTo\)/);
    assert.match(source, /export function HouseList\(\{ houses, returnTo \}/);
    assert.match(source, /href=\{imageHref\(house\.property_id, returnTo\)\}/);
  });
});
