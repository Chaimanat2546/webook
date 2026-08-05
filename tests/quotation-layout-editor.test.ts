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
    assert.match(source, /เพื่อสลับตำแหน่งกัน/);
    assert.match(source, /<DragDropProvider onDragEnd=/);
    assert.match(source, /data-layout-a4-canvas/);
    assert.match(source, /role="button"/);
    assert.match(source, /BlockPreview/);
    assert.match(source, /quotationLayoutBlockRow\(config, block\.id\)/);
    assert.match(source, /quotationLayoutBlockRowSpan\(template, block\.id\)/);
    assert.match(source, /data-layout-position-controls/);
    assert.match(source, /data-layout-template=\{template\}/);
    assert.match(source, /TEMPLATE_CANVAS/);
    assert.match(source, /จำนวนเงินทั้งสิ้น/);
    assert.match(source, /bg-indigo-50/);
    assert.match(source, /disabled=\{isPending \|\| !canMove\(block\.id, "up"\)\}/);
  });

  it("swaps the source and target positions through the same validated quotation layout draft", () => {
    assert.match(source, /function swapPositions/);
    assert.match(source, /event\.operation\.source\?\.id/);
    assert.match(source, /event\.operation\.target\?\.id/);
    assert.match(source, /swapPositions\(source\.id, target\.id\)/);
    assert.match(source, /function directionalTarget/);
    assert.match(source, /function canMoveFromLayout/);
    assert.match(source, /function swappedLayout/);
    assert.match(source, /quotationLayoutBlockRow\(draft, block\.id\) === sourceRow/);
  });

  it("locks block size and provides position-only controls", () => {
    assert.doesNotMatch(source, /WIDTH_PRESETS/);
    assert.doesNotMatch(source, /ความกว้างและตำแหน่ง/);
    assert.match(source, /ขนาดล็อกตามเทมเพลต/);
    assert.match(source, /ตำแหน่ง/);
    assert.match(source, /ใช้ปุ่มย้ายตำแหน่งบนบล็อกที่เลือกในหน้ากระดาษได้โดยตรง/);
    assert.match(source, /undoStack/);
    assert.match(source, /redoStack/);
    assert.match(source, /กำลังเลือก/);
  });
});
