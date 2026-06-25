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
});
