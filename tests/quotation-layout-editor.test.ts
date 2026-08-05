import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "components/admin/quotations/quotation-layout-editor.tsx",
  "utf8",
);

describe("quotation layout editor drag and drop", () => {
  it("adds a zone-scoped sortable drag handle with a selectable document-preview block", () => {
    assert.match(source, /import \{ DragDropProvider \} from "@dnd-kit\/react"/);
    assert.match(source, /useSortable\(/);
    assert.match(source, /group: `quotation-layout-\$\{block\.zone\}`/);
    assert.match(source, /ลาก .* เพื่อเรียงลำดับ/);
    assert.match(source, /<DragDropProvider onDragEnd=/);
    assert.match(source, /data-layout-a4-canvas/);
    assert.match(source, /role="button"/);
    assert.match(source, /BlockPreview/);
    assert.match(source, /quotationLayoutBlockRow\(config, block\.id\)/);
  });

  it("normalizes drag order through the same validated quotation layout draft", () => {
    assert.match(source, /const reordered = move\(ordered, event\)/);
    assert.match(source, /\(index \+ 1\) \* 10/);
    assert.match(source, /update\(next\)/);
  });

  it("locks block size and provides position-only controls", () => {
    assert.doesNotMatch(source, /WIDTH_PRESETS/);
    assert.doesNotMatch(source, /ความกว้างและตำแหน่ง/);
    assert.match(source, /ขนาดล็อกตามเทมเพลต/);
    assert.match(source, /ตำแหน่ง/);
    assert.match(source, /undoStack/);
    assert.match(source, /redoStack/);
    assert.match(source, /กำลังเลือก/);
  });
});
