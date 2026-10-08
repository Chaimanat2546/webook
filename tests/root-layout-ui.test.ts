import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("root layout font loading", () => {
  it("defines the WeBooks Coastal color tokens", () => {
    const globalStyles = readFileSync("app/globals.css", "utf8");

    for (const token of [
      "--background: #F6FBFC;",
      "--primary: #07557A;",
      "--ring: #2BAFC0;",
      "--sidebar-primary: #07557A;",
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
