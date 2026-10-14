import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsDatePresets, trailingDateRange } from "../lib/analytics-date-presets.ts";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("shortcuts use inclusive days and Sunday weeks", () => {
  const presets = Object.fromEntries(analyticsDatePresets("2026-10-14", "2026-06-20").map(item => [item.id, item.range]));
  assert.deepEqual(presets.today, { from: "2026-10-14", to: "2026-10-14" });
  assert.deepEqual(presets.yesterday, { from: "2026-10-13", to: "2026-10-13" });
  assert.deepEqual(presets.thisWeek, { from: "2026-10-11", to: "2026-10-14" });
  assert.deepEqual(presets.lastWeek, { from: "2026-10-04", to: "2026-10-10" });
  assert.deepEqual(presets.last7, { from: "2026-10-08", to: "2026-10-14" });
  assert.deepEqual(presets.last14, { from: "2026-10-01", to: "2026-10-14" });
  assert.deepEqual(presets.last30, { from: "2026-09-15", to: "2026-10-14" });
  assert.deepEqual(presets.thisMonth, { from: "2026-10-01", to: "2026-10-14" });
  assert.deepEqual(presets.lastMonth, { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(presets.all, { from: "2026-06-20", to: "2026-10-14" });
});

test("month and week shortcuts cross years and leap February correctly", () => {
  const find = (today: string, id: string) => analyticsDatePresets(today).find(item => item.id === id)?.range;
  assert.deepEqual(find("2024-03-01", "lastMonth"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(find("2026-01-01", "lastMonth"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(find("2026-01-01", "thisWeek"), { from: "2025-12-28", to: "2026-01-01" });
  assert.deepEqual(find("2026-10-11", "thisWeek"), { from: "2026-10-11", to: "2026-10-11" });
  assert.equal(find("2026-10-14", "all"), undefined);
});

test("custom counts include the ending day and reject invalid counts", () => {
  assert.deepEqual(trailingDateRange("2026-10-14", 1), { from: "2026-10-14", to: "2026-10-14" });
  assert.deepEqual(trailingDateRange("2026-10-14", 30, true), { from: "2026-09-14", to: "2026-10-13" });
  for (const count of [0, -1, 1.5, NaN, Infinity, 999999999]) assert.equal(trailingDateRange("2026-10-14", count), undefined);
});

test("shortcut menu exposes presets, trailing-day inputs, and unavailable all-time status", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/range-shortcuts.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Component = loaded.exports.RangeShortcuts as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Component, { today: "2026-10-14", selected: { from: "2026-10-08", to: "2026-10-14" }, onSelect() {}, onCustom() {} }));
  for (const label of ["วันนี้", "เมื่อวานนี้", "7 วันล่าสุด", "14 วันล่าสุด", "30 วันล่าสุด", "เดือนนี้", "เดือนที่แล้ว", "ตั้งแต่ต้น", "กำหนดเอง"]) assert.ok(html.includes(label), label);
  assert.match(html, /aria-label="จำนวนวันจนถึงวันนี้"/);
  assert.match(html, /aria-label="จำนวนวันจนถึงเมื่อวาน"/);
  assert.match(html, /ยังไม่ทราบวันเริ่มเก็บข้อมูล/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, />ใช้<|>ยกเลิก</);
});
