import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "components/admin/quotations/quotation-layout-editor.tsx",
  "utf8",
);

describe("quotation layout editor drag and drop", () => {
  it("makes the complete preview block draggable within its zone", () => {
    assert.match(source, /import \{ DragDropProvider \} from "@dnd-kit\/react"/);
    assert.match(source, /useSortable\(/);
    assert.match(source, /group: `quotation-layout-\$\{block\.zone\}`/);
    assert.match(source, /กดค้างแล้วลากบล็อกทั้งใบ/);
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
    assert.match(source, /cursor-grab/);
    assert.doesNotMatch(source, /ref=\{handleRef\}/);
    assert.match(source, /data-layout-position-controls onPointerDown/);
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

  it("moves payment methods and public notes as one settlement column", () => {
    assert.match(source, /function settlementColumnLayout/);
    assert.match(source, /publicNotes\.column = paymentMethods\.column/);
    assert.match(source, /publicNotes\.order = settlementOrder \+ 10/);
  });

  it("shows only the current and immediately previous layout versions", () => {
    assert.match(source, /const visibleRevisions = revisions\.slice\(0, 2\)/);
    assert.match(source, /visibleRevisions\.map/);
    assert.match(source, /"ปัจจุบัน" : "ก่อนหน้า"/);
  });
});
