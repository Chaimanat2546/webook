import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/admin/images/image-zone-viewer.tsx", import.meta.url),
  "utf8",
);

describe("house image mobile UI", () => {
  it("bounds the mobile zones scroller and keeps image cards compact", () => {
    assert.match(source, /grid min-w-0 overflow-hidden/);
    assert.match(source, /aside className="min-w-0/);
    assert.match(source, /<ScrollArea className="w-full min-w-0"/);
    assert.match(source, /<nav\s+className="flex w-max min-w-full/);
    assert.match(source, /grid grid-cols-2 gap-3 p-3/);
  });
});
