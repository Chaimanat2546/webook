import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "components/admin/quotations/quotation-layout-editor.tsx",
  "utf8",
);
const settingsPageSource = readFileSync(
  "app/admin/quotations/settings/company/page.tsx",
  "utf8",
);

describe("quotation layout editor position controls", () => {
  it("uses a selectable document-preview block without drag and drop", () => {
    assert.doesNotMatch(source, /DragDropProvider/);
    assert.doesNotMatch(source, /useSortable/);
    assert.doesNotMatch(source, /GripVertical/);
    assert.doesNotMatch(source, /reorderZone/);
    assert.match(source, /data-layout-a4-canvas/);
    assert.match(source, /role="button"/);
    assert.match(source, /BlockPreview/);
    assert.match(source, /quotationLayoutBlockRow\(config, block\.id\)/);
    assert.match(source, /quotationLayoutBlockRowSpan\(template, block\.id\)/);
    assert.match(source, /data-layout-position-controls/);
    assert.match(source, /data-layout-template=\{template\}/);
    assert.match(source, /TEMPLATE_CANVAS/);
    assert.match(source, /จำนวนเงินทั้งสิ้น/);
    assert.match(source, /quotationThemePalette/);
    assert.match(source, /disabled=\{isPending \|\| !canMove\(block\.id, "up"\)\}/);
  });

  it("swaps positions through the same validated quotation layout draft", () => {
    assert.match(source, /function swapPositions/);
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

  it("selects one primary color inside the layout editor", () => {
    assert.match(source, /type="color"/);
    assert.match(source, /onInput=\{\(event\)/);
    assert.match(source, /updateThemeColor/);
    assert.match(source, /draft\.themeColor/);
    assert.match(source, /สีหลัก/);
  });

  it("resets the editor draft when switching quotation templates", () => {
    assert.match(
      settingsPageSource,
      /<QuotationLayoutEditor[\s\S]*key=\{selectedTemplate\}[\s\S]*template=\{selectedTemplate\}/,
    );
  });

  it("shows the non-movable document masthead above every movable section", () => {
    assert.match(source, /data-layout-locked-masthead/);
    assert.match(source, /ล็อกอยู่บนสุดเสมอ/);
    assert.match(source, /QO-000001/);
    assert.ok(
      source.indexOf("data-layout-locked-masthead") <
        source.indexOf('[...movableZones, "footer" as const]'),
    );
  });
});
