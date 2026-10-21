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
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => id === "viewport-fixture" ? { useIsMobile: () => mobile } : id === "next/navigation" ? { useRouter: () => ({ push() {}, replace() {} }) } : require(id), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

test("shared date picker always opens a bottom sheet on mobile without caller configuration", async () => {
  const Picker = await component("components/ui/thai-date-range-picker.tsx", "ThaiDateRangePicker", true);
  const props = { value: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 21) }, onChange() {}, confirmSelection: true };
  const html = renderToStaticMarkup(createElement(Picker, props));
  assert.match(html, /data-slot="sheet-trigger"/);
  assert.match(html, /data-thai-date-range-picker/);
});

test("shared date picker retains its existing popover trigger on desktop", async () => {
  const Picker = await component("components/ui/thai-date-range-picker.tsx", "ThaiDateRangePicker", false);
  const html = renderToStaticMarkup(createElement(Picker, { value: undefined, onChange() {}, confirmSelection: true }));
  assert.doesNotMatch(html, /data-slot="sheet-trigger"/);
  assert.match(html, /data-base-ui-click-trigger/);
});

test("reporting pickers use mobile sheets on routes beyond the overview", async () => {
  const Picker = await component("components/admin/dashboard/dashboard-date-range-picker.tsx", "DashboardDateRangePicker", true);
  for (const action of ["/admin/dashboard/bookings", "/admin/dashboard/agencies", "/admin/dashboard/houses"]) {
    const html = renderToStaticMarkup(createElement(Picker, { action, month: "2026-10" }));
    assert.match(html, /data-slot="sheet-trigger"/, action);
  }
  const Summary = await component("components/admin/dashboard/website-analytics/summary-range-filter.tsx", "SummaryRangeFilter", true);
  const html = renderToStaticMarkup(createElement(Summary, { month: "2026-10", range: { from: "2026-10-01", to: "2026-10-21" }, today: "2026-10-21" }));
  assert.match(html, /data-slot="sheet-trigger"/);
});

test("dashboard website filters use a sheet trigger instead of inline disclosure", async () => {
  const Graph = await component("components/admin/dashboard/website-analytics/site-summary-graph.tsx", "WebsiteSiteSummaryGraph", true);
  const html = renderToStaticMarkup(createElement(Graph, { granularity: "day", sites: [], month: "2026-10", mobileOverview: true }));
  assert.match(html, /data-slot="sheet-trigger"/);
  assert.match(html, /ตัวกรองและเปรียบเทียบ/);
  assert.doesNotMatch(html, /<details/);
});
