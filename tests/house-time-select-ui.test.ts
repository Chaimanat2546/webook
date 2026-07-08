import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const timeSelectUrl = new URL(
  "../components/admin/houses/house-time-select.tsx",
  import.meta.url,
);

describe("house time select UI", () => {
  it("uses 24-hour hour and minute selects with a hidden HH:mm form value", () => {
    assert.equal(existsSync(timeSelectUrl), true);

    const source = readFileSync(timeSelectUrl, "utf8");

    assert.match(source, /"use client"/);
    assert.match(source, /const HOURS = Array\.from\(\{ length: 24 \}/);
    assert.match(source, /const MINUTES = Array\.from\(\{ length: 60 \}/);
    assert.match(source, /<input name=\{name\} type="hidden" value=\{timeValue\}/);
    assert.match(source, /<select[\s\S]*id=\{`\$\{id\}_hour`\}/);
    assert.match(source, /<select[\s\S]*id=\{`\$\{id\}_minute`\}/);
    assert.match(source, /w-fit grid-cols-\[4\.5rem_auto_4\.5rem\]/);
    assert.match(source, /`\$\{hour\}:\$\{minute\}`/);
    assert.doesNotMatch(source, /type="time"/);
    assert.doesNotMatch(source, /AM|PM|en-GB/);
  });
});
