import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function component(file: string, name: string, mobile: boolean) {
  const bundle = await build({ entryPoints: [file], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{ name: "viewport", setup(builder) {
    builder.onResolve({ filter: /hooks\/use-mobile$/ }, () => ({ path: "viewport-fixture", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => id === "viewport-fixture" ? { useIsMobile: () => mobile } : require(id), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

test("dashboard date picker opts into a mobile sheet while other consumers keep their popover", async () => {
  const Picker = await component("components/ui/thai-date-range-picker.tsx", "ThaiDateRangePicker", true);
  const props = { value: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 21) }, onChange() {}, confirmSelection: true };
  const sheet = renderToStaticMarkup(createElement(Picker, { ...props, mobileSheet: true }));
  assert.match(sheet, /data-slot="sheet-trigger"/);
  assert.match(sheet, /data-thai-date-range-picker/);
  const unchanged = renderToStaticMarkup(createElement(Picker, props));
  assert.doesNotMatch(unchanged, /data-slot="sheet-trigger"/);
});

test("desktop date picker markup stays identical when mobile-sheet support is enabled", async () => {
  const Picker = await component("components/ui/thai-date-range-picker.tsx", "ThaiDateRangePicker", false);
  const props = { value: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 21) }, onChange() {}, confirmSelection: true };
  assert.equal(renderToStaticMarkup(createElement(Picker, props)), renderToStaticMarkup(createElement(Picker, { ...props, mobileSheet: true })));
});

test("dashboard website filters use a sheet trigger instead of inline disclosure", async () => {
  const Graph = await component("components/admin/dashboard/website-analytics/site-summary-graph.tsx", "WebsiteSiteSummaryGraph", true);
  const html = renderToStaticMarkup(createElement(Graph, { granularity: "day", sites: [], month: "2026-10", mobileOverview: true }));
  assert.match(html, /data-slot="sheet-trigger"/);
  assert.match(html, /ตัวกรองและเปรียบเทียบ/);
  assert.doesNotMatch(html, /<details/);
});
