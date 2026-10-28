import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("root layout font loading", () => {
  it("defines the WeBooks Royal/Azure color tokens", () => {
    const globalStyles = readFileSync("app/globals.css", "utf8");

    for (const token of [
      "--background: #F7F8FC;",
      "--primary: #2F3EE8;",
      "--ring: #5B8CFF;",
      "--sidebar-primary: #2F3EE8;",
    ]) {
      assert.match(globalStyles, new RegExp(token));
    }
  });

  it("loads the bundled Thai font without requiring a Google Fonts download", () => {
    assert.doesNotMatch(source, /next\/font\/google/);
    assert.match(source, /next\/font\/local/);
    assert.match(source, /NotoSansThai-Regular\.ttf/);
    assert.match(source, /NotoSansThai-SemiBold\.ttf/);
  });
});
