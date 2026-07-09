import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const agentsSource = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

describe("house workspace shell agent guidance", () => {
  it("requires agents to decide whether the house workspace shell applies", () => {
    assert.match(agentsSource, /## House workspace shell style gate/);
    assert.match(agentsSource, /Before creating or changing any admin house-related page/);
    assert.match(agentsSource, /Use the shell when:/);
    assert.match(agentsSource, /app\/admin\/houses\/\[propertyId\]\/\.\.\./);
    assert.match(agentsSource, /Do not use the shell when:/);
    assert.match(agentsSource, /The page is the house list page/);
    assert.match(agentsSource, /When the shell applies:/);
    assert.match(agentsSource, /When the shell does not apply:/);
    assert.match(
      agentsSource,
      /docs\/superpowers\/specs\/2026-07-09-house-workspace-shell-design\.md/,
    );
  });
});
