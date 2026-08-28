import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("root layout font loading", () => {
  it("loads the bundled Thai font without requiring a Google Fonts download", () => {
    assert.doesNotMatch(source, /next\/font\/google/);
    assert.match(source, /next\/font\/local/);
    assert.match(source, /NotoSansThai-Regular\.ttf/);
    assert.match(source, /NotoSansThai-SemiBold\.ttf/);
  });
});
