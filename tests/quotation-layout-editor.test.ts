import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "components/admin/quotations/quotation-layout-editor.tsx",
  "utf8",
);

describe("quotation layout editor drag and drop", () => {
  it("adds a zone-scoped sortable drag handle without replacing accessible controls", () => {
    assert.match(source, /import \{ DragDropProvider \} from "@dnd-kit\/react"/);
    assert.match(source, /useSortable\(/);
    assert.match(source, /group: `quotation-layout-\$\{block\.zone\}`/);
    assert.match(source, /ลาก .* เพื่อเรียงลำดับ/);
    assert.match(source, /<DragDropProvider onDragEnd=/);
    assert.match(source, /เลื่อน .* ขึ้น/);
  });

  it("normalizes drag order through the same validated quotation layout draft", () => {
    assert.match(source, /const reordered = move\(ordered, event\)/);
    assert.match(source, /\(index \+ 1\) \* 10/);
    assert.match(source, /update\(next\)/);
  });
});
