import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

test("shared analytics transition replaces only the graph with an accessible skeleton", async () => {
  const built = await build({ stdin: { resolveDir: process.cwd(), contents: `
    export { WebsiteAnalyticsLoadingProvider } from './components/admin/dashboard/website-analytics/analytics-loading';
    export { WebsiteSiteSummaryGraph } from './components/admin/dashboard/website-analytics/site-summary-graph';
    export { SummaryRangeFilter } from './components/admin/dashboard/website-analytics/summary-range-filter';
    export { WebsiteDatasetControls } from './components/admin/dashboard/website-analytics/dataset-controls';
  ` }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const require = createRequire(import.meta.url), loaded = { exports: {} as Record<string, unknown> };
  let pending = true;
  new Function("require", "module", "exports", built.outputFiles[0].text)((name: string) => name === "react" ? { ...require("react"), useTransition: () => [pending, (fn: () => void) => fn()] } : name === "next/navigation" ? { useRouter: () => ({ push() {}, replace() {} }) } : require(name), loaded, loaded.exports);
  const Provider = loaded.exports.WebsiteAnalyticsLoadingProvider as ComponentType<{ children?: ReactNode }>;
  const Graph = loaded.exports.WebsiteSiteSummaryGraph as ComponentType<Record<string, unknown>>;
  const Primary = loaded.exports.SummaryRangeFilter as ComponentType<Record<string, unknown>>;
  const Comparison = loaded.exports.WebsiteDatasetControls as ComponentType<Record<string, unknown>>;
  const range = { from: "2026-10-14", to: "2026-10-14", timeFrom: "09:00", timeTo: "12:00" };
  const sites = [{ key: "a", displayName: "A", origin: "https://a.test", status: "complete", totals: emptyMetrics(), coverage: { data_available_from: "2026-10-01T00:00:00Z", range_complete: true, rows_complete: true } }];
  const render = () => renderToStaticMarkup(createElement(Provider, null,
    createElement("header", null, createElement(Primary, { month: "2026-10", range, today: "2026-10-16" }), createElement(Comparison, { range, granularity: "hour", today: "2026-10-16", sites })),
    createElement(Graph, { sites, granularity: "hour", month: "2026-10", range, asOf: "2026-10-16T04:00:00Z" })));
  const loading = render();
  assert.match(loading, /data-loading-website-chart/);
  assert.match(loading, /role="status"[^>]*aria-label="กำลังโหลดกราฟเว็บไซต์"/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-hidden="true"[^>]*inert=""/);
  const header = loading.match(/<header>([\s\S]*?)<\/header>/)?.[1] ?? "";
  assert.doesNotMatch(header, /กำลังโหลด/);
  assert.equal((header.match(/<button[^>]*\sdisabled=""/g) ?? []).length, 2, "both date controls share pending state");
  const graphControls = loading.match(/aria-label="มุมมองกราฟเว็บไซต์"([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.equal((graphControls.match(/<button[^>]*\sdisabled=""/g) ?? []).length, 3);
  pending = false;
  const complete = render();
  assert.doesNotMatch(complete, /data-loading-website-chart|aria-busy="true"|inert=""/);
  assert.match(complete, /กราฟแนวโน้มรายชั่วโมงแต่ละเว็บไซต์/);
});
