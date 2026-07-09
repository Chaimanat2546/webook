import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const comboboxUrl = new URL(
  "../components/admin/houses/house-detail-combobox.tsx",
  import.meta.url,
);

describe("house detail combobox UI", () => {
  it("wraps shadcn combobox with a hidden form value", () => {
    assert.equal(existsSync(comboboxUrl), true);

    const source = readFileSync(comboboxUrl, "utf8");

    assert.match(source, /"use client"/);
    assert.match(source, /ui\/combobox/);
    assert.match(source, /<input name=\{name\} type="hidden" value=\{selectedOption\?\.value \?\? ""\}/);
    assert.match(source, /itemToStringValue=\{\(option\) => option\.label\}/);
    assert.match(source, /onValueChange=\{setSelectedOption\}/);
  });
});
