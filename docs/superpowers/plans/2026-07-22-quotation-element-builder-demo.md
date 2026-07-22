# Quotation Element Builder Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone interactive quotation element-builder prototype that demonstrates layer selection, drag, resize, properties, visibility, locking, stacking, Undo, Reset, and Preview without changing the production application.

**Architecture:** Bootstrap the bundled Product Design web prototype under the ignored `.superpowers/prototypes/quotation-element-builder-demo/` directory. Keep document geometry and validation in a pure JavaScript module with `node:test` coverage, while React owns the three-panel UI and Pointer Events interaction. The prototype has no backend or persistence and uses the approved mockup plus the existing quotation screenshot as visual references.

**Tech Stack:** React 19, Vite 6, native Pointer Events, CSS, Node.js `node:test`.

## Global Constraints

- Keep the prototype self-contained at `.superpowers/prototypes/quotation-element-builder-demo/`.
- Do not modify production application code, Supabase, APIs, authentication, Print, PDF, or Public Read-only.
- Do not add dependencies beyond the bundled Product Design prototype template.
- Request explicit user approval before running `npm install --prefer-offline --no-audit --no-fund`.
- Use the current quotation screenshot at `output/screenshots/quotation-preview-QO-20260718-0001.png` and the approved element-builder mockup as visual references.
- Use a portrait A4 editing coordinate space of `794 × 1123` CSS pixels.
- Do not add persistence, pagination, content editing, real PDF generation, collaboration, or production template saving.

## File Map

- `.superpowers/prototypes/quotation-element-builder-demo/src/editor-state.js` — layer defaults, bounds checks, geometry updates, lock behavior, and z-order changes.
- `.superpowers/prototypes/quotation-element-builder-demo/src/App.jsx` — three-panel editor UI, pointer interaction, history, Preview, and property controls.
- `.superpowers/prototypes/quotation-element-builder-demo/src/styles.css` — responsive builder layout, A4 canvas, layers, controls, and states.
- `.superpowers/prototypes/quotation-element-builder-demo/public/assets/company-logo.png` — extracted/generated logo asset grounded in the existing quotation screenshot.
- `.superpowers/prototypes/quotation-element-builder-demo/public/assets/company-stamp.png` — circular stamp asset grounded in the approved quotation mockup.
- `.superpowers/prototypes/quotation-element-builder-demo/tests/editor-state.test.mjs` — state-model regression checks.
- `.superpowers/prototypes/quotation-element-builder-demo/design-qa.md` — final visual comparison and interaction verification report.

---

### Task 1: Bootstrap The Prototype And Build The Layer State Model

**Files:**
- Create: `.superpowers/prototypes/quotation-element-builder-demo/` via the Product Design bootstrap script
- Create: `.superpowers/prototypes/quotation-element-builder-demo/src/editor-state.js`
- Create: `.superpowers/prototypes/quotation-element-builder-demo/tests/editor-state.test.mjs`

**Interfaces:**
- Produces: `CANVAS`, `DEFAULT_LAYERS`, `validateLayers(layers)`, `applyLayerPatch(layers, id, patch)`, and `moveLayerInStack(layers, id, direction)`.
- Consumes: no earlier task output.

- [ ] **Step 1: Bootstrap the bundled web prototype**

Run:

```powershell
node "C:\Users\Poolvilla\.codex\plugins\cache\openai-curated-remote\product-design\0.1.52\scripts\bootstrap-prototype.mjs" --dest "C:\Projects\webook\.superpowers\prototypes\quotation-element-builder-demo"
```

Expected: the destination contains `package.json`, `src/App.jsx`, `src/styles.css`, Vite configuration, worker files, and the Sites test.

- [ ] **Step 2: Request approval, then install only the template's locked dependencies**

After explicit approval, run:

```powershell
npm install --prefer-offline --no-audit --no-fund
```

Expected: install exits `0` without changing the production repository's `package.json` or lockfile.

- [ ] **Step 3: Write the failing state-model test**

Create `tests/editor-state.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS,
  DEFAULT_LAYERS,
  applyLayerPatch,
  moveLayerInStack,
  validateLayers,
} from "../src/editor-state.js";

test("default layers have unique IDs and fit the A4 canvas", () => {
  assert.deepEqual(validateLayers(DEFAULT_LAYERS), []);
});

test("geometry changes are clamped inside the canvas", () => {
  const moved = applyLayerPatch(DEFAULT_LAYERS, "document-meta", { x: 9999, y: -50 });
  const layer = moved.find((item) => item.id === "document-meta");
  assert.equal(layer.y, 0);
  assert.equal(layer.x, CANVAS.width - layer.width);
});

test("locked layers ignore geometry changes", () => {
  const moved = applyLayerPatch(DEFAULT_LAYERS, "item-table", { x: 20, y: 20 });
  assert.deepEqual(moved, DEFAULT_LAYERS);
});

test("stack changes move only the selected layer", () => {
  const moved = moveLayerInStack(DEFAULT_LAYERS, "seller", "forward");
  assert.equal(moved[2].id, "seller");
  assert.equal(moved[1].id, "document-meta");
  assert.equal(moved.length, DEFAULT_LAYERS.length);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:

```powershell
node --test tests/editor-state.test.mjs
```

Expected: FAIL because `src/editor-state.js` does not exist.

- [ ] **Step 5: Implement the minimal state model**

Create `src/editor-state.js`:

```js
export const CANVAS = Object.freeze({ width: 794, height: 1123 });

export const DEFAULT_LAYERS = Object.freeze([
  { id: "logo", name: "โลโก้", type: "image", x: 48, y: 40, width: 104, height: 76, visible: true, locked: false },
  { id: "seller", name: "ข้อมูลผู้ขาย", type: "text", x: 170, y: 44, width: 270, height: 92, visible: true, locked: false },
  { id: "document-meta", name: "ชื่อและข้อมูลเอกสาร", type: "meta", x: 492, y: 42, width: 254, height: 144, visible: true, locked: false },
  { id: "customer", name: "ข้อมูลลูกค้า", type: "customer", x: 48, y: 205, width: 698, height: 110, visible: true, locked: false },
  { id: "item-table", name: "ตารางรายการ", type: "table", x: 48, y: 335, width: 698, height: 320, visible: true, locked: true },
  { id: "totals", name: "สรุปยอด", type: "totals", x: 430, y: 675, width: 316, height: 150, visible: true, locked: false },
  { id: "notes", name: "หมายเหตุ", type: "notes", x: 48, y: 675, width: 344, height: 150, visible: true, locked: false },
  { id: "certification", name: "ส่วนลงนาม", type: "certification", x: 48, y: 850, width: 698, height: 215, visible: true, locked: true },
]);

const geometryKeys = new Set(["x", "y", "width", "height"]);
const minimum = 32;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function validateLayers(layers) {
  const errors = [];
  const ids = new Set();
  for (const layer of layers) {
    if (ids.has(layer.id)) errors.push(`Duplicate layer ID: ${layer.id}`);
    ids.add(layer.id);
    if (layer.width < minimum || layer.height < minimum) errors.push(`Layer too small: ${layer.id}`);
    if (layer.x < 0 || layer.y < 0 || layer.x + layer.width > CANVAS.width || layer.y + layer.height > CANVAS.height) {
      errors.push(`Layer outside canvas: ${layer.id}`);
    }
  }
  return errors;
}

export function applyLayerPatch(layers, id, patch) {
  return layers.map((layer) => {
    if (layer.id !== id) return layer;
    const changesGeometry = Object.keys(patch).some((key) => geometryKeys.has(key));
    if (layer.locked && changesGeometry) return layer;
    const width = clamp(patch.width ?? layer.width, minimum, CANVAS.width - layer.x);
    const height = clamp(patch.height ?? layer.height, minimum, CANVAS.height - layer.y);
    const x = clamp(patch.x ?? layer.x, 0, CANVAS.width - width);
    const y = clamp(patch.y ?? layer.y, 0, CANVAS.height - height);
    return { ...layer, ...patch, x, y, width, height };
  });
}

export function moveLayerInStack(layers, id, direction) {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) return layers;
  const target = direction === "forward"
    ? Math.min(index + 1, layers.length - 1)
    : Math.max(index - 1, 0);
  if (index === target) return layers;
  const next = [...layers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
```

- [ ] **Step 6: Run the state tests**

Run:

```powershell
node --test tests/editor-state.test.mjs
```

Expected: `4` tests pass and `0` fail.

---

### Task 2: Build The Interactive Three-Panel Editor

**Files:**
- Modify: `.superpowers/prototypes/quotation-element-builder-demo/src/App.jsx`
- Modify: `.superpowers/prototypes/quotation-element-builder-demo/src/styles.css`
- Create: `.superpowers/prototypes/quotation-element-builder-demo/public/assets/company-logo.png`

**Interfaces:**
- Consumes: all exports from `src/editor-state.js`.
- Produces: a working single-screen element builder at the Vite root route.

- [ ] **Step 1: Create the grounded logo asset**

Use Image Gen with `output/screenshots/quotation-preview-QO-20260718-0001.png` attached and this prompt for the logo:

```text
Extract the Pool Villa Pattaya logo visible in the supplied quotation screenshot as a clean standalone raster asset. Preserve the exact house, palm trees, orange sun, blue water, and POOL VILLA PATTAYA wordmark. Center it on a plain white background with no added text, decoration, mockup frame, or shadow. Output a square 512 × 512 image suitable for an application prototype.
```

Inspect the result, then copy it to `public/assets/company-logo.png`.

Use Image Gen again with the approved Balanced Corporate mockup attached and this prompt for the stamp:

```text
Extract the circular Pool Villa Pattaya company stamp visible in the supplied quotation mockup as a clean standalone raster asset. Preserve the blue circular seal, company name, and central Pool Villa Pattaya mark. Center it on a plain white background with no added text, decoration, mockup frame, or shadow. Output a square 512 × 512 image suitable for an application prototype.
```

Inspect the result, then copy it to `public/assets/company-stamp.png`.

- [ ] **Step 2: Implement the editor UI and interactions**

Replace `src/App.jsx` with a React component that:

```jsx
import { useMemo, useRef, useState } from "react";
import { CANVAS, DEFAULT_LAYERS, applyLayerPatch, moveLayerInStack, validateLayers } from "./editor-state.js";
import "./styles.css";

const cloneLayers = (layers) => layers.map((layer) => ({ ...layer }));

function LayerContent({ layer }) {
  if (layer.type === "image") {
    return <img className="company-logo" src="/assets/company-logo.png" alt="Pool Villa Pattaya" draggable="false" />;
  }

  if (layer.type === "text") {
    return <div className="seller-content"><strong>พูลวิลล่าพัทยา By.Deville</strong><span>384/5 (D105) หมู่ 2 ต.สุรศักดิ์ อ.ศรีราชา จ.ชลบุรี 20110</span><span>0611012558 · chaymanus@gmail.com</span></div>;
  }

  if (layer.type === "meta") {
    return <div className="meta-content"><h1>ใบเสนอราคา</h1><dl><div><dt>เลขที่</dt><dd>QO-20260718-0001</dd></div><div><dt>วันที่ออก</dt><dd>18/07/2026</dd></div><div><dt>ใช้ได้ถึง</dt><dd>30/07/2026</dd></div></dl></div>;
  }

  if (layer.type === "customer") {
    return <div className="customer-content"><strong>ลูกค้า</strong><span>นางสาว คณาวน</span><strong>ที่อยู่</strong><span>1002/5 หมู่ 2 ต.สุรศักดิ์ อ.ศรีราชา จ.ชลบุรี 20110</span><strong>สำนักงาน</strong><span>สำนักงานใหญ่</span></div>;
  }

  if (layer.type === "table") {
    return <table className="item-content"><thead><tr><th>รายละเอียด</th><th>จำนวน</th><th>ราคา</th><th>VAT</th><th>มูลค่า</th></tr></thead><tbody><tr><td><strong>ค่าที่พัก บ้านพักพูลวิลล่า “The Ocean View”</strong><small>เข้าพักวันที่ 15 สิงหาคม 2569 · 4 ห้องนอน · Wi-Fi</small></td><td>1 คืน</td><td>12,500.00</td><td>7%</td><td>12,000.00</td></tr><tr><td><strong>ค่าประกันความเสียหาย</strong><small>คืนเมื่อเข้าพักไม่ผิดเงื่อนไข</small></td><td>1 รายการ</td><td>3,000.00</td><td>–</td><td>3,000.00</td></tr></tbody></table>;
  }

  if (layer.type === "totals") {
    return <div className="totals-content"><div><span>มูลค่าก่อนภาษี</span><strong>15,000.00 บาท</strong></div><div><span>ภาษีมูลค่าเพิ่ม 7%</span><strong>840.00 บาท</strong></div><div className="grand-total"><span>จำนวนเงินทั้งสิ้น</span><strong>15,840.00 บาท</strong></div></div>;
  }

  if (layer.type === "notes") {
    return <div className="notes-content"><strong>หมายเหตุ</strong><ul><li>กรุณายืนยันการจองล่วงหน้าอย่างน้อย 7 วัน</li><li>ชำระเงินเต็มจำนวนเพื่อยืนยันการจอง</li><li>ราคาได้รวมภาษีมูลค่าเพิ่มแล้ว</li></ul></div>;
  }

  return <div className="certification-content"><section><strong>ผู้ออกเอกสาร</strong><span className="signature-line" /><small>ชยมนัส เดวิล</small></section><section className="stamp-slot"><strong>ตราประทับ</strong><img src="/assets/company-stamp.png" alt="ตราประทับบริษัท" draggable="false" /></section><section><strong>ผู้อนุมัติเอกสาร</strong><span className="signature-line" /><small>ผู้มีอำนาจอนุมัติ</small></section><section><strong>ผู้รับเอกสาร (ลูกค้า)</strong><span className="signature-line" /><small>ชื่อ–นามสกุล / วันที่</small></section></div>;
}

export function App() {
  const [layers, setLayers] = useState(() => cloneLayers(DEFAULT_LAYERS));
  const [selectedId, setSelectedId] = useState("logo");
  const [history, setHistory] = useState([]);
  const [preview, setPreview] = useState(false);
  const dragRef = useRef(null);
  const selected = layers.find((layer) => layer.id === selectedId) ?? layers[0];
  const startupErrors = useMemo(() => validateLayers(DEFAULT_LAYERS), []);

  function commit(next) {
    setHistory((items) => [...items, cloneLayers(layers)]);
    setLayers(next);
  }

  function patchSelected(patch) {
    commit(applyLayerPatch(layers, selected.id, patch));
  }

  function beginPointer(event, layer, mode = "move") {
    if (preview || layer.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(layer.id);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, origin: { ...layer }, before: cloneLayers(layers) };
  }

  function movePointer(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const scale = event.currentTarget.closest("[data-canvas]").getBoundingClientRect().width / CANVAS.width;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const patch = drag.mode === "resize"
      ? { width: drag.origin.width + dx, height: drag.origin.height + dy }
      : { x: drag.origin.x + dx, y: drag.origin.y + dy };
    setLayers((current) => applyLayerPatch(current, drag.origin.id, patch));
  }

  function endPointer() {
    if (!dragRef.current) return;
    setHistory((items) => [...items, dragRef.current.before]);
    dragRef.current = null;
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setLayers(previous);
    setHistory((items) => items.slice(0, -1));
  }

  function reset() {
    setHistory((items) => [...items, cloneLayers(layers)]);
    setLayers(cloneLayers(DEFAULT_LAYERS));
    setSelectedId("logo");
  }

  function nudge(event) {
    if (preview || selected.locked || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.shiftKey ? 10 : 1;
    const patch = {
      ArrowLeft: { x: selected.x - delta }, ArrowRight: { x: selected.x + delta },
      ArrowUp: { y: selected.y - delta }, ArrowDown: { y: selected.y + delta },
    }[event.key];
    patchSelected(patch);
  }

  if (startupErrors.length) return <main className="fatal">Demo state invalid: {startupErrors.join(", ")}</main>;

  return (
    <main className="builder" onKeyDown={nudge}>
      <header className="toolbar">
        <div><strong>Quotation Element Builder</strong><span>Interactive concept demo</span></div>
        <div className="toolbar-actions">
          <button type="button" onClick={undo} disabled={!history.length}>Undo</button>
          <button type="button" onClick={reset}>Reset</button>
          <button type="button" className={preview ? "active" : ""} onClick={() => setPreview((value) => !value)}>{preview ? "Edit" : "Preview"}</button>
        </div>
      </header>
      <section className={`workspace ${preview ? "is-preview" : ""}`}>
        <aside className="panel layers-panel" aria-label="Layers">
          <p className="eyebrow">Layers</p>
          {layers.slice().reverse().map((layer) => (
            <button key={layer.id} type="button" className={`layer-row ${selectedId === layer.id ? "selected" : ""}`} onClick={() => setSelectedId(layer.id)}>
              <span>{layer.name}</span><small>{layer.locked ? "ล็อก" : layer.visible ? "แสดง" : "ซ่อน"}</small>
            </button>
          ))}
        </aside>
        <section className="canvas-stage" aria-label="A4 canvas">
          <div className="a4" data-canvas tabIndex={0} style={{ aspectRatio: `${CANVAS.width}/${CANVAS.height}` }}>
            {layers.map((layer) => layer.visible && (
              <article key={layer.id} className={`canvas-layer ${layer.type} ${selectedId === layer.id ? "selected" : ""} ${layer.locked ? "locked" : ""}`}
                style={{ left: `${layer.x / CANVAS.width * 100}%`, top: `${layer.y / CANVAS.height * 100}%`, width: `${layer.width / CANVAS.width * 100}%`, height: `${layer.height / CANVAS.height * 100}%` }}
                onPointerDown={(event) => beginPointer(event, layer)} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}>
                <LayerContent layer={layer} />
                {selectedId === layer.id && !preview && !layer.locked && <button type="button" className="resize-handle" aria-label={`ปรับขนาด ${layer.name}`} onPointerDown={(event) => { event.stopPropagation(); beginPointer(event, layer, "resize"); }} onPointerMove={movePointer} onPointerUp={endPointer} />}
              </article>
            ))}
          </div>
        </section>
        <aside className="panel properties-panel" aria-label="Properties">
          <p className="eyebrow">Properties</p><h2>{selected.name}</h2>
          <div className="property-grid">
            {["x", "y", "width", "height"].map((key) => <label key={key}>{key.toUpperCase()}<input type="number" value={Math.round(selected[key])} disabled={selected.locked} onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) patchSelected({ [key]: value }); }} /></label>)}
          </div>
          <label className="toggle"><input type="checkbox" checked={selected.visible} onChange={(event) => patchSelected({ visible: event.target.checked })} />แสดง Layer</label>
          <label className="toggle"><input type="checkbox" checked={selected.locked} onChange={(event) => patchSelected({ locked: event.target.checked })} />ล็อกตำแหน่ง</label>
          <div className="stack-actions"><button type="button" onClick={() => commit(moveLayerInStack(layers, selected.id, "forward"))}>Bring forward</button><button type="button" onClick={() => commit(moveLayerInStack(layers, selected.id, "backward"))}>Send backward</button></div>
        </aside>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Implement the responsive visual system**

Replace `src/styles.css` with CSS that defines:

```css
:root {
  font-family: "Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif;
  color: #172033;
  background: #eef1f6;
  font-synthesis: none;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input { font: inherit; }
button { cursor: pointer; }
.builder { min-height: 100vh; }
.toolbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: space-between; gap: 24px; align-items: center; min-height: 68px; padding: 12px 20px; color: white; background: #111827; }
.toolbar strong, .toolbar span { display: block; }
.toolbar span { margin-top: 2px; color: #9ca3af; font-size: 12px; }
.toolbar-actions, .stack-actions { display: flex; gap: 8px; }
.toolbar button, .stack-actions button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: white; color: #172033; }
.toolbar button.active { border-color: #818cf8; background: #6366f1; color: white; }
.toolbar button:disabled { cursor: not-allowed; opacity: .45; }
.workspace { display: grid; grid-template-columns: 240px minmax(520px, 1fr) 260px; min-height: calc(100vh - 68px); }
.panel { padding: 18px; background: white; }
.layers-panel { border-right: 1px solid #dbe0e8; }
.properties-panel { border-left: 1px solid #dbe0e8; }
.eyebrow { margin: 0 0 12px; color: #667085; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.layer-row { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; border: 1px solid transparent; border-radius: 8px; padding: 10px; background: transparent; text-align: left; }
.layer-row:hover { background: #f5f7fb; }
.layer-row.selected { border-color: #a5b4fc; background: #eef2ff; }
.layer-row small { color: #667085; }
.canvas-stage { overflow: auto; padding: 24px; background: #dfe4ec; }
.a4 { position: relative; width: min(794px, 100%); margin: 0 auto; overflow: hidden; background: white; box-shadow: 0 12px 38px rgb(15 23 42 / .18); outline: none; }
.canvas-layer { position: absolute; overflow: hidden; border: 1px solid transparent; user-select: none; touch-action: none; }
.canvas-layer.selected { border: 2px solid #6366f1; }
.canvas-layer.locked.selected { border-style: dashed; }
.resize-handle { position: absolute; right: -1px; bottom: -1px; width: 18px; height: 18px; border: 2px solid white; border-radius: 50%; background: #6366f1; touch-action: none; }
.property-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.property-grid label { color: #667085; font-size: 11px; font-weight: 700; }
.property-grid input { width: 100%; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 7px; padding: 8px; }
.toggle { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
.stack-actions { margin-top: 18px; flex-wrap: wrap; }
.is-preview .layers-panel, .is-preview .properties-panel { display: none; }
.is-preview { grid-template-columns: 1fr; }
.is-preview .canvas-layer { border-color: transparent; }
.company-logo { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.seller-content, .notes-content, .meta-content, .totals-content { height: 100%; padding: 8px; }
.seller-content { display: flex; flex-direction: column; gap: 5px; font-size: 12px; line-height: 1.35; }
.seller-content strong { font-size: 15px; }
.meta-content h1 { margin: 0 0 8px; color: #4f46e5; font-size: 26px; text-align: right; }
.meta-content dl { margin: 0; font-size: 11px; }
.meta-content dl div { display: grid; grid-template-columns: 64px 1fr; gap: 8px; margin-top: 4px; }
.meta-content dt { font-weight: 700; }
.meta-content dd { margin: 0; }
.customer-content { display: grid; grid-template-columns: 72px 1fr; gap: 7px 14px; align-content: center; height: 100%; padding: 10px; border-top: 1px solid #dbe0e8; font-size: 12px; }
.item-content { width: 100%; height: 100%; border-collapse: collapse; font-size: 11px; }
.item-content th, .item-content td { border-bottom: 1px solid #dbe0e8; padding: 9px 7px; text-align: right; vertical-align: top; }
.item-content th { color: #3730a3; background: #eef2ff; }
.item-content th:first-child, .item-content td:first-child { width: 50%; text-align: left; }
.item-content small { display: block; margin-top: 4px; color: #667085; font-size: 10px; font-weight: 400; }
.totals-content { display: grid; align-content: end; gap: 7px; font-size: 11px; }
.totals-content div { display: flex; justify-content: space-between; gap: 12px; }
.grand-total { margin-top: 3px; border-top: 2px solid #6366f1; padding-top: 9px; color: #3730a3; font-size: 14px; }
.notes-content { font-size: 11px; }
.notes-content ul { margin: 8px 0 0; padding-left: 18px; line-height: 1.55; }
.certification-content { display: grid; grid-template-columns: repeat(4, 1fr); align-items: end; gap: 12px; height: 100%; padding: 12px 8px; border-top: 1px solid #dbe0e8; text-align: center; font-size: 10px; }
.certification-content section { display: grid; align-content: end; justify-items: center; gap: 7px; min-width: 0; }
.signature-line { display: block; width: 90%; height: 42px; border-bottom: 1px solid #667085; }
.stamp-slot img { width: 74px; height: 74px; object-fit: contain; }
.certification-content small { color: #667085; }
@media (max-width: 980px) { .workspace { grid-template-columns: 200px minmax(460px, 1fr); } .properties-panel { grid-column: 1 / -1; border-left: 0; border-top: 1px solid #dbe0e8; } }
@media (max-width: 680px) { .toolbar { align-items: flex-start; flex-direction: column; } .workspace { display: block; } .panel { border: 0; border-bottom: 1px solid #dbe0e8; } .canvas-stage { padding: 12px; } }
```

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node --test tests/editor-state.test.mjs
npm run build
npm run test:sites
```

Expected: state tests pass, Vite build exits `0`, and the Sites worker test passes.

---

### Task 3: Preview, Exercise Interactions, And Pass Design QA

**Files:**
- Create: `.superpowers/prototypes/quotation-element-builder-demo/reference-layout.png`
- Create: `.superpowers/prototypes/quotation-element-builder-demo/implementation-desktop.png`
- Create: `.superpowers/prototypes/quotation-element-builder-demo/design-qa.md`
- Modify: `.superpowers/prototypes/quotation-element-builder-demo/src/App.jsx` and `src/styles.css` only for evidence-backed P0/P1/P2 fixes

**Interfaces:**
- Consumes: the completed Vite prototype and the approved visual-companion mockup.
- Produces: a locally running, verified prototype and `design-qa.md` with `final result: passed`.

- [ ] **Step 1: Start the Vite server**

Run in the prototype root:

```powershell
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Expected: Vite serves the prototype at `http://localhost:4173/` and remains running.

- [ ] **Step 2: Capture the source and implementation at matching desktop dimensions**

Use the approved mockup at `http://localhost:59285/` as the source visual and the prototype at `http://localhost:4173/` as the implementation. Capture both at `1440 × 1024` into the exact files listed above.

Expected: both screenshots show the three-panel editor state with the logo layer selected.

- [ ] **Step 3: Exercise the primary interactions**

Verify:

```text
select layer from tree
select layer from canvas
drag unlocked logo
resize unlocked logo
edit X/Y/width/height
lock and confirm movement is blocked
hide and show a layer
bring forward and send backward
nudge with arrow and Shift+arrow
Undo
Reset
Preview and return to Edit
```

Also inspect the browser console and require zero errors.

- [ ] **Step 4: Run design QA**

Place the source and implementation screenshots into one comparison input. Write `design-qa.md` with the required source path, implementation path, viewport, pixel dimensions, state, fidelity checks, interaction evidence, comparison history, and `final result`.

Expected: if any P0/P1/P2 mismatch exists, keep `final result: blocked`, fix only those findings, recapture, and compare again. Stop only when the report says exactly `final result: passed`.

- [ ] **Step 5: Run final verification**

Run:

```powershell
node --test tests/editor-state.test.mjs
npm run build
npm run test:sites
```

Expected: every command exits `0`; `design-qa.md` says `final result: passed`; the local preview remains running for user inspection.
