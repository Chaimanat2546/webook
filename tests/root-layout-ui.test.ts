import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("root layout font loading", () => {
  it("does not preload admin fonts that are not needed immediately on Thai pages", () => {
    assert.match(source, /Geist\(\{[\s\S]*preload: false[\s\S]*\}\)/);
    assert.match(source, /Geist_Mono\(\{[\s\S]*preload: false[\s\S]*\}\)/);
    assert.doesNotMatch(source, /preload: true/);
  });
});
